// ============================================
// Real-Time Order Tracker - Frontend App
// ============================================

const API_BASE = '/api/orders';
const WS_URL = `ws://${window.location.host}/ws`;

// ── State ──
let orders = [];
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

// ── DOM Elements ──
const $tbody = document.getElementById('orders-tbody');
const $totalCount = document.getElementById('total-count');
const $pendingCount = document.getElementById('pending-count');
const $shippedCount = document.getElementById('shipped-count');
const $deliveredCount = document.getElementById('delivered-count');
const $connStatus = document.getElementById('connection-status');
const $clientCount = document.getElementById('client-count-text');
const $activityFeed = document.getElementById('activity-feed');
const $orderForm = document.getElementById('order-form');
const $editModal = document.getElementById('edit-modal');
const $editForm = document.getElementById('edit-form');
const $btnRefresh = document.getElementById('btn-refresh');
const $toastContainer = document.getElementById('toast-container');

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const icons = { success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    $toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// API Calls
// ============================================
async function fetchOrders() {
    try {
        const res = await fetch(API_BASE);
        const json = await res.json();
        if (json.success) {
            orders = json.data;
            renderOrders();
            updateStats();
        }
    } catch (err) {
        console.error('Failed to fetch orders:', err);
        showToast('Failed to load orders', 'error');
    }
}

async function createOrder(data) {
    try {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Order created for ${json.data.customer_name}`, 'success');
        } else {
            showToast(json.error || 'Failed to create order', 'error');
        }
    } catch (err) {
        showToast('Failed to create order', 'error');
    }
}

async function updateOrder(id, data) {
    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Order #${id} updated`, 'success');
        } else {
            showToast(json.error || 'Failed to update order', 'error');
        }
    } catch (err) {
        showToast('Failed to update order', 'error');
    }
}

async function deleteOrder(id) {
    if (!confirm(`Delete order #${id}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            showToast(`Order #${id} deleted`, 'warning');
        }
    } catch (err) {
        showToast('Failed to delete order', 'error');
    }
}

// ============================================
// WebSocket Connection
// ============================================
function connectWebSocket() {
    setConnectionStatus('connecting');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('[WS] Connected');
        setConnectionStatus('connected');
        reconnectAttempts = 0;
        showToast('Connected to live updates', 'success');
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWSMessage(msg);
        } catch (err) {
            console.error('[WS] Parse error:', err);
        }
    };

    ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnectionStatus('disconnected');
        attemptReconnect();
    };

    ws.onerror = (err) => {
        console.error('[WS] Error:', err);
    };
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) {
        showToast('Connection lost. Please refresh the page.', 'error');
        return;
    }
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    setTimeout(connectWebSocket, delay);
}

function setConnectionStatus(status) {
    $connStatus.className = `connection-status ${status}`;
    const texts = { connecting: 'Connecting...', connected: 'Connected', disconnected: 'Disconnected' };
    $connStatus.querySelector('.status-text').textContent = texts[status] || status;
}

function handleWSMessage(msg) {
    switch (msg.type) {
        case 'connection':
            console.log('[WS]', msg.message);
            break;
        case 'client_count':
            $clientCount.textContent = `${msg.clientCount} viewer${msg.clientCount !== 1 ? 's' : ''}`;
            break;
        case 'order_event':
            handleOrderEvent(msg);
            break;
    }
}

// ============================================
// Real-Time Event Handling
// ============================================
function handleOrderEvent(event) {
    const { operation, data } = event;

    switch (operation) {
        case 'INSERT':
            orders.unshift(data);
            renderOrders();
            highlightRow(data.id);
            addActivity('insert', `New order #${data.id}: ${data.product_name} for ${data.customer_name}`);
            break;

        case 'UPDATE':
            const idx = orders.findIndex(o => o.id === data.id);
            if (idx !== -1) {
                orders[idx] = data;
            } else {
                orders.unshift(data);
            }
            renderOrders();
            highlightRow(data.id);
            addActivity('update', `Order #${data.id} updated → ${data.status}`);
            break;

        case 'DELETE':
            const row = document.querySelector(`tr[data-id="${data.id}"]`);
            if (row) {
                row.classList.add('row-delete');
                setTimeout(() => {
                    orders = orders.filter(o => o.id !== data.id);
                    renderOrders();
                }, 500);
            } else {
                orders = orders.filter(o => o.id !== data.id);
                renderOrders();
            }
            addActivity('delete', `Order #${data.id} deleted (${data.customer_name})`);
            break;
    }
    updateStats();
}

