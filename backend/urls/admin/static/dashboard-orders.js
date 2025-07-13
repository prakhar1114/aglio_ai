// Dashboard Order Management - Order Editing Modal and Functionality

class DashboardOrderManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentOrder = null;
        this.editedItems = [];
        this.searchResults = [];
        this.init();
    }
    
    init() {
        this.createOrderEditModalHTML();
    }
    
    createOrderEditModalHTML() {
        const modalHTML = `
            <div id="orderEditModal" class="order-edit-modal" style="display: none;">
                <div class="order-edit-modal-content">
                    <div class="order-edit-header">
                        <h2 id="orderEditTitle">Edit Order</h2>
                        <button class="close-modal" onclick="dashboard.orderManager.closeOrderEditModal()">&times;</button>
                    </div>
                    
                    <div class="order-edit-body">
                        <!-- Current Order Items -->
                        <div class="order-section">
                            <h3>Current Order Items</h3>
                            <div id="currentOrderItems" class="order-items-list">
                                <!-- Items will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Add New Items -->
                        <div class="order-section">
                            <h3>Add New Items</h3>
                            <div class="menu-search-container">
                                <input 
                                    type="text" 
                                    id="menuSearchInput" 
                                    placeholder="Search menu items..."
                                    class="menu-search-input"
                                >
                                <div id="menuSearchResults" class="menu-search-results">
                                    <!-- Search results will be populated here -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Order Summary -->
                        <div class="order-section">
                            <div class="order-summary">
                                <div class="summary-row">
                                    <span>Total Items:</span>
                                    <span id="totalItems">0</span>
                                </div>
                                <div class="summary-row total-row">
                                    <span>Total Amount:</span>
                                    <span id="totalAmount">₹0.00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="order-edit-footer">
                        <button class="btn-secondary" onclick="dashboard.orderManager.closeOrderEditModal()">Cancel</button>
                        <button class="btn-primary" onclick="dashboard.orderManager.updateAndConfirmOrder()">Update and Confirm Order</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const searchInput = document.getElementById('menuSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleMenuSearch(e.target.value);
                }, 300);
            });
        }
        
        // Close modal when clicking outside
        const modal = document.getElementById('orderEditModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeOrderEditModal();
                }
            });
        }
    }
    
    async openOrderEditModal(order) {
        this.currentOrder = order;
        this.editedItems = [...order.items]; // Clone the items array
        
        // Ensure menu is loaded
        await this.dashboard.menuManager.ensureMenuLoaded();
        
        // Update modal title
        document.getElementById('orderEditTitle').textContent = 
            `Edit Order #${order.order_number} - Table ${order.table_number}`;
        
        // Populate current order items
        this.renderCurrentOrderItems();
        
        // Clear search
        document.getElementById('menuSearchInput').value = '';
        document.getElementById('menuSearchResults').innerHTML = '';
        
        // Update summary
        this.updateOrderSummary();
        
        // Show modal
        document.getElementById('orderEditModal').style.display = 'block';
    }
    
    closeOrderEditModal() {
        document.getElementById('orderEditModal').style.display = 'none';
        this.currentOrder = null;
        this.editedItems = [];
        this.searchResults = [];
    }
    
    renderCurrentOrderItems() {
        const container = document.getElementById('currentOrderItems');
        if (!container) return;
        
        if (this.editedItems.length === 0) {
            container.innerHTML = '<p class="no-items">No items in order</p>';
            return;
        }
        
        const itemsHTML = this.editedItems.map((item, index) => {
            const menuItem = this.dashboard.menuManager.getMenuItemById(item.menu_item_id);
            const hasCustomizations = menuItem ? this.dashboard.menuManager.hasCustomizations(menuItem) : false;
            
            // Build variation display
            let variationHTML = '';
            if (item.selected_variation) {
                const variation = item.selected_variation;
                variationHTML = `
                    <div class="variation-info">
                        <span class="variation-label">${variation.variation_name || variation.display_name}</span>
                        ${variation.price > 0 ? `<span class="variation-price">+₹${variation.price}</span>` : ''}
                    </div>
                `;
            }
            
            // Build addons display
            let addonsHTML = '';
            const selectedAddons = item.selected_variation_addons || item.selected_addons || [];
            if (selectedAddons.length > 0) {
                addonsHTML = `
                    <div class="addons-info">
                        <div class="addons-label">Add-ons:</div>
                        <ul class="addon-list">
                            ${selectedAddons.map(addon => {
                                const quantity = addon.quantity || 1;
                                const totalPrice = addon.price * quantity;
                                return `
                                    <li class="addon-item">
                                        <span class="addon-name">${addon.name || addon.display_name}</span>
                                        ${quantity > 1 ? `<span class="addon-quantity"> × ${quantity}</span>` : ''}
                                        ${totalPrice > 0 ? `<span class="addon-price">+₹${totalPrice}</span>` : ''}
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                `;
            }
            
            return `
                <div class="order-item-card" data-index="${index}">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        ${variationHTML}
                        ${addonsHTML}
                        ${item.note ? `<div class="item-note">Note: ${item.note}</div>` : ''}
                        <div class="item-price">₹${item.final_price || item.unit_price}</div>
                    </div>
                    <div class="item-controls">
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="dashboard.orderManager.updateItemQuantity(${index}, ${item.qty - 1})">-</button>
                            <span class="qty-display">${item.qty}</span>
                            <button class="qty-btn" onclick="dashboard.orderManager.updateItemQuantity(${index}, ${item.qty + 1})">+</button>
                        </div>
                        <div class="item-actions">
                            ${hasCustomizations ? `
                                <button class="btn-customize" onclick="dashboard.orderManager.customizeItem(${index})">Customise</button>
                            ` : ''}
                            <button class="btn-remove" onclick="dashboard.orderManager.removeItem(${index})">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = itemsHTML;
    }
    
    async handleMenuSearch(query) {
        const resultsContainer = document.getElementById('menuSearchResults');
        if (!resultsContainer) return;
        
        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        // Ensure menu is loaded
        await this.dashboard.menuManager.ensureMenuLoaded();
        
        // Search menu
        const results = this.dashboard.menuManager.searchMenu(query);
        this.searchResults = results.slice(0, 10); // Limit to 10 results
        
        if (this.searchResults.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No items found</p>';
            return;
        }
        
        const resultsHTML = this.searchResults.map((item, index) => {
            const hasCustomizations = this.dashboard.menuManager.hasCustomizations(item);
            const imageUrl = this.dashboard.menuManager.getItemImageUrl(item);
            
            return `
                <div class="search-result-item" data-index="${index}">
                    <div class="search-item-info">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${item.name}" class="search-item-image">` : ''}
                        <div class="search-item-details">
                            <div class="search-item-name">${item.name}</div>
                            <div class="search-item-category">${item.category_brief}</div>
                            <div class="search-item-price">₹${item.base_price}</div>
                            ${item.description ? `<div class="search-item-description">${item.description}</div>` : ''}
                        </div>
                    </div>
                    <div class="search-item-actions">
                        ${hasCustomizations ? `
                            <button class="btn-customize" onclick="dashboard.orderManager.addItemWithCustomization(${index})">Customise & Add</button>
                        ` : `
                            <button class="btn-add" onclick="dashboard.orderManager.addItem(${index})">Add</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.innerHTML = resultsHTML;
    }
    
    updateItemQuantity(index, newQty) {
        if (newQty < 1) {
            this.removeItem(index);
            return;
        }
        
        this.editedItems[index].qty = newQty;
        
        // Recalculate total for this item
        const unitPrice = this.editedItems[index].final_price || this.editedItems[index].unit_price;
        this.editedItems[index].total = unitPrice * newQty;
        
        this.renderCurrentOrderItems();
        this.updateOrderSummary();
    }
    
    removeItem(index) {
        this.editedItems.splice(index, 1);
        this.renderCurrentOrderItems();
        this.updateOrderSummary();
    }
    
    addItem(searchIndex) {
        const item = this.searchResults[searchIndex];
        if (!item) return;
        
        const orderItem = {
            menu_item_id: item.id,
            menu_item_pid: item.id,
            name: item.name,
            qty: 1,
            unit_price: item.base_price,
            final_price: item.base_price,
            total: item.base_price,
            note: "",
            selected_variation: null,
            selected_addons: [],
            selected_variation_addons: []
        };
        
        this.editedItems.push(orderItem);
        this.renderCurrentOrderItems();
        this.updateOrderSummary();
        
        // Clear search
        document.getElementById('menuSearchInput').value = '';
        document.getElementById('menuSearchResults').innerHTML = '';
    }
    
    addItemWithCustomization(searchIndex) {
        const item = this.searchResults[searchIndex];
        if (!item) return;
        
        // Open customization modal for this item
        this.dashboard.customizationManager.openCustomizationModal(item, (customizedItem) => {
            this.editedItems.push(customizedItem);
            this.renderCurrentOrderItems();
            this.updateOrderSummary();
            
            // Clear search
            document.getElementById('menuSearchInput').value = '';
            document.getElementById('menuSearchResults').innerHTML = '';
        });
    }
    
    customizeItem(index) {
        const orderItem = this.editedItems[index];
        const menuItem = this.dashboard.menuManager.getMenuItemById(orderItem.menu_item_id);
        
        if (!menuItem) {
            this.dashboard.showToast('Menu item not found', 'error');
            return;
        }
        
        // Pre-populate with existing customizations
        const existingCustomizations = {
            selectedVariationId: orderItem.selected_variation?.id || null,
            selectedAddons: orderItem.selected_variation_addons || orderItem.selected_addons || [],
            qty: orderItem.qty,
            note: orderItem.note || ""
        };
        
        this.dashboard.customizationManager.openCustomizationModal(menuItem, (customizedItem) => {
            this.editedItems[index] = customizedItem;
            this.renderCurrentOrderItems();
            this.updateOrderSummary();
        }, existingCustomizations);
    }
    
    updateOrderSummary() {
        const totalItems = this.editedItems.reduce((sum, item) => sum + item.qty, 0);
        const totalAmount = this.editedItems.reduce((sum, item) => sum + (item.total || (item.final_price || item.unit_price) * item.qty), 0);
        
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;
    }
    
    async updateAndConfirmOrder() {
        if (this.editedItems.length === 0) {
            this.dashboard.showToast('Cannot update order with no items', 'error');
            return;
        }
        
        const totalAmount = this.editedItems.reduce((sum, item) => sum + (item.total || (item.final_price || item.unit_price) * item.qty), 0);
        
        const updatedOrder = {
            items: this.editedItems,
            total: totalAmount,
            special_instructions: this.currentOrder.special_instructions || ""
        };
        
        // Send the edit_order action via WebSocket
        this.dashboard.sendAction('edit_order', {
            order_id: this.currentOrder.order_id,
            updated_order: updatedOrder
        });
        
        // Close modal
        this.closeOrderEditModal();
        
        // Show processing message
        this.dashboard.showToast('Updating order...', 'info');
    }
    
    // Helper method to calculate item pricing with customizations
    calculateItemPrice(menuItem, selectedVariation, selectedAddons, qty) {
        let basePrice = menuItem.base_price;
        
        // Add variation price
        if (selectedVariation) {
            basePrice += selectedVariation.price;
        }
        
        // Add addons price
        if (selectedAddons && selectedAddons.length > 0) {
            selectedAddons.forEach(addon => {
                basePrice += addon.price * (addon.quantity || 1);
            });
        }
        
        return {
            unitPrice: basePrice,
            totalPrice: basePrice * qty
        };
    }
}

// Initialize order manager when dashboard is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.dashboard) {
        window.dashboard.orderManager = new DashboardOrderManager(window.dashboard);
    }
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is ready
    if (window.dashboard) {
        window.dashboard.orderManager = new DashboardOrderManager(window.dashboard);
    }
} 