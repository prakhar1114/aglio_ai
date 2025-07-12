// Admin Dashboard WebSocket Implementation

class DashboardManager {
    constructor() {
        this.ws = null;
        this.apiKey = null;
        this.tables = [];
        this.waiterRequests = []; // Store waiter requests and order notifications as array, ordered by oldest first
        this.moveMode = false;
        this.moveSourceId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 1000; // Start with 1 second
        
        // Connection status tracking
        this.connectionStatus = 'disconnected'; // 'connected', 'connecting', 'disconnected', 'failed'
        
        this.init();
    }
    
    init() {
        // Get JWT token - try both localStorage and the data attribute
        this.apiKey = localStorage.getItem('apiKey') || document.body.dataset.apiKey;
        

        
        if (this.apiKey) {
            localStorage.setItem('apiKey', this.apiKey);
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
        // QR Code generator setup
    }
    
    setupConnectionStatusIndicator() {
        // Add connection status indicator to header
        const header = document.querySelector('header h1');
        if (header) {
            const statusIndicator = document.createElement('span');
            statusIndicator.id = 'connection-status';
            statusIndicator.className = 'connection-status';
            statusIndicator.innerHTML = '<span class="status-dot"></span>';
            statusIndicator.title = 'Connection Status';
            
            // Add CSS styles
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
                .connection-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .connection-modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                }
                .connection-modal h3 {
                    margin: 0 0 1rem 0;
                    color: #dc2626;
                }
                .connection-modal p {
                    margin: 0 0 1.5rem 0;
                    color: #6b7280;
                    line-height: 1.5;
                }
                .connection-modal button {
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                }
                .connection-modal button:hover {
                    background: #b91c1c;
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
            
            // Update tooltip based on status
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
                    // Try parsing as JSON first, fallback to string for ping/pong
                    let message;
                    try {
                        message = JSON.parse(event.data);
                    } catch {
                        // Handle as plain text (ping/pong)
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
                // Check if table status changed from 'open' to 'occupied'
                const existingTable = this.tables.find(table => table.id === message.table.id);
                if (existingTable && 
                    existingTable.status === 'open' && 
                    message.table.status === 'occupied') {
                    // Table got occupied - play notification sound
                    this.playNotificationSound();
                }
                
                this.updateTable(message.table);
                // Show success feedback for table updates
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
                
            case 'pending_orders': // multiple orders
                this.handlePendingOrders(message.orders);
                break;
                
            case 'pending_order': // single order
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
        // Add new request to the end of the array (FIFO - oldest requests resolved first)
        this.waiterRequests.push(request);
        
        // Play alert sound
        this.playNotificationSound();
        
        // Update sidebar
        this.renderWaiterRequestsSidebar();
        
        // Show toast notification
        const requestType = request.request_type === 'call_waiter' ? 'Waiter Call' : 'Bill Request';
        this.showToast(`${requestType} from Table ${request.table_number} (${request.member_name})`, 'info');
    }
    
    handleWaiterRequestResolved(requestId) {
        // Remove the resolved request from the array
        const index = this.waiterRequests.findIndex(req => req.id === requestId);
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            
            // Update sidebar
            this.renderWaiterRequestsSidebar();
            
            // Show success feedback
            this.showToast('Request resolved successfully', 'success');
        }
    }
    
    handleOrderNotification(order) {
        // Add new order notification to the array
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
        
        // Play alert sound
        this.playNotificationSound();
        
        // Update sidebar
        this.renderWaiterRequestsSidebar();
        
        // Show toast notification
        this.showToast(`New Order #${order.order_number} from Table ${order.table_number}`, 'info');
    }
    
    handleOrderAcknowledged(orderId) {
        // Remove the acknowledged order from the array
        const index = this.waiterRequests.findIndex(req => req.type === 'order' && req.order_id === orderId);
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            
            // Update sidebar
            this.renderWaiterRequestsSidebar();
            
            // Show success feedback
            this.showToast('Order acknowledged successfully', 'success');
        }
    }
    
    handlePendingOrders(orders) {
        // Add all pending orders to the requests array
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
            
            // Check if already exists to avoid duplicates
            const exists = this.waiterRequests.find(req => req.id === pendingOrderNotification.id);
            if (!exists) {
                this.waiterRequests.push(pendingOrderNotification);
            }
        });
        
