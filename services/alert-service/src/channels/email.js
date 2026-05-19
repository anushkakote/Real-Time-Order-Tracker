// ============================================
// Email Notification Module (Nodemailer)
// ============================================
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const EMAIL_ENABLED = SMTP_USER && SMTP_PASS;

let transporter = null;

function initEmail() {
    if (!EMAIL_ENABLED) {
        console.log('[Email] ⚠ SMTP credentials not configured — running in SIMULATION mode');
        console.log('[Email]   Set SMTP_USER and SMTP_PASS environment variables to enable');
        return;
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    console.log(`[Email] ✓ SMTP configured (${SMTP_HOST}:${SMTP_PORT})`);
}

function getStatusEmoji(status) {
    const map = { pending: '⏳', shipped: '🚚', delivered: '✅' };
    return map[status] || '📦';
}

function getStatusColor(status) {
    const map = { pending: '#f59e0b', shipped: '#3b82f6', delivered: '#10b981' };
    return map[status] || '#6366f1';
}

function buildEmailHTML(order, operation) {
    const statusColor = getStatusColor(order.status);
    const statusEmoji = getStatusEmoji(order.status);

    if (operation === 'DELETE') {
        return `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #1e293b">
            <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center">
                <h1 style="color:white;margin:0;font-size:24px">🗑️ Order Cancelled</h1>
            </div>
            <div style="padding:32px;color:#e2e8f0">
                <p style="font-size:16px">Hi <strong>${order.customer_name}</strong>,</p>
                <p>Your order <strong>#${order.id}</strong> for <strong>${order.product_name}</strong> has been cancelled.</p>
                <p style="color:#94a3b8;font-size:14px;margin-top:24px">If you have questions, please contact our support team.</p>
            </div>
            <div style="background:#1e293b;padding:16px;text-align:center;color:#64748b;font-size:12px">
                OrderPulse — Real-Time Order Tracking
            </div>
        </div>`;
    }

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #1e293b">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <h1 style="color:white;margin:0;font-size:24px">${statusEmoji} Order ${operation === 'INSERT' ? 'Confirmed' : 'Updated'}</h1>
        </div>
        <div style="padding:32px;color:#e2e8f0">
            <p style="font-size:16px">Hi <strong>${order.customer_name}</strong>,</p>
            <p>${operation === 'INSERT'
                ? `Your order <strong>#${order.id}</strong> has been placed successfully!`
                : `Your order <strong>#${order.id}</strong> has been updated.`
            }</p>

            <div style="background:#1e293b;border-radius:12px;padding:24px;margin:24px 0">
                <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
                    <tr>
                        <td style="padding:8px 0;color:#94a3b8;font-size:14px">Order ID</td>
                        <td style="padding:8px 0;text-align:right;font-weight:600">#${order.id}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#94a3b8;font-size:14px;border-top:1px solid #334155">Product</td>
                        <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #334155">${order.product_name}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#94a3b8;font-size:14px;border-top:1px solid #334155">Status</td>
                        <td style="padding:8px 0;text-align:right;border-top:1px solid #334155">
                            <span style="background:${statusColor}22;color:${statusColor};padding:4px 12px;border-radius:20px;font-weight:600;font-size:13px">
                                ${statusEmoji} ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                        </td>
                    </tr>
                </table>
            </div>

            ${order.status === 'shipped' ? '<p>📍 Your package is on its way! Track your delivery for live updates.</p>' : ''}
            ${order.status === 'delivered' ? '<p>🎉 Your package has been delivered! We hope you enjoy it.</p>' : ''}

            <p style="color:#94a3b8;font-size:14px;margin-top:24px">Thank you for your order!</p>
        </div>
        <div style="background:#1e293b;padding:16px;text-align:center;color:#64748b;font-size:12px">
            OrderPulse — Real-Time Order Tracking
        </div>
    </div>`;
}

async function sendEmail(order, operation) {
    const subject_map = {
        'INSERT': `✅ Order #${order.id} Confirmed — ${order.product_name}`,
        'UPDATE': `${getStatusEmoji(order.status)} Order #${order.id} ${order.status.charAt(0).toUpperCase() + order.status.slice(1)} — ${order.product_name}`,
        'DELETE': `🗑️ Order #${order.id} Cancelled`
    };

    const subject = subject_map[operation] || `Order #${order.id} Update`;
    const html = buildEmailHTML(order, operation);

    if (!EMAIL_ENABLED) {
        console.log(`[Email] 📧 SIMULATED → To: ${order.customer_email} | Subject: ${subject}`);
        return { simulated: true };
    }

    try {
        const info = await transporter.sendMail({
            from: `"OrderPulse" <${SMTP_FROM}>`,
            to: order.customer_email,
            subject,
            html
        });
        console.log(`[Email] ✓ Sent to ${order.customer_email} (${info.messageId})`);
        return info;
    } catch (err) {
        console.error(`[Email] ✗ Failed to send to ${order.customer_email}:`, err.message);
        return null;
    }
}

module.exports = { initEmail, sendEmail };
