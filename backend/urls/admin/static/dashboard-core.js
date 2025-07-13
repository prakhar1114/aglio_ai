// Admin Dashboard Core - Connection and Table Management

class DashboardManager {
    constructor() {
        this.ws = null;
        this.apiKey = null;
        this.restaurantSlug = null; // Added for menu API calls
        this.tables = [];
        this.waiterRequests = [];
        this.moveMode = false;
        this.moveSourceId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 1000;
        
        // Connection status tracking
        this.connectionStatus = 'disconnected';
        
        this.init();
    }
    
    init() {
        // Get JWT token - try both localStorage and the data attribute
        this.apiKey = localStorage.getItem('apiKey') || document.body.dataset.apiKey;
        this.restaurantSlug = localStorage.getItem('restaurantSlug') || document.body.dataset.restaurantSlug;
        
        if (this.apiKey) {
            localStorage.setItem('apiKey', this.apiKey);
        }
        
        if (this.restaurantSlug) {
            localStorage.setItem('restaurantSlug', this.restaurantSlug);
        }
        
        if (!this.apiKey) {
            this.showToast('No auth token found. Please log in again.', 'error');
            setTimeout(() => window.location.href = '/admin/login', 2000);
            return;
        }
        
        this.setupConnectionStatusIndicator();
        this.connect();
        this.setupQRButton();
        this.setupEventListeners();
    }
    