        // Update sidebar
        this.renderWaiterRequestsSidebar();
    }
    
    handlePendingOrder(order) {
        // Add new pending order to the array
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
        
        // Play alert sound
        this.playNotificationSound();
        
        // Update sidebar
        this.renderWaiterRequestsSidebar();
        
        // Show toast notification
        this.showToast(`New Order #${order.order_number} from Table ${order.table_number} needs approval`, 'info');
    }
    
    handleOrderRemoved(orderId, reason) {
        // Remove the order from the array
        const index = this.waiterRequests.findIndex(req => 
            (req.type === 'pending_order' || req.type === 'order') && req.order_id === orderId
        );
        if (index !== -1) {
            this.waiterRequests.splice(index, 1);
            
            // Update sidebar
            this.renderWaiterRequestsSidebar();
            
            // Show success feedback
            const reasonText = reason === 'approved' ? 'approved' : 
                             reason === 'rejected' ? 'rejected' :
                             reason === 'edited_and_approved' ? 'edited and approved' : 'processed';
            this.showToast(`Order successfully ${reasonText}`, 'success');
        }
    }
    
    handlePOSRetrySuccess(orderId) {
        // Show success feedback
        this.showToast(`POS retry successful for Order #${orderId}`, 'success');
    }
    
    handlePOSRetryFailed(orderId, error) {
        // Show error feedback
        this.showToast(`POS retry failed for Order #${orderId}: ${error}`, 'error');
    }
    
    playNotificationSound() {
        // Create a simple beep sound
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
    
    renderGrid() {
        const grid = document.getElementById('grid');
        if (!grid) return;
        
        const gridHTML = `
            <div class="grid-container">
                ${this.tables.map(table => this.getTableTileHTML(table)).join('')}
            </div>
        `;
        
        grid.innerHTML = gridHTML;
        this.attachEventListeners();
    }
    
    renderTableTile(table) {
        const existingTile = document.querySelector(`[data-table-id="${table.id}"]`);
        if (existingTile) {
            const newTileHTML = this.getTableTileHTML(table);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newTileHTML;
            const newTile = tempDiv.firstElementChild;
            
            existingTile.replaceWith(newTile);
            this.attachTileEventListeners(newTile);
        }
    }
    
    getTableTileHTML(table) {
        const statusClass = table.status === 'open' ? 'open' : 
                          table.status === 'disabled' ? 'disabled' : 
                          table.status === 'dirty' ? 'dirty' : 
                          table.status === 'occupied' ? 'occupied' : 'open';
        
        const isOccupied = table.session !== null;
        const idleTime = table.session ? this.calculateIdleTime(table.session.last_active) : '';
        
        return `
            <div class="tile ${statusClass}" data-table-id="${table.id}">
                <div class="table-number">Table ${table.number}</div>
                <div class="table-status">${table.status}</div>
                ${isOccupied ? `<div class="idle-time">${idleTime}</div>` : ''}
                
                <div class="actions">
                    ${this.getActionButtonsHTML(table)}
                </div>
            </div>
        `;
    }
    
    renderWaiterRequestsSidebar() {
        const requestsList = document.getElementById('waiter-requests-list');
        const requestCount = document.getElementById('request-count');
        
        if (!requestsList || !requestCount) return;
        
        // Update count
        requestCount.textContent = this.waiterRequests.length;
        
        if (this.waiterRequests.length === 0) {
            requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
            return;
        }
        
        // Render requests (newest first in display, but backend sends oldest first)
        const requestsHTML = this.waiterRequests.map(request => {
            if (request.type === 'pending_order') {
                // Handle pending orders with approve/reject/edit actions
                const icon = '🍽️';
                const typeClass = 'pending-order';
                const typeName = 'Pending Order';
                const timeAgo = this.calculateTimeAgo(request.created_at);
                
                // Build clean items list HTML
                const orderItemsHTML = request.items.map(item => {
                    const variationText = item.selected_variation ? ` (${item.selected_variation.variation_name})` : '';
                    const addonsArr = (item.selected_variation_addons && item.selected_variation_addons.length > 0) ? item.selected_variation_addons : (item.selected_addons || []);
                    const addonsText = addonsArr.length > 0 ? `+ ${addonsArr.map(addon => addon.name).join(', ')}` : '';
                    
                    return `
                        <div class="order-item">
                            <div class="item-details">
                                <span class="item-name">${item.name}${variationText}</span>
                                ${addonsText ? `<span class="item-addons">${addonsText}</span>` : ''}
                            </div>
                            <span class="item-quantity">×${item.qty}</span>
                        </div>
                    `;
                }).join('');
                
                // Special instructions
                const instructionsHTML = request.special_instructions ? `
                    <div class="order-notes">
                        <span class="notes-label">Note:</span>
                        <span class="notes-text">${request.special_instructions}</span>
                    </div>
                ` : '';
                
                return `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="table-info">
                                <span class="table-number">Table ${request.table_number}</span>
                                <span class="customer-name">${request.customer_name}</span>
                            </div>
                            <div class="order-meta">
                                <span class="order-total">₹${request.total.toFixed(2)}</span>
                                <span class="order-time">${timeAgo}</span>
                                <span class="order-id">#${request.order_number}</span>
                            </div>
                        </div>
                        
                        <div class="order-items">
                            ${orderItemsHTML}
                        </div>
                        
                        ${instructionsHTML}
                        
                        <div class="order-footer">
                            <div class="order-actions">
                                <button class="action-btn approve" onclick="dashboard.approveOrder('${request.order_id}')" title="Approve Order">
                                    <span class="action-icon">✓</span>
                                    <span class="action-label">Approve</span>
                                </button>
                                <button class="action-btn edit" onclick="dashboard.editOrder('${request.order_id}')" title="Edit Order">
                                    <span class="action-icon">✏️</span>
                                    <span class="action-label">Edit</span>
                                </button>
                                <button class="action-btn reject" onclick="dashboard.rejectOrder('${request.order_id}')" title="Reject Order">
                                    <span class="action-icon">✗</span>
                                    <span class="action-label">Reject</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (request.type === 'order') {
                // Handle order notifications
                const icon = '🍽️';
                const typeClass = 'new-order';
                const typeName = 'New Order';
                const timeAgo = this.calculateTimeAgo(request.created_at);
                
                // Build detailed items list HTML
                const orderItemsHTML = request.items.map(item => {
                    const variationHTML = item.selected_variation ? `
                        <div class="variation-line">(${item.selected_variation.group_name}: ${item.selected_variation.variation_name})</div>
                    ` : '';
                    const addonsArr = (item.selected_variation_addons && item.selected_variation_addons.length > 0) ? item.selected_variation_addons : (item.selected_addons || []);
                    const addonsHTML = addonsArr.length > 0 ? `
                        <ul class="addons-list">
                            ${addonsArr.map(addon => `<li>${addon.name}${addon.quantity > 1 ? ` x${addon.quantity}` : ''}</li>`).join('')}
                        </ul>
                    ` : '';
                    return `
                        <li class="order-item-line">
                            <div class="item-main"><strong>${item.name}</strong> x${item.qty}</div>
                            ${variationHTML}
                            ${addonsHTML}
                        </li>
                    `;
                }).join('');
                
                return `
                    <div class="request-card ${typeClass}">
                        <div class="request-header">
                            <div class="request-type-badge ${typeClass}">
                                <span class="request-icon">${icon}</span>
                                <span class="request-type-text">${typeName}</span>
                            </div>
                            <div class="request-time">${timeAgo}</div>
                        </div>
                        <div class="request-body order-body">
                            <div class="table-info">
                                <div class="table-details">
                                    <span class="table-label">Table ${request.table_number}</span>
                                    <span class="order-id">Order #${request.order_number}</span>
                                </div>
                                <ul class="order-items-list">${orderItemsHTML}</ul>
                            </div>
                            <button class="acknowledge-btn full-width" onclick="dashboard.acknowledgeOrder('${request.order_id}')">
                                ✓ Acknowledge
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Handle waiter requests
                const icon = request.request_type === 'call_waiter' ? '🔔' : '💰';
                const typeClass = request.request_type.replace('_', '-');
                const typeName = request.request_type === 'call_waiter' ? 'Call Waiter' : 'Ask for Bill';
                const timeAgo = this.calculateTimeAgo(request.created_at);
                
                return `
                    <div class="request-card ${typeClass}">
                        <div class="request-header">
                            <div class="request-type-badge ${typeClass}">
                                <span class="request-icon">${icon}</span>
                                <span class="request-type-text">${typeName}</span>
                            </div>
                            <div class="request-time">${timeAgo}</div>
                        </div>
                        <div class="request-body">
                            <div class="table-info">
                                <div class="table-details">
                                    <span class="table-label">Table ${request.table_number}</span>
                                    <span class="member-name">${request.member_name}</span>
                                </div>
                            </div>
                            <button class="resolve-btn" onclick="dashboard.resolveWaiterRequest('${request.id}')">
                                ✓ Resolve
                            </button>
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        requestsList.innerHTML = requestsHTML;
    }
    
    getActionButtonsHTML(table) {
        if (table.session) {
            // Table has active session - main button: Close Table, dropdown: Move Table, Get Session Info
            return `
                <div class="actions-container">
                    <button onclick="dashboard.closeTable(${table.id})" class="btn-main btn-close">Close Table</button>
                    <div class="dropdown dropdown-corner">
                        <button class="dropdown-btn dropdown-corner-btn" onclick="dashboard.toggleDropdown(event)">
                            ▼
                        </button>
                        <div class="dropdown-content">
                            <button onclick="dashboard.pickTarget(event)">Move Table</button>
                            <button onclick="dashboard.getSessionInfo(${table.id})">Get Session Info</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Table has no session - main button: Disable, dropdown: Restore
            let mainButton = '';
            if (table.status === 'open') {
                mainButton = `<button onclick="dashboard.disableTable(${table.id})" class="btn-main btn-disable">Disable</button>`;
            } else if (table.status === 'disabled' || table.status === 'dirty') {
                mainButton = `<button onclick="dashboard.enableTable(${table.id})" class="btn-main btn-enable">Enable</button>`;
            }
            
            return `
                <div class="actions-container">
                    ${mainButton}
                    <div class="dropdown dropdown-corner">
                        <button class="dropdown-btn dropdown-corner-btn" onclick="dashboard.toggleDropdown(event)">
                            ▼
                        </button>
                        <div class="dropdown-content">
                            <button onclick="dashboard.restoreTable(${table.id})">Restore</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    toggleDropdown(event) {
        event.stopPropagation();
        const dropdown = event.target.closest('.dropdown');
        const isActive = dropdown.classList.contains('active');
        
        // Close all other dropdowns
        document.querySelectorAll('.dropdown.active').forEach(d => {
            if (d !== dropdown) {
                d.classList.remove('active');
            }
        });
        
        // Toggle current dropdown
        dropdown.classList.toggle('active', !isActive);
    }
    
    async getSessionInfo(tableId) {
        try {
            this.showToast('Loading session info...', 'info');
            
            const response = await fetch(`/admin/api/session/${tableId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail?.detail || 'Failed to load session info');
            }
            
            this.showSessionModal(data);
            
        } catch (error) {
            console.error('Error fetching session info:', error);
            this.showToast('Failed to load session info: ' + error.message, 'error');
        }
    }
    
    showSessionModal(sessionData) {
        // Remove existing modal if any
        const existingModal = document.getElementById('sessionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modalHTML = `
            <div id="sessionModal" class="session-modal">
                <div class="session-modal-content">
                    <div class="session-modal-header">
                        <h2>Table ${sessionData.table_number} - Session Info</h2>
                        <button class="close-modal" onclick="dashboard.closeSessionModal()">&times;</button>
                    </div>
                    
                    ${sessionData.session ? `
                        <div class="session-info-section">
                            <h3>Session Details</h3>
                            <div class="session-info-grid">
                                <div class="session-info-card">
                                    <strong>Session ID:</strong>
                                    ${sessionData.session.session_pid}
                                </div>
                                <div class="session-info-card">
                                    <strong>Created:</strong>
                                    ${new Date(sessionData.session.created_at).toLocaleString()}
                                </div>
                                <div class="session-info-card">
                                    <strong>Last Activity:</strong>
                                    ${new Date(sessionData.session.last_activity_at).toLocaleString()}
                                </div>
                                <div class="session-info-card">
                                    <strong>Members:</strong>
                                    ${sessionData.member_count} (${sessionData.active_member_count} active)
                                </div>
                            </div>
                        </div>
                        
                        <div class="session-info-section">
                            <h3>Members (${sessionData.members.length})</h3>
                            <ul class="member-list">
                                ${sessionData.members.map(member => `
                                    <li class="member-item">
                                        <strong>${member.nickname}</strong> ${member.is_host ? '(Host)' : ''} ${!member.active ? '(Inactive)' : ''}
                                        <br><small>ID: ${member.member_pid}</small>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <div class="session-info-section">
                            <h3>Cart Items (${sessionData.cart_items.length})</h3>
                            ${sessionData.cart_items.length > 0 ? `
                                <ul class="cart-list">
                                    ${sessionData.cart_items.map(item => `
                                        <li class="cart-item">
                                            <div class="item-header">
                                                <strong>${item.menu_item_name}</strong> x${item.qty} - ₹${item.final_price ? item.final_price.toFixed(2) : item.base_price}
                                                ${item.veg_flag ? '<span class="veg-badge">🟢</span>' : '<span class="non-veg-badge">🔴</span>'}
                                            </div>
                                            ${item.selected_variation ? `
                                                <div class="variation-info">
                                                    <small><strong>Variation:</strong> ${item.selected_variation.group_name} - ${item.selected_variation.variation_name} (₹${item.selected_variation.price})</small>
                                                </div>
                                            ` : ''}
                                            ${((item.selected_variation_addons && item.selected_variation_addons.length > 0) || (item.selected_addons && item.selected_addons.length > 0)) ? `
                                                <div class="addons-info">
                                                    <small><strong>Add-ons:</strong></small>
                                                    <ul class="addon-list">
                                                        ${((item.selected_variation_addons && item.selected_variation_addons.length > 0) ? item.selected_variation_addons : item.selected_addons).map(addon => `
                                                            <li>${addon.name} x${addon.quantity} - ₹${addon.total_price}</li>
                                                        `).join('')}
                                                    </ul>
                                                </div>
                                            ` : ''}
                                            ${item.note ? `<div class="item-note"><small><strong>Note:</strong> ${item.note}</small></div>` : ''}
                                            <div class="item-meta">
                                                <small>Added by: ${sessionData.members.find(m => m.member_pid === item.member_pid)?.nickname || 'Unknown'}</small>
                                            </div>
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : '<p>No items in cart</p>'}
                        </div>
                        
                        <div class="session-info-section">
                            <h3>Orders (${sessionData.orders.length})</h3>
                            ${sessionData.orders.length > 0 ? `
                                <ul class="order-list">
                                    ${sessionData.orders.map(order => `
                                        <li class="order-item">
                                            <div class="order-header">
                                                <strong>Order ${order.order_id}</strong> - ₹${order.total_amount.toFixed ? order.total_amount.toFixed(2) : order.total_amount}
                                                ${order.status ? `<span class="order-status ${order.status}">${order.status}</span>` : ''}
                                            </div>
                                            <div class="order-meta">
                                                <small>Placed: ${new Date(order.created_at).toLocaleString()}</small>
                                                ${order.confirmed_at ? `<br><small>Confirmed: ${new Date(order.confirmed_at).toLocaleString()}</small>` : ''}
                                            </div>

                                            ${Array.isArray(order.items) && order.items.length > 0 ? `
                                                <details class="order-items-details">
                                                    <summary>View Items (${order.items.length})</summary>
                                                    <ul class="order-items-list">
                                                        ${order.items.map(oi => `
                                                            <li class="order-item-detail">
                                                                <div class="item-header">
                                                                    <strong>${oi.name}</strong> x${oi.qty} - ₹${oi.final_price ?? oi.unit_price ?? 0}
                                                                </div>
                                                                ${oi.selected_variation ? `
                                                                    <div class="variation-info">
                                                                        <small><strong>Variation:</strong> ${oi.selected_variation.group_name} - ${oi.selected_variation.variation_name} (₹${oi.selected_variation.price})</small>
                                                                    </div>
                                                                ` : ''}
                                                                ${(oi.selected_variation_addons && oi.selected_variation_addons.length > 0) || (oi.selected_addons && oi.selected_addons.length > 0) ? `
                                                                    <div class="addons-info">
                                                                        <small><strong>Add-ons:</strong></small>
                                                                        <ul class="addon-list">
                                                                            ${(oi.selected_variation_addons && oi.selected_variation_addons.length > 0 ? oi.selected_variation_addons : oi.selected_addons).map(addon => `
                                                                                 <li>${addon.name} x${addon.quantity} - ₹${addon.total_price || (addon.price * addon.quantity)}</li>
                                                                             `).join('')}
                                                                        </ul>
                                                                    </div>
                                                                ` : ''}
                                                                ${oi.note ? `<div class="item-note"><small><strong>Note:</strong> ${oi.note}</small></div>` : ''}
                                                            </li>
                                                        `).join('')}
                                                    </ul>
                                                </details>
                                            ` : ''}
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : '<p>No orders placed</p>'}
                        </div>
                        
                        <div class="session-info-section">
                            <h3>Totals</h3>
                            <div class="session-info-grid">
                                <div class="session-info-card">
                                    <strong>Cart Total:</strong>
                                    ₹${sessionData.totals.cart_total.toFixed(2)}
                                </div>
                                <div class="session-info-card">
                                    <strong>Orders Total:</strong>
                                    ₹${sessionData.totals.orders_total.toFixed(2)}
                                </div>
                                <div class="session-info-card">
                                    <strong>Grand Total:</strong>
                                    ₹${sessionData.totals.grand_total.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="session-info-section">
                            <p>No active session for this table.</p>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = document.getElementById('sessionModal');
        modal.style.display = 'block';
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSessionModal();
            }
        });
    }
    
    closeSessionModal() {
        const modal = document.getElementById('sessionModal');
        if (modal) {
            modal.remove();
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
        // Parse UTC timestamp properly
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
    
    attachEventListeners() {
        // Attach event listeners to all tiles
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => this.attachTileEventListeners(tile));
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        });
    }
    
    attachTileEventListeners(tile) {
        // Event listeners are handled via onclick attributes in HTML
        // This method can be used for additional listeners if needed
    }
    
    // Action methods
    closeTable(tableId) {
        this.sendAction('close_table', { table_id: tableId });
    }
    
    disableTable(tableId) {
        this.sendAction('disable_table', { table_id: tableId });
    }
    
    enableTable(tableId) {
        this.sendAction('enable_table', { table_id: tableId });
    }
    
    restoreTable(tableId) {
        this.sendAction('restore_table', { table_id: tableId });
    }
    
    resolveWaiterRequest(requestId) {
        // Send WebSocket message to resolve the request
        this.sendAction('resolve_waiter_request', { request_id: requestId });
        
        // Show processing feedback
        this.showToast('Resolving request...', 'info');
    }
    
    acknowledgeOrder(orderId) {
        // Send WebSocket message to acknowledge the order
        this.sendAction('acknowledge_order', { order_id: orderId });
        
        // Show processing feedback
        this.showToast('Acknowledging order...', 'info');
    }
    
    approveOrder(orderId) {
        this.sendAction('approve_order', { order_id: orderId });
        this.showToast('Sending order to kitchen...', 'info');
    }
    
    rejectOrder(orderId) {
        this.sendAction('reject_order', { order_id: orderId, reason: '' });
        this.showToast('Rejecting order...', 'info');
    }
    
    editOrder(orderId) {
        // For now, just approve the order since editing is not implemented yet
        this.approveOrder(orderId);
        
        // TODO: Implement order editing interface
        // This would involve:
        // 1. Opening a modal with the order details
        // 2. Allowing admin to add/remove items, change quantities
        // 3. Sending updated_order data with edit_order action
    }
    
    retryPOS(orderId) {
        this.sendAction('retry_pos', { order_id: orderId });
        this.showToast('Retrying POS integration...', 'info');
    }
    
    pickTarget(event) {
        // Close any open dropdowns
        document.querySelectorAll('.dropdown.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
        
        const tile = event.target.closest('.tile');
        const tableId = parseInt(tile.dataset.tableId);
        
        if (this.moveMode && this.moveSourceId === tableId) {
            // Clicking same table - cancel move
            this.exitMoveMode();
            return;
        }
        
        if (!this.moveMode) {
            // Start move mode
            this.moveMode = true;
            this.moveSourceId = tableId;
            
            // Visual feedback
            document.body.classList.add('move-mode');
            tile.classList.add('move-source');
            
            this.showToast('Select destination table or press Escape to cancel', 'info');
            
            // Add click handlers to open tables
            document.querySelectorAll('.tile.open').forEach(openTile => {
                const openTableId = parseInt(openTile.dataset.tableId);
                if (openTableId !== tableId) {
                    openTile.addEventListener('click', this.handleMoveTarget.bind(this));
                }
            });
        }
    }
    
    handleMoveTarget(event) {
        if (!this.moveMode) return;
        
        const targetTile = event.target.closest('.tile');
        const targetTableId = parseInt(targetTile.dataset.tableId);
        
        if (targetTableId === this.moveSourceId) return;
        
        // Send move action
        this.sendAction('move_table', { 
            from_table_id: this.moveSourceId, 
            to_table_id: targetTableId 
        });
        
        this.exitMoveMode();
    }
    
    handleMoveEscape(event) {
        if (event.key === 'Escape' && this.moveMode) {
            this.exitMoveMode();
        }
    }
    
    exitMoveMode() {
        this.moveMode = false;
        this.moveSourceId = null;
        
        // Remove visual feedback
        document.body.classList.remove('move-mode');
        document.querySelectorAll('.move-source').forEach(tile => {
            tile.classList.remove('move-source');
        });
        
        // Remove click handlers
        document.querySelectorAll('.tile.open').forEach(tile => {
            tile.removeEventListener('click', this.handleMoveTarget.bind(this));
        });
    }
    
    sendAction(action, params = {}) {
        const message = {
            action: action,
            ...params
        };
        
        this.send(message);
        
        // Show processing feedback
        this.showToast('Processing...', 'info');
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.showToast('Connection lost. Message will be sent when reconnected.', 'warning');
            // Don't immediately reconnect here - let the existing retry mechanism handle it
            if (this.connectionStatus === 'connected') {
                this.updateConnectionStatus('disconnected');
            }
        }
    }
    
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.updateConnectionStatus('connecting');
            this.showToast(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
            
            // Exponential backoff
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        } else {
            this.updateConnectionStatus('failed');
            this.showConnectionFailureModal();
        }
    }
    
    showConnectionFailureModal() {
        // Remove existing modal if any
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
        
        // Auto-refresh after 10 seconds if user doesn't click
        setTimeout(() => {
            window.location.reload();
        }, 10000);
    }
    
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleMoveEscape(event);
        });
        
        // Logout button
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
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);
    }
    
    logout() {
        // Clear stored data
        localStorage.removeItem('apiKey');
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        // Redirect to login
        window.location.href = '/admin/login';
    }

    // -------- QR Code Generator --------
    setupQRButton() {
        const btn = document.createElement('button');
        btn.id = 'qr-code-btn';
        btn.textContent = 'Get Table QR Code';
        // Style similar to existing #logout button
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

        // Insert inside header, before the logout button
        const header = document.querySelector('header');
        const logoutBtn = document.getElementById('logout');
        if (header) {
            if (logoutBtn) {
                header.insertBefore(btn, logoutBtn);
            } else {
                header.appendChild(btn);
            }
        } else {
            document.body.appendChild(btn); // fallback
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
                    <button style="position:absolute;top:8px;right:8px;background:none;border:none;font-size:24px;cursor:pointer;" onclick="dashboard.closeQRModal()">&times;</button>
                    <h3 style="margin-bottom:12px;">Generate Table QR Code</h3>
                    <select id="qrTableSelect" style="width:100%;padding:8px 4px;margin-bottom:12px;">${options}</select>
                    <button id="qrGenerateBtn" style="padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">Generate</button>
                    <div id="qrResult" style="margin-top:16px;"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
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

// Make functions available globally for onclick handlers
window.dashboard = dashboard;

console.log('✅ Dashboard WebSocket manager loaded'); 