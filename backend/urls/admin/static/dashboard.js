// Admin Dashboard WebSocket Implementation

class DashboardManager {
    constructor() {
        this.ws = null;
        this.apiKey = null;
        this.tables = [];
        this.waiterRequests = []; // Store waiter requests as array, ordered by oldest first
        this.moveMode = false;
        this.moveSourceId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 1000; // Start with 1 second
        
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
        
        this.connect();
        this.setupEventListeners();
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/admin/ws/dashboard?token=${encodeURIComponent(this.apiKey)}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Dashboard WebSocket connected');
                this.reconnectAttempts = 0;
                this.reconnectInterval = 1000;
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 Dashboard WebSocket disconnected:', event.code, event.reason);
                this.handleDisconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ Dashboard WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.handleDisconnect();
        }
    }
    
    handleMessage(message) {
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
                                            <strong>${item.menu_item_name}</strong> x${item.qty} - ₹${item.price.toFixed ? item.price.toFixed(2) : item.price}
                                            ${item.note ? `<br><small>Note: ${item.note}</small>` : ''}
                                            <br><small>Added by: ${sessionData.members.find(m => m.member_pid === item.member_pid)?.nickname || 'Unknown'}</small>
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
                                            <strong>Order ${order.order_id}</strong> - ₹${order.total_amount.toFixed ? order.total_amount.toFixed(2) : order.total_amount}
                                            <br><small>Placed: ${new Date(order.created_at).toLocaleString()}</small>
                                            ${order.pay_method ? `<br><small>Payment: ${order.pay_method}</small>` : ''}

                                            ${Array.isArray(order.items) && order.items.length > 0 ? `
                                                <details class="order-items-details">
                                                    <summary>View Items (${order.items.length})</summary>
                                                    <ul class="order-items-list">
                                                        ${order.items.map(oi => `
                                                            <li>
                                                                ${oi.name} x${oi.qty} - ₹${oi.price ?? oi.unit_price ?? 0}
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
            this.showToast('Connection lost. Reconnecting...', 'error');
            this.connect();
        }
    }
    
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.showToast(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
            
            // Exponential backoff
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        } else {
            this.showToast('Connection failed. Please refresh the page.', 'error');
        }
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
        }, 3000);
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
}

// Global instance
const dashboard = new DashboardManager();

// Make functions available globally for onclick handlers
window.dashboard = dashboard;

console.log('✅ Dashboard WebSocket manager loaded'); 