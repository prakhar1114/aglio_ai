// Dashboard Customization Manager - Item Variations and Addons

class DashboardCustomizationManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentItem = null;
        this.customizationData = {
            selectedVariationId: null,
            selectedAddons: [],
            qty: 1,
            note: ""
        };
        this.onConfirmCallback = null;
        this.init();
    }
    
    init() {
        this.createCustomizationModalHTML();
    }
    
    createCustomizationModalHTML() {
        const modalHTML = `
            <div id="customizationModal" class="customization-modal-overlay" style="display: none;">
                <div class="customization-modal-content">
                    <div class="customization-header">
                        <h2 id="customizationTitle">Customize Item</h2>
                        <button class="close-modal" onclick="dashboard.customizationManager.closeCustomizationModal()">&times;</button>
                    </div>
                    
                    <div class="customization-body">
                        <div class="quantity-section">
                            <label>Quantity</label>
                            <div class="quantity-controls">
                                <button class="qty-btn" onclick="dashboard.customizationManager.updateQuantity(dashboard.customizationManager.customizationData.qty - 1)">-</button>
                                <span class="qty-display" id="itemQty">1</span>
                                <button class="qty-btn" onclick="dashboard.customizationManager.updateQuantity(dashboard.customizationManager.customizationData.qty + 1)">+</button>
                            </div>
                        </div>
                        
                        <div id="customizationContent">
                            <!-- Customization options will be populated here -->
                        </div>
                        
                        <div class="special-instructions">
                            <textarea 
                                id="specialInstructions" 
                                placeholder="Special instructions (optional)..."
                                rows="2"
                                onchange="dashboard.customizationManager.updateNote(this.value)"
                            ></textarea>
                        </div>
                    </div>
                    
                    <div class="customization-footer">
                        <button class="btn-cancel" onclick="dashboard.customizationManager.closeCustomizationModal()">Cancel</button>
                        <button class="btn-confirm" onclick="dashboard.customizationManager.confirmCustomization()">
                            <span id="confirmText">Confirm</span>
                            <span class="price-display">₹<span id="totalPrice">0.00</span></span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Close modal when clicking outside
        const modal = document.getElementById('customizationModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeCustomizationModal();
                }
            });
        }
    }
    
    openCustomizationModal(menuItem, onConfirmCallback, existingCustomizations = null) {
        this.currentItem = menuItem;
        this.onConfirmCallback = onConfirmCallback;
        
        // Initialize customization data
        this.customizationData = {
            selectedVariationId: existingCustomizations?.selectedVariationId || null,
            selectedAddons: existingCustomizations?.selectedAddons || [],
            qty: existingCustomizations?.qty || 1,
            note: existingCustomizations?.note || ""
        };
        
        // Update modal title
        document.getElementById('customizationTitle').textContent = `Customize ${menuItem.name}`;
        
        // Render customization options
        this.renderCustomizationOptions();
        
        // Update pricing
        this.updatePricing();
        
        // Populate special instructions
        const specialInstructionsElement = document.getElementById('specialInstructions');
        if (specialInstructionsElement) {
            specialInstructionsElement.value = this.customizationData.note;
        }
        
        // Show modal
        document.getElementById('customizationModal').style.display = 'block';
    }
    
    closeCustomizationModal() {
        document.getElementById('customizationModal').style.display = 'none';
        this.currentItem = null;
        this.onConfirmCallback = null;
        this.customizationData = {
            selectedVariationId: null,
            selectedAddons: [],
            qty: 1,
            note: ""
        };
    }
    
    renderCustomizationOptions() {
        const container = document.getElementById('customizationContent');
        if (!container || !this.currentItem) return;
        
        let html = '';
        
        // Item description
        if (this.currentItem.description) {
            html += `
                <div class="item-description">
                    <p>${this.currentItem.description}</p>
                </div>
            `;
        }
        
        // Variation groups
        if (this.currentItem.variation_groups && this.currentItem.variation_groups.length > 0) {
            this.currentItem.variation_groups.forEach(group => {
                html += `
                    <div class="customization-section">
                        <h3>${group.display_name}</h3>
                        <div class="variation-options">
                            ${group.variations.map(variation => `
                                <label class="variation-option">
                                    <input 
                                        type="radio" 
                                        name="variation_${group.group_name}"
                                        value="${variation.id}"
                                        ${this.customizationData.selectedVariationId === variation.id ? 'checked' : ''}
                                        onchange="dashboard.customizationManager.selectVariation(${variation.id})"
                                    >
                                    <span class="variation-label">
                                        <span class="variation-name">${variation.display_name}</span>
                                        <span class="variation-price">₹${variation.price}</span>
                                    </span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
        }
        
        // Addon groups (considering variation overrides)
        const activeAddonGroups = this.getActiveAddonGroups();
        if (activeAddonGroups.length > 0) {
            activeAddonGroups.forEach(group => {
                html += `
                    <div class="customization-section">
                        <h3>${group.display_name}</h3>
                        ${group.min_selection > 0 || group.max_selection > 0 ? `
                            <p class="addon-constraints">
                                ${group.min_selection > 0 ? `Min ${group.min_selection}` : ''}
                                ${group.min_selection > 0 && group.max_selection > group.min_selection ? ', ' : ''}
                                ${group.max_selection > group.min_selection ? `Max ${group.max_selection}` : ''}
                            </p>
                        ` : ''}
                        <div class="addon-options">
                            ${group.addons.map(addon => {
                                const isSelected = this.isAddonSelected(addon.id);
                                const quantity = this.getAddonQuantity(addon.id);
                                
                                return `
                                    <div class="addon-option">
                                        <label class="addon-checkbox">
                                            <input 
                                                type="checkbox" 
                                                value="${addon.id}"
                                                ${isSelected ? 'checked' : ''}
                                                onchange="dashboard.customizationManager.toggleAddon(${addon.id})"
                                            >
                                            <span class="addon-label">
                                                <span class="addon-name">${addon.display_name}</span>
                                                <span class="addon-price">₹${addon.price}</span>
                                            </span>
                                        </label>
                                        ${isSelected ? `
                                            <div class="addon-quantity">
                                                <button class="qty-btn" onclick="dashboard.customizationManager.updateAddonQuantity(${addon.id}, ${quantity - 1})">-</button>
                                                <span class="qty-display">${quantity}</span>
                                                <button class="qty-btn" onclick="dashboard.customizationManager.updateAddonQuantity(${addon.id}, ${quantity + 1})">+</button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            });
        }
        

        
        container.innerHTML = html;
    }
    
    getActiveAddonGroups() {
        if (!this.currentItem) return [];
        
        // Check if selected variation overrides addon groups
        if (this.customizationData.selectedVariationId) {
            const selectedVariation = this.findVariationById(this.customizationData.selectedVariationId);
            if (selectedVariation && selectedVariation.addon_groups && selectedVariation.addon_groups.length > 0) {
                return selectedVariation.addon_groups;
            }
        }
        
        // Fallback to item-level addon groups
        return this.currentItem.addon_groups || [];
    }
    
    findVariationById(variationId) {
        if (!this.currentItem.variation_groups) return null;
        
        for (const group of this.currentItem.variation_groups) {
            const variation = group.variations.find(v => v.id === variationId);
            if (variation) return variation;
        }
        
        return null;
    }
    
    selectVariation(variationId) {
        this.customizationData.selectedVariationId = variationId;
        
        // Clear addons that are no longer available with this variation
        const activeGroups = this.getActiveAddonGroups();
        const allowedAddonIds = activeGroups.flatMap(g => g.addons.map(a => a.id));
        
        this.customizationData.selectedAddons = this.customizationData.selectedAddons.filter(addon =>
            allowedAddonIds.includes(addon.addon_group_item_id)
        );
        
        this.renderCustomizationOptions();
        this.updatePricing();
    }
    
    toggleAddon(addonId) {
        const existingIndex = this.customizationData.selectedAddons.findIndex(
            addon => addon.addon_group_item_id === addonId
        );
        
        if (existingIndex >= 0) {
            this.customizationData.selectedAddons.splice(existingIndex, 1);
        } else {
            this.customizationData.selectedAddons.push({
                addon_group_item_id: addonId,
                quantity: 1
            });
        }
        
        this.renderCustomizationOptions();
        this.updatePricing();
    }
    
    updateAddonQuantity(addonId, newQuantity) {
        if (newQuantity <= 0) {
            this.customizationData.selectedAddons = this.customizationData.selectedAddons.filter(
                addon => addon.addon_group_item_id !== addonId
            );
        } else {
            const existingIndex = this.customizationData.selectedAddons.findIndex(
                addon => addon.addon_group_item_id === addonId
            );
            
            if (existingIndex >= 0) {
                this.customizationData.selectedAddons[existingIndex].quantity = newQuantity;
            } else {
                this.customizationData.selectedAddons.push({
                    addon_group_item_id: addonId,
                    quantity: newQuantity
                });
            }
        }
        
        this.renderCustomizationOptions();
        this.updatePricing();
    }
    
    updateQuantity(newQty) {
        if (newQty < 1) return;
        
        this.customizationData.qty = newQty;
        this.renderCustomizationOptions();
        this.updatePricing();
    }
    
    updateNote(note) {
        this.customizationData.note = note;
    }
    
    isAddonSelected(addonId) {
        return this.customizationData.selectedAddons.some(addon => addon.addon_group_item_id === addonId);
    }
    
    getAddonQuantity(addonId) {
        const addon = this.customizationData.selectedAddons.find(addon => addon.addon_group_item_id === addonId);
        return addon ? addon.quantity : 0;
    }
    
    updatePricing() {
        if (!this.currentItem) return;
        
        let unitPrice = this.currentItem.base_price;
        
        // Add variation price
        if (this.customizationData.selectedVariationId) {
            const selectedVariation = this.findVariationById(this.customizationData.selectedVariationId);
            if (selectedVariation) {
                unitPrice += selectedVariation.price;
            }
        }
        
        // Add addons price
        const activeGroups = this.getActiveAddonGroups();
        this.customizationData.selectedAddons.forEach(selectedAddon => {
            activeGroups.forEach(group => {
                const addon = group.addons.find(a => a.id === selectedAddon.addon_group_item_id);
                if (addon) {
                    unitPrice += addon.price * selectedAddon.quantity;
                }
            });
        });
        
        const totalPrice = unitPrice * this.customizationData.qty;
        
        const itemQtyElement = document.getElementById('itemQty');
        const totalPriceElement = document.getElementById('totalPrice');
        
        if (itemQtyElement) {
            itemQtyElement.textContent = this.customizationData.qty;
        }
        
        if (totalPriceElement) {
            totalPriceElement.textContent = totalPrice.toFixed(2);
        }
    }
    
    confirmCustomization() {
        if (!this.currentItem || !this.onConfirmCallback) return;
        
        // Calculate final pricing
        let unitPrice = this.currentItem.base_price;
        let selectedVariation = null;
        let selectedAddons = [];
        
        // Process variation
        if (this.customizationData.selectedVariationId) {
            selectedVariation = this.findVariationById(this.customizationData.selectedVariationId);
            if (selectedVariation) {
                unitPrice += selectedVariation.price;
            }
        }
        
        // Process addons
        const activeGroups = this.getActiveAddonGroups();
        this.customizationData.selectedAddons.forEach(selectedAddon => {
            activeGroups.forEach(group => {
                const addon = group.addons.find(a => a.id === selectedAddon.addon_group_item_id);
                if (addon) {
                    unitPrice += addon.price * selectedAddon.quantity;
                    selectedAddons.push({
                        id: addon.id,
                        name: addon.display_name,
                        price: addon.price,
                        quantity: selectedAddon.quantity,
                        total_price: addon.price * selectedAddon.quantity
                    });
                }
            });
        });
        
        // Create the customized item
        const customizedItem = {
            menu_item_id: this.currentItem.id,
            menu_item_pid: this.currentItem.id,
            name: this.currentItem.name,
            qty: this.customizationData.qty,
            unit_price: unitPrice,
            final_price: unitPrice,
            total: unitPrice * this.customizationData.qty,
            note: this.customizationData.note,
            selected_variation: selectedVariation ? {
                id: selectedVariation.id,
                variation_name: selectedVariation.display_name,
                group_name: selectedVariation.group_name,
                price: selectedVariation.price
            } : null,
            selected_addons: selectedAddons,
            selected_variation_addons: selectedAddons // For compatibility
        };
        
        // Call the callback with the customized item
        this.onConfirmCallback(customizedItem);
        
        // Close modal
        this.closeCustomizationModal();
    }
}

// Initialize customization manager when dashboard is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.dashboard) {
        window.dashboard.customizationManager = new DashboardCustomizationManager(window.dashboard);
    }
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is ready
    if (window.dashboard) {
        window.dashboard.customizationManager = new DashboardCustomizationManager(window.dashboard);
    }
} 