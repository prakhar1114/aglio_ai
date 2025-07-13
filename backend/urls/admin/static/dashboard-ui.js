// Dashboard UI Management - Table Grid and Waiter Requests Rendering

// Add UI rendering methods to DashboardManager prototype
DashboardManager.prototype.renderGrid = function() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    
    const gridHTML = `
        <div class="grid-container">
            ${this.tables.map(table => this.getTableTileHTML(table)).join('')}
        </div>
    `;
    
    grid.innerHTML = gridHTML;
    this.attachEventListeners();
};

DashboardManager.prototype.renderTableTile = function(table) {
    const existingTile = document.querySelector(`[data-table-id="${table.id}"]`);
    if (existingTile) {
        const newTileHTML = this.getTableTileHTML(table);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newTileHTML;
        const newTile = tempDiv.firstElementChild;
        
        existingTile.replaceWith(newTile);
        this.attachTileEventListeners(newTile);
    }
};

DashboardManager.prototype.getTableTileHTML = function(table) {
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
};

DashboardManager.prototype.renderWaiterRequestsSidebar = function() {
    const requestsList = document.getElementById('waiter-requests-list');
    const requestCount = document.getElementById('request-count');
    
    if (!requestsList || !requestCount) return;
    
    // Update count
    requestCount.textContent = this.waiterRequests.length;
    
    if (this.waiterRequests.length === 0) {
        requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
        return;
    }
    
    // Render requests
    const requestsHTML = this.waiterRequests.map(request => {
        if (request.type === 'pending_order') {
            return this.renderPendingOrderCard(request);
        } else if (request.type === 'order') {
            return this.renderOrderNotificationCard(request);
        } else {
            return this.renderWaiterRequestCard(request);
        }
    }).join('');
    
    requestsList.innerHTML = requestsHTML;
};

DashboardManager.prototype.renderPendingOrderCard = function(request) {
    const timeAgo = this.calculateTimeAgo(request.created_at);
    
    // Build clean items list HTML
    const orderItemsHTML = request.items.map(item => {
        const variationText = item.selected_variation ? ` (${item.selected_variation.variation_name})` : '';
        const addonsArr = (item.selected_variation_addons && item.selected_variation_addons.length > 0) ? item.selected_variation_addons : (item.selected_addons || []);
        const addonsText = addonsArr.length > 0 ? `+ ${addonsArr.map(addon => {
            const quantity = addon.quantity > 1 ? ` x${addon.quantity}` : '';
            return `${addon.name}${quantity}`;
        }).join(', ')}` : '';
        
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
};

DashboardManager.prototype.renderOrderNotificationCard = function(request) {
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
        <div class="request-card new-order">
            <div class="request-header">
                <div class="request-type-badge new-order">
                    <span class="request-icon">🍽️</span>
                    <span class="request-type-text">New Order</span>
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
};

DashboardManager.prototype.renderWaiterRequestCard = function(request) {
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
};

DashboardManager.prototype.getActionButtonsHTML = function(table) {
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
};

DashboardManager.prototype.attachEventListeners = function() {
    // Attach event listeners to all tiles
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => this.attachTileEventListeners(tile));
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });
};

DashboardManager.prototype.attachTileEventListeners = function(tile) {
    // Event listeners are handled via onclick attributes in HTML
    // This method can be used for additional listeners if needed
};

// Table action methods
DashboardManager.prototype.closeTable = function(tableId) {
    this.sendAction('close_table', { table_id: tableId });
};

DashboardManager.prototype.disableTable = function(tableId) {
    this.sendAction('disable_table', { table_id: tableId });
};

DashboardManager.prototype.enableTable = function(tableId) {
    this.sendAction('enable_table', { table_id: tableId });
};

DashboardManager.prototype.restoreTable = function(tableId) {
    this.sendAction('restore_table', { table_id: tableId });
};

DashboardManager.prototype.resolveWaiterRequest = function(requestId) {
    this.sendAction('resolve_waiter_request', { request_id: requestId });
    this.showToast('Resolving request...', 'info');
};

DashboardManager.prototype.acknowledgeOrder = function(orderId) {
    this.sendAction('acknowledge_order', { order_id: orderId });
    this.showToast('Acknowledging order...', 'info');
};

DashboardManager.prototype.approveOrder = function(orderId) {
    this.sendAction('approve_order', { order_id: orderId });
    this.showToast('Sending order to kitchen...', 'info');
};

DashboardManager.prototype.rejectOrder = function(orderId) {
    this.sendAction('reject_order', { order_id: orderId, reason: '' });
    this.showToast('Rejecting order...', 'info');
};

DashboardManager.prototype.editOrder = function(orderId) {
    // Find the order in waiter requests
    const order = this.waiterRequests.find(req => req.order_id === orderId);
    if (!order) {
        this.showToast('Order not found', 'error');
        return;
    }
    
    // Open order edit modal
    if (this.orderManager) {
        this.orderManager.openOrderEditModal(order);
    } else {
        this.showToast('Order editing not available', 'error');
    }
};

DashboardManager.prototype.retryPOS = function(orderId) {
    this.sendAction('retry_pos', { order_id: orderId });
    this.showToast('Retrying POS integration...', 'info');
};

// Table move functionality
DashboardManager.prototype.toggleDropdown = function(event) {
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
};

DashboardManager.prototype.pickTarget = function(event) {
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
};

DashboardManager.prototype.handleMoveTarget = function(event) {
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
};

DashboardManager.prototype.exitMoveMode = function() {
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
};

// Session info modal
DashboardManager.prototype.getSessionInfo = function(tableId) {
    this.showToast('Loading session info...', 'info');
    
    fetch(`/admin/api/session/${tableId}`, {
        headers: {
            'Authorization': `Bearer ${this.apiKey}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success !== false) {
            this.showSessionModal(data);
        } else {
            throw new Error(data.detail?.detail || 'Failed to load session info');
        }
    })
    .catch(error => {
        console.error('Error fetching session info:', error);
        this.showToast('Failed to load session info: ' + error.message, 'error');
    });
};

DashboardManager.prototype.showSessionModal = function(sessionData) {
    // Remove existing modal if any
    const existingModal = document.getElementById('sessionModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML (simplified version)
    const modalHTML = `
        <div id="sessionModal" class="session-modal">
            <div class="session-modal-content">
                <div class="session-modal-header">
                    <h2>Table ${sessionData.table_number} - Session Info</h2>
                    <button class="close-modal" onclick="dashboard.closeSessionModal()">&times;</button>
                </div>
                <div class="session-modal-body">
                    ${sessionData.session ? `
                        <div class="session-info">
                            <p><strong>Session ID:</strong> ${sessionData.session.session_pid}</p>
                            <p><strong>Created:</strong> ${new Date(sessionData.session.created_at).toLocaleString()}</p>
                            <p><strong>Members:</strong> ${sessionData.member_count}</p>
                            <p><strong>Cart Items:</strong> ${sessionData.cart_items.length}</p>
                            <p><strong>Orders:</strong> ${sessionData.orders.length}</p>
                        </div>
                    ` : '<p>No active session for this table.</p>'}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('sessionModal');
    modal.style.display = 'block';
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            this.closeSessionModal();
        }
    });
};

DashboardManager.prototype.closeSessionModal = function() {
    const modal = document.getElementById('sessionModal');
    if (modal) {
        modal.remove();
    }
}; 