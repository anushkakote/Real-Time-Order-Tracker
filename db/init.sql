-- ============================================
-- Real-Time Order Tracker - Database Schema
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table (with email & phone for notifications)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    product_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CDC Trigger Function: captures INSERT/UPDATE/DELETE and sends via pg_notify
CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', TG_OP,
            'data', row_to_json(OLD),
            'timestamp', CURRENT_TIMESTAMP
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'data', row_to_json(NEW),
            'timestamp', CURRENT_TIMESTAMP
        );
    END IF;

    PERFORM pg_notify('order_changes', payload::text);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS order_change_trigger ON orders;
CREATE TRIGGER order_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_order_change();

-- Seed data
INSERT INTO orders (customer_name, customer_email, customer_phone, product_name, status) VALUES
    ('Alice Johnson', 'alice@example.com', '+1234567890', 'MacBook Pro 16"', 'pending'),
    ('Bob Smith', 'bob@example.com', '+1987654321', 'iPhone 15 Pro Max', 'shipped'),
    ('Charlie Brown', 'charlie@example.com', '+1555123456', 'AirPods Pro 2', 'delivered'),
    ('Diana Prince', 'diana@example.com', '+1555987654', 'iPad Air M2', 'pending'),
    ('Eve Wilson', 'eve@example.com', '+1555246810', 'Apple Watch Ultra', 'shipped');
