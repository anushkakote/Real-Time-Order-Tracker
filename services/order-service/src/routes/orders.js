// ============================================
// Orders REST API Routes
// ============================================
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/orders - Fetch all orders
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY updated_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Orders] GET error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/orders/:id - Fetch single order
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Orders] GET/:id error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
    try {
        const { customer_name, customer_email, customer_phone, product_name, status = 'pending' } = req.body;
        if (!customer_name || !product_name) {
            return res.status(400).json({ success: false, error: 'customer_name and product_name are required' });
        }
        const result = await pool.query(
            'INSERT INTO orders (customer_name, customer_email, customer_phone, product_name, status, updated_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
            [customer_name, customer_email || null, customer_phone || null, product_name, status]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Orders] POST error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/orders/:id - Update order
router.put('/:id', async (req, res) => {
    try {
        const { customer_name, customer_email, customer_phone, product_name, status } = req.body;
        const result = await pool.query(
            `UPDATE orders SET 
                customer_name = COALESCE($1, customer_name), 
                customer_email = COALESCE($2, customer_email), 
                customer_phone = COALESCE($3, customer_phone), 
                product_name = COALESCE($4, product_name), 
                status = COALESCE($5, status), 
                updated_at = NOW() 
            WHERE id = $6 RETURNING *`,
            [customer_name, customer_email, customer_phone, product_name, status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Orders] PUT error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({ success: true, message: 'Order deleted', data: result.rows[0] });
    } catch (err) {
        console.error('[Orders] DELETE error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