    setupConnectionStatusIndicator() {
        const header = document.querySelector('header h1');
        if (header) {
            const statusIndicator = document.createElement('span');
            statusIndicator.id = 'connection-status';
            statusIndicator.className = 'connection-status';
            statusIndicator.innerHTML = '<span class="status-dot"></span>';
            statusIndicator.title = 'Connection Status';
            
            const style = document.createElement('style');
            style.textContent = `
                .connection-status {
                    margin-left: 12px;
                    display: inline-flex;
                    align-items: center;
                    cursor: help;
                }
                .status-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    display: inline-block;
                    transition: all 0.3s ease;
                }
                .connection-status.connected .status-dot {
                    background-color: #22c55e;
                    box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
                }
                .connection-status.connecting .status-dot {
                    background-color: #f59e0b;
                    box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
                    animation: pulse 1.5s infinite;
                }
                .connection-status.disconnected .status-dot {
                    background-color: #ef4444;
                    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
                }
                .connection-status.failed .status-dot {
                    background-color: #dc2626;
                    box-shadow: 0 0 8px rgba(220, 38, 38, 0.8);
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `;
            
            if (!document.querySelector('#connection-status-styles')) {
                style.id = 'connection-status-styles';
                document.head.appendChild(style);
            }
            
            header.appendChild(statusIndicator);
            this.updateConnectionStatus('disconnected');
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus = status;
        const indicator = document.getElementById('connection-status');
        if (indicator) {
            indicator.className = `connection-status ${status}`;
            
            const tooltips = {
                connected: 'Connected to server',
                connecting: 'Connecting...',
                disconnected: 'Disconnected from server',
                failed: 'Connection failed'
            };
            indicator.title = tooltips[status] || 'Unknown status';
        }
    }
    
    connect() {
        this.updateConnectionStatus('connecting');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/admin/ws/dashboard?token=${encodeURIComponent(this.apiKey)}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Dashboard WebSocket connected');
                this.reconnectAttempts = 0;
                this.reconnectInterval = 1000;
                this.updateConnectionStatus('connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    let message;
                    try {
                        message = JSON.parse(event.data);
                    } catch {
                        message = event.data;
                    }
                    
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 Dashboard WebSocket disconnected:', event.code, event.reason);
                this.updateConnectionStatus('disconnected');
                this.handleDisconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ Dashboard WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.updateConnectionStatus('failed');
            this.handleDisconnect();
        }
    }
    
    handleMessage(message) {
        // Handle ping/pong for admin keepalive
        if (typeof message === 'string') {
            if (message.trim() === 'ping') {
                this.ws.send('pong');
                console.log('📡 Responded to ping with pong');
                return;
            }
            if (message.trim() === 'pong') {
                console.log('📡 Received pong from server');
                return;
            }
        }
        
        switch (message.type) {
            case 'tables_snapshot':
                this.tables = message.tables;
                this.renderGrid();
                break;
                
            case 'pending_waiter_requests':
                this.waiterRequests = message.requests;
                this.renderWaiterRequestsSidebar();
                break;
                
            case 'table_update':
                const existingTable = this.tables.find(table => table.id === message.table.id);
                if (existingTable && 
                    existingTable.status === 'open' && 
                    message.table.status === 'occupied') {
                    this.playNotificationSound();
                }
                
                this.updateTable(message.table);
                this.showToast(`Table ${message.table.number} updated`, 'success');
                break;
                
            case 'waiter_request':
                this.handleWaiterRequest(message.request);
                break;
                
            case 'waiter_request_resolved':
                this.handleWaiterRequestResolved(message.request_id);
                break;
                
            case 'order_notification':
                this.handleOrderNotification(message.order);
                break;
                
            case 'order_acknowledged':
                this.handleOrderAcknowledged(message.order_id);
                break;
                
            case 'pending_orders':
                this.handlePendingOrders(message.orders);
                break;
                
            case 'pending_order':
                this.handlePendingOrder(message.order);
                break;
                
            case 'order_removed':
                this.handleOrderRemoved(message.order_id, message.reason);
                break;
                
            case 'pos_retry_success':
                this.handlePOSRetrySuccess(message.order_id);
                break;
                
            case 'pos_retry_failed':
                this.handlePOSRetryFailed(message.order_id, message.error);
                break;
                
            case 'error':
                this.showToast(message.detail, 'error');
                if (message.code === 'invalid_token') {
                    setTimeout(() => window.location.href = '/admin/login', 2000);
                }
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    updateTable(updatedTable) {
        const index = this.tables.findIndex(table => table.id === updatedTable.id);
        if (index !== -1) {
            this.tables[index] = updatedTable;
            this.renderTableTile(updatedTable);
        }
    }
    
    handleWaiterRequest(request) {
        this.waiterRequests.push(request);
        this.playNotificationSound();
        this.renderWaiterRequestsSidebar();
        
        const requestType = request.request_type === 'call_waiter' ? 'Waiter Call' : 'Bill Request';
        this.showToast(`${requestType} from Table ${request.table_number} (${request.member_name})`, 'info');
    }
    
    handleWaiterRequestResolved(requestId) {
        const index = this.waiterRequests.findIndex(req => req.id === requestId);
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            this.renderWaiterRequestsSidebar();
            this.showToast('Request resolved successfully', 'success');
        }
    }
    
    handleOrderNotification(order) {
        const orderNotification = {
            id: `order_${order.id}`,
            type: 'order',
            table_id: order.table_id,
            table_number: order.table_number,
            order_id: order.id,
            order_number: order.order_number,
            created_at: order.timestamp,
            items: order.items
        };
        
        this.waiterRequests.push(orderNotification);
        this.playNotificationSound();
        this.renderWaiterRequestsSidebar();
        
        this.showToast(`New Order #${order.order_number} from Table ${order.table_number}`, 'info');
    }
    
    handleOrderAcknowledged(orderId) {
        const index = this.waiterRequests.findIndex(req => req.type === 'order' && req.order_id === orderId);
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            this.renderWaiterRequestsSidebar();
            this.showToast('Order acknowledged successfully', 'success');
        }
    }
    
    handlePendingOrders(orders) {
        orders.forEach(order => {
            const pendingOrderNotification = {
                id: `pending_order_${order.id}`,
                type: 'pending_order',
                table_id: order.table_id,
                table_number: order.table_number,
                order_id: order.id,
                order_number: order.order_number,
                created_at: order.timestamp,
                customer_name: order.customer_name,
                items: order.items,
                total: order.total,
                special_instructions: order.special_instructions || ''
            };
            
            const exists = this.waiterRequests.find(req => req.id === pendingOrderNotification.id);
            if (!exists) {
                this.waiterRequests.push(pendingOrderNotification);
            }
        });
        
        this.renderWaiterRequestsSidebar();
    }
    
    handlePendingOrder(order) {
        const pendingOrderNotification = {
            id: `pending_order_${order.id}`,
            type: 'pending_order',
            table_id: order.table_id,
            table_number: order.table_number,
            order_id: order.id,
            order_number: order.order_number,
            created_at: order.timestamp,
            customer_name: order.customer_name,
            items: order.items,
            total: order.total,
            special_instructions: order.special_instructions || ''
        };
        
        this.waiterRequests.push(pendingOrderNotification);
        this.playNotificationSound();
        this.renderWaiterRequestsSidebar();
        
        this.showToast(`New Order #${order.order_number} from Table ${order.table_number} needs approval`, 'info');
    }
    
    handleOrderRemoved(orderId, reason) {
        const index = this.waiterRequests.findIndex(req => 
            (req.type === 'pending_order' || req.type === 'order') && req.order_id === orderId
        );
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            this.renderWaiterRequestsSidebar();
            
            const reasonText = reason === 'approved' ? 'approved' : 
                             reason === 'rejected' ? 'rejected' :
                             reason === 'edited_and_approved' ? 'edited and approved' : 'processed';
            this.showToast(`Order successfully ${reasonText}`, 'success');
        }
    }
    
