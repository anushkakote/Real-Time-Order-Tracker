// ============================================
// CDC Listener - PostgreSQL LISTEN/NOTIFY → Kafka
// ============================================
const { getCDCClient } = require('../config/db');
const { publishEvent } = require('../config/kafka');

async function startCDCListener() {
    console.log('[CDC] Starting Change Data Capture listener...');
    const client = await getCDCClient();

    await client.query('LISTEN order_changes');
    console.log('[CDC] ✓ Listening on channel "order_changes"');

    client.on('notification', async (msg) => {
        try {
            const payload = JSON.parse(msg.payload);
            console.log(`[CDC] Change detected: ${payload.operation} on order #${payload.data?.id}`);
            await publishEvent(payload);
        } catch (err) {
            console.error('[CDC] Error processing notification:', err.message);
        }
    });

    client.on('error', (err) => {
        console.error('[CDC] Client error:', err.message);
        // Reconnect after a delay
        setTimeout(startCDCListener, 5000);
    });
}

module.exports = { startCDCListener };
