// ============================================
// Kafka Producer Configuration
// ============================================
const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const TOPIC = 'order-events';

const kafka = new Kafka({
    clientId: 'order-service',
    brokers: [KAFKA_BROKER],
    retry: { initialRetryTime: 3000, retries: 10 }
});

const producer = kafka.producer();
const admin = kafka.admin();

async function connectKafka() {
    console.log('[Kafka] Connecting producer...');
    await producer.connect();
    console.log('[Kafka] Producer connected');

    // Ensure topic exists
    await admin.connect();
    const topics = await admin.listTopics();
    if (!topics.includes(TOPIC)) {
        await admin.createTopics({
            topics: [{ topic: TOPIC, numPartitions: 3, replicationFactor: 1 }]
        });
        console.log(`[Kafka] Topic "${TOPIC}" created`);
    }
    await admin.disconnect();
}

async function publishEvent(event) {
    await producer.send({
        topic: TOPIC,
        messages: [{
            key: String(event.data?.id || 'unknown'),
            value: JSON.stringify(event)
        }]
    });
    console.log(`[Kafka] Event published: ${event.operation} on order #${event.data?.id}`);
}

module.exports = { connectKafka, publishEvent };
