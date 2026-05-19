// ============================================
// Alert Service - Entry Point
// Kafka Consumer → Email + SMS Notifications
// ============================================
const { Kafka } = require('kafkajs');
const { initEmail, sendEmail } = require('./channels/email');
const { initSMS, sendSMS } = require('./channels/sms');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

// ── Kafka Setup ──
const kafka = new Kafka({
    clientId: 'alert-service',
    brokers: [KAFKA_BROKER],
    retry: { initialRetryTime: 3000, retries: 15 }
});

// Separate consumer group so it processes independently from notification-service
const consumer = kafka.consumer({ groupId: 'alert-group' });

// ── Process Order Event ──
async function processEvent(event) {
    const { operation, data } = event;

    if (!data) {
        console.warn('[Alert] Received event with no data, skipping');
        return;
    }

    console.log(`[Alert] Processing: ${operation} on order #${data.id} (${data.customer_name})`);

    // Send notifications in parallel
    const promises = [];

    // Send email if customer has email
    if (data.customer_email) {
        promises.push(sendEmail(data, operation));
    } else {
        console.log(`[Alert] No email for order #${data.id}, skipping email`);
    }

    // Send SMS if customer has phone
    if (data.customer_phone) {
        promises.push(sendSMS(data, operation));
    } else {
        console.log(`[Alert] No phone for order #${data.id}, skipping SMS`);
    }

    if (promises.length > 0) {
        await Promise.allSettled(promises);
    }

    console.log(`[Alert] ✓ Finished processing order #${data.id}`);
}

// ── Startup ──
async function start() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║    ALERT SERVICE - Starting...       ║');
    console.log('╚══════════════════════════════════════╝');

    // Initialize notification channels
    initEmail();
    initSMS();

    // Connect Kafka consumer
    console.log('[Kafka] Connecting consumer...');
    await consumer.connect();
    console.log('[Kafka] Consumer connected');

    await consumer.subscribe({ topic: 'order-events', fromBeginning: false });
    console.log('[Kafka] Subscribed to "order-events"');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                await processEvent(event);
            } catch (err) {
                console.error('[Alert] Error processing message:', err.message);
            }
        }
    });

    console.log('[Alert] ✓ Alert Service is running and waiting for events...');
}

start().catch(err => {
    console.error('[Alert] Failed to start:', err.message);
    process.exit(1);
});