    handlePOSRetrySuccess(orderId) {
        this.showToast(`POS retry successful for Order #${orderId}`, 'success');
    }
    
    handlePOSRetryFailed(orderId, error) {
        this.showToast(`POS retry failed for Order #${orderId}: ${error}`, 'error');
    }
    
    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }
    
    calculateIdleTime(lastActive) {
        const now = new Date();
        const lastActiveDate = new Date(lastActive);
        const diffMs = now - lastActiveDate;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 60) {
            return `${diffMins} min`;
        } else {
            const hours = Math.floor(diffMins / 60);
            const remainingMins = diffMins % 60;
            return `${hours}h ${remainingMins}m`;
        }
    }
    
    calculateTimeAgo(timestamp) {
        const now = new Date();
        const requestTime = new Date(timestamp);
        const diffMs = now.getTime() - requestTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else {
            const hours = Math.floor(diffMins / 60);
            const remainingMins = diffMins % 60;
            if (hours < 24) {
                return remainingMins > 0 ? `${hours}h ${remainingMins}m ago` : `${hours}h ago`;
            } else {
                const days = Math.floor(hours / 24);
                return `${days}d ago`;
            }
        }
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.showToast('Connection lost. Message will be sent when reconnected.', 'warning');
            if (this.connectionStatus === 'connected') {
                this.updateConnectionStatus('disconnected');
            }
        }
    }
    
    sendAction(action, params = {}) {
        const message = {
            action: action,
            ...params
        };
        
        this.send(message);
        this.showToast('Processing...', 'info');
    }
    
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.updateConnectionStatus('connecting');
            this.showToast(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
            
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        } else {
            this.updateConnectionStatus('failed');
            this.showConnectionFailureModal();
        }
    }
    
    showConnectionFailureModal() {
        const existingModal = document.getElementById('connectionFailureModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHTML = `
            <div id="connectionFailureModal" class="connection-modal">
                <div class="connection-modal-content">
                    <h3>🔌 Connection Lost</h3>
                    <p>Unable to maintain connection to the dashboard server after multiple attempts.</p>
                    <p>Please refresh the page to restore connectivity.</p>
                    <button onclick="window.location.reload()">Refresh Page</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        setTimeout(() => {
            window.location.reload();
        }, 10000);
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.moveMode) {
                this.exitMoveMode();
            }
        });
        
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast toast-${type}`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);
    }
    
    logout() {
        localStorage.removeItem('apiKey');
        localStorage.removeItem('restaurantSlug');
        
        if (this.ws) {
            this.ws.close();
        }
        
        window.location.href = '/admin/login';
    }
    
    setupQRButton() {
        const btn = document.createElement('button');
        btn.id = 'qr-code-btn';
        btn.textContent = 'Get Table QR Code';
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.color = 'white';
        btn.style.border = '1px solid rgba(255,255,255,0.3)';
        btn.style.padding = '0.7rem 1.5rem';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.3s ease';
        btn.style.fontWeight = '600';
        btn.style.backdropFilter = 'blur(10px)';
        btn.style.marginRight = '12px';

        btn.addEventListener('mouseover', () => {
            btn.style.background = 'rgba(255,255,255,0.3)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = 'rgba(255,255,255,0.2)';
            btn.style.transform = 'none';
            btn.style.boxShadow = 'none';
        });

        btn.addEventListener('click', () => this.openQRModal());

        const headerActions = document.querySelector('header .header-actions');
        const logoutBtn = document.getElementById('logout');
        if (headerActions && logoutBtn) {
            headerActions.insertBefore(btn, logoutBtn);
        } else {
            const header = document.querySelector('header');
            if (header) {
                header.appendChild(btn);
            } else {
                document.body.appendChild(btn);
            }
        }
    }

    openQRModal() {
        this.closeQRModal();

        if (!this.tables || this.tables.length === 0) {
            this.showToast('Table data not loaded yet', 'error');
            return;
        }

        const options = this.tables.map(t => `<option value="${t.id}">Table ${t.number}</option>`).join('');

        const modalHTML = `
            <div id="qrCodeModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;">
                <div style="background:#fff;padding:24px;border-radius:8px;max-width:340px;width:90%;text-align:center;position:relative;">
                    <button id="qrCloseBtn" style="position:absolute;top:8px;right:8px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
                    <h3 style="margin-bottom:12px;">Generate Table QR Code</h3>
                    <select id="qrTableSelect" style="width:100%;padding:8px 4px;margin-bottom:12px;">${options}</select>
                    <button id="qrGenerateBtn" style="padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">Generate</button>
                    <div id="qrResult" style="margin-top:16px;"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('qrCloseBtn').addEventListener('click', () => this.closeQRModal());
        document.getElementById('qrGenerateBtn').addEventListener('click', () => this.generateQRCode());
    }

    closeQRModal() {
        const modal = document.getElementById('qrCodeModal');
        if (modal) modal.remove();
    }

    async generateQRCode() {
        const selectEl = document.getElementById('qrTableSelect');
        if (!selectEl) return;
        const tableId = parseInt(selectEl.value);
        try {
            const response = await fetch(`/admin/api/table/${tableId}/qr`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.detail?.detail || 'Failed to generate QR code');
            }

            const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.url)}`;
            const qrResult = document.getElementById('qrResult');
            qrResult.innerHTML = `
                <img src="${imgSrc}" alt="QR Code" style="width:200px;height:200px;margin-bottom:12px;" />
                <div style="display:flex;align-items:center;justify-content:center;">
                    <input id="qrLinkInput" type="text" readonly value="${data.url}" style="flex:1;border:1px solid #ccc;padding:6px;border-radius:4px;margin-right:4px;" />
                    <button id="copyLinkBtn" style="padding:6px 8px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;">Copy</button>
                </div>`;

            document.getElementById('copyLinkBtn').addEventListener('click', () => {
                const input = document.getElementById('qrLinkInput');
                if (!input) return;
                input.select();
                try {
                    document.execCommand('copy');
                    this.showToast('Link copied', 'success');
                } catch (err) {
                    this.showToast('Copy failed', 'error');
                }
            });
        } catch (error) {
            console.error('QR generation failed:', error);
            this.showToast(error.message || 'Failed to generate QR', 'error');
        }
    }
}

// Global instance
const dashboard = new DashboardManager();
window.dashboard = dashboard; 