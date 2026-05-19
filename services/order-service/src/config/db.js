// ============================================
// Database Connection Pool (PostgreSQL)
// ============================================
const { Pool, Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://admin:admin123@localhost:5432/orders_db';

// Connection pool for query operations
const pool = new Pool({ connectionString: DATABASE_URL });

// Dedicated client for LISTEN/NOTIFY (CDC)
async function getCDCClient() {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    return client;
}

module.exports = { pool, getCDCClient };
