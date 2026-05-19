// ============================================
// Order Service - Entry Point
// ============================================
const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orders');
const { connectKafka } = require('./config/kafka');
const { startCDCListener } = require('./cdc/listener');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/orders', orderRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

// Startup
async function start() {
    try {
        console.log('╔══════════════════════════════════════╗');
        console.log('║     ORDER SERVICE - Starting...      ║');
        console.log('╚══════════════════════════════════════╝');

        // Connect to Kafka
        await connectKafka();

        // Start CDC listener (PostgreSQL LISTEN → Kafka)
        await startCDCListener();

        // Start Express server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[Server] ✓ Order Service running on port ${PORT}`);
            console.log(`[Server] ✓ API: http://localhost:${PORT}/api/orders`);
        });
    } catch (err) {
        console.error('[Server] Failed to start:', err.message);
        process.exit(1);
    }
}

start();
