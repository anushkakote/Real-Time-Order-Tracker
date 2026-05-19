// ============================================
// SMS Notification Module (Twilio)
// ============================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER || '';
const SMS_ENABLED = TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM;

let twilioClient = null;

function initSMS() {
    if (!SMS_ENABLED) {
        console.log('[SMS] ⚠ Twilio credentials not configured — running in SIMULATION mode');
        console.log('[SMS]   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable');
        return;
    }

    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
    console.log(`[SMS] ✓ Twilio configured (from: ${TWILIO_FROM})`);
}

function getStatusEmoji(status) {
    const map = { pending: '⏳', shipped: '🚚', delivered: '✅' };
    return map[status] || '📦';
}

function buildSMSMessage(order, operation) {
    const emoji = getStatusEmoji(order.status);

    if (operation === 'DELETE') {
        return `🗑️ OrderPulse: Hi ${order.customer_name}, your order #${order.id} (${order.product_name}) has been cancelled. Contact support for questions.`;
    }

    if (operation === 'INSERT') {
        return `✅ OrderPulse: Hi ${order.customer_name}! Your order #${order.id} for ${order.product_name} has been placed. Status: ${emoji} ${order.status}. We'll keep you updated!`;
    }

    // UPDATE
    const statusMessages = {
        pending: `Your order is being processed.`,
        shipped: `Your package is on its way! 🎁`,
        delivered: `Your package has been delivered! Enjoy! 🎉`
    };

    return `${emoji} OrderPulse: Hi ${order.customer_name}, order #${order.id} (${order.product_name}) is now ${order.status.toUpperCase()}. ${statusMessages[order.status] || ''}`;
}

async function sendSMS(order, operation) {
    const body = buildSMSMessage(order, operation);

    if (!SMS_ENABLED) {
        console.log(`[SMS] 📱 SIMULATED → To: ${order.customer_phone} | Message: ${body}`);
        return { simulated: true };
    }

    try {
        const message = await twilioClient.messages.create({
            body,
            from: TWILIO_FROM,
            to: order.customer_phone
        });
        console.log(`[SMS] ✓ Sent to ${order.customer_phone} (SID: ${message.sid})`);
        return message;
    } catch (err) {
        console.error(`[SMS] ✗ Failed to send to ${order.customer_phone}:`, err.message);
        return null;
    }
}

module.exports = { initSMS, sendSMS };
