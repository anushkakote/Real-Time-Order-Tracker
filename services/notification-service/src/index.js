// ============================================
// Notification Service - Kafka Consumer + WebSocket Gateway
// ============================================
const http = require('http');
const { WebSocketServer } = require('ws');
const { Kafka } = require('kafkajs');

const PORT = process.env.PORT || 3002;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

// ── HTTP Server ──
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'notification-service',
            clients: clients.size,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// ── WebSocket Server ──
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${req.socket.remoteAddress}). Total: ${clients.size}`);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Real-Time Order Tracker',
        clientCount: clients.size,
        timestamp: new Date().toISOString()
    }));

    // Broadcast updated client count
    broadcastClientCount();

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${clients.size}`);
        broadcastClientCount();
    });

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        clients.delete(ws);
    });
});

function broadcastClientCount() {
    broadcast({
        type: 'client_count',
        clientCount: clients.size,
        timestamp: new Date().toISOString()
    });
}

function broadcast(data) {
    const message = JSON.stringify(data);
    let sent = 0;
    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
            sent++;
        }
    });
    if (data.type === 'order_event') {
        console.log(`[WS] Broadcasted to ${sent}/${clients.size} clients`);
    }
}

// ── Kafka Consumer ──
const kafka = new Kafka({
    clientId: 'notification-service',
    brokers: [KAFKA_BROKER],
    retry: { initialRetryTime: 3000, retries: 15 }
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

async function startKafkaConsumer() {
    console.log('[Kafka] Connecting consumer...');
    await consumer.connect();
    console.log('[Kafka] Consumer connected');

    await consumer.subscribe({ topic: 'order-events', fromBeginning: false });
    console.log('[Kafka] Subscribed to "order-events"');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                console.log(`[Kafka] Received: ${event.operation} on order #${event.data?.id} (partition: ${partition})`);

                broadcast({
                    type: 'order_event',
                    ...event
                });
            } catch (err) {
                console.error('[Kafka] Error processing message:', err.message);
            }
        }
    });
}

// ── Startup ──
async function start() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║  NOTIFICATION SERVICE - Starting...  ║');
    console.log('╚══════════════════════════════════════╝');

    await startKafkaConsumer();

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] ✓ Notification Service running on port ${PORT}`);
        console.log(`[Server] ✓ WebSocket: ws://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
});