function highlightRow(id) {
    setTimeout(() => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.classList.add('highlight');
            setTimeout(() => row.classList.remove('highlight'), 2000);
        }
    }, 50);
}

// ============================================
// Rendering
// ============================================
function renderOrders() {
    if (orders.length === 0) {
        $tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                        <p>No orders yet. Create one to get started!</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    $tbody.innerHTML = orders.map(order => `
        <tr data-id="${order.id}">
            <td><strong>#${order.id}</strong></td>
            <td>
                <div>${escapeHtml(order.customer_name)}</div>
                ${order.customer_email ? `<div style="font-size:0.72rem;color:var(--text-muted)">📧 ${escapeHtml(order.customer_email)}</div>` : ''}
                ${order.customer_phone ? `<div style="font-size:0.72rem;color:var(--text-muted)">📱 ${escapeHtml(order.customer_phone)}</div>` : ''}
            </td>
            <td>${escapeHtml(order.product_name)}</td>
            <td><span class="status-badge ${order.status}">${order.status}</span></td>
            <td><span style="color:var(--text-muted);font-size:0.8rem">${formatTime(order.updated_at)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-action btn-edit" onclick="openEditModal(${order.id})" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteOrder(${order.id})" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats() {
    animateCounter($totalCount, orders.length);
    animateCounter($pendingCount, orders.filter(o => o.status === 'pending').length);
    animateCounter($shippedCount, orders.filter(o => o.status === 'shipped').length);
    animateCounter($deliveredCount, orders.filter(o => o.status === 'delivered').length);
}

function animateCounter(el, value) {
    if (parseInt(el.textContent) !== value) {
        el.textContent = value;
        el.classList.add('animate');
        setTimeout(() => el.classList.remove('animate'), 400);
    }
}

function addActivity(type, message) {
    const icons = { insert: '➕', update: '🔄', delete: '🗑️' };
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
        <div class="activity-icon ${type}">${icons[type]}</div>
        <div class="activity-info">
            <div class="activity-text">${message}</div>
            <div class="activity-time">${new Date().toLocaleTimeString()}</div>
        </div>`;

    // Remove empty state
    const empty = $activityFeed.querySelector('.activity-empty');
    if (empty) empty.remove();

    $activityFeed.prepend(item);

    // Keep max 50 items
    while ($activityFeed.children.length > 50) {
        $activityFeed.lastChild.remove();
    }
}

// ============================================
// Edit Modal
// ============================================
function openEditModal(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    document.getElementById('edit-id').value = order.id;
    document.getElementById('edit-customer').value = order.customer_name;
    document.getElementById('edit-email').value = order.customer_email || '';
    document.getElementById('edit-phone').value = order.customer_phone || '';
    document.getElementById('edit-product').value = order.product_name;
    document.getElementById('edit-status').value = order.status;
    $editModal.classList.add('active');
}

function closeEditModal() {
    $editModal.classList.remove('active');
}

// ============================================
// Utilities
// ============================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Event Listeners
// ============================================
$orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        customer_name: document.getElementById('form-customer').value.trim(),
        customer_email: document.getElementById('form-email').value.trim(),
        customer_phone: document.getElementById('form-phone').value.trim(),
        product_name: document.getElementById('form-product').value.trim(),
        status: document.getElementById('form-status').value
    };
    if (!data.customer_name || !data.product_name) return;
    await createOrder(data);
    $orderForm.reset();
});

$editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = {
        customer_name: document.getElementById('edit-customer').value.trim(),
        customer_email: document.getElementById('edit-email').value.trim(),
        customer_phone: document.getElementById('edit-phone').value.trim(),
        product_name: document.getElementById('edit-product').value.trim(),
        status: document.getElementById('edit-status').value
    };
    await updateOrder(id, data);
    closeEditModal();
});

document.getElementById('modal-close').addEventListener('click', closeEditModal);
document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
$editModal.addEventListener('click', (e) => { if (e.target === $editModal) closeEditModal(); });

$btnRefresh.addEventListener('click', () => {
    $btnRefresh.classList.add('spinning');
    fetchOrders().then(() => {
        setTimeout(() => $btnRefresh.classList.remove('spinning'), 600);
        showToast('Orders refreshed', 'info');
    });
});

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    fetchOrders();
    connectWebSocket();
});
