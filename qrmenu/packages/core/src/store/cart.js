import { create } from 'zustand';
import { useSessionStore } from './session.js';
import { generateShortId } from '../utils/general.js';
import { getActiveAddonGroups } from '../utils/variationAddons.js';

// Helper to normalise addon arrays coming from backend so UI can rely on a single key
const mergeAddonArrays = (item) => {
  if (!item) return item;
  const variationArray = item.selected_variation_addons || [];
  const baseArray = item.selected_addons || [];
  const merged = (variationArray.length > 0) ? variationArray : baseArray;

  return {
    ...item,
    selected_addons: merged,
    selected_addons_request: merged.map((a) => ({
      addon_group_item_id: a.addon_group_item_id || a.id,
      quantity: a.quantity || 1,
    })),
  };
};

export const useCartStore = create((set, get) => ({
  // Cart data - new shared cart structure
  items: [], // Array of CartItem objects
  orders: [], // Array of completed orders
  cart_version: 0, // Overall cart version for optimistic locking
  
  // UI state
  isPasswordRequired: false,
  pendingMutations: [], // Queue for mutations when password is required
  
  // Order processing state
  cartLocked: false, // Indicates if cart is locked during order processing
  pendingOrderId: null, // Tracks order being processed
  orderProcessingStatus: 'idle', // 'idle' | 'processing' | 'confirmed' | 'failed'
  lockedByMember: null, // Member PID who initiated the order
  orderTimeout: null, // Timeout ID for order processing
  
  // Item customisation state
  isCustomisationOpen: false,
  customisationMode: null, // 'add' | 'replace'
  currentActiveItem: null,
  customisationData: {
    qty: 1,
    note: '',
    selectedVariationId: null,
    selectedAddons: [], // Array of {addon_id, quantity}
    tmpId: null,
    cartItemId: null,
    version: null,
  },
  
  // Legacy filter state (keep for backward compatibility)
  filters: {},
  
  // Order processing methods
  lockCart: (orderData = {}) => {
    const sessionStore = useSessionStore?.getState();
    const memberPid = sessionStore?.memberPid;
    
    set({
      cartLocked: true,
      orderProcessingStatus: 'processing',
      pendingOrderId: orderData.orderId || null,
      lockedByMember: orderData.lockedByMember || memberPid,  // Use the member who actually initiated the order
    });
    
    // Set timeout for order processing (10 seconds)
    const timeoutId = setTimeout(() => {
      const state = get();
      if (state.orderProcessingStatus === 'processing') {
        console.warn('Order processing timed out');
        get().handleOrderTimeout();
      }
    }, 10000);
    
    set({ orderTimeout: timeoutId });
  },
  
  unlockCart: () => {
    const state = get();
    if (state.orderTimeout) {
      clearTimeout(state.orderTimeout);
    }
    
    set({
      cartLocked: false,
      orderProcessingStatus: 'idle',
      pendingOrderId: null,
      lockedByMember: null,
      orderTimeout: null,
    });
  },
  
  setOrderProcessingStatus: (status) => {
    set({ orderProcessingStatus: status });
  },
  
  setPendingOrder: (orderId) => {
    set({ pendingOrderId: orderId });
  },
  
  clearPendingOrder: () => {
    set({ pendingOrderId: null });
  },
  
  handleOrderTimeout: () => {
    // Clear any existing timeout
    const state = get();
    if (state.orderTimeout) {
      clearTimeout(state.orderTimeout);
    }

    // Unlock cart immediately so user can retry
    set({
      orderProcessingStatus: 'failed',
      orderTimeout: null,
      cartLocked: false,
      lockedByMember: null,
    });
  },
  
  handleOrderSuccess: (orderData) => {
    const state = get();
    if (state.orderTimeout) {
      clearTimeout(state.orderTimeout);
    }
    
    // Add the confirmed order to orders list
    const confirmedOrder = {
      id: orderData.id,
      orderNumber: orderData.orderNumber || orderData.order_id || (() => {
        // Extract the hex part from order ID (e.g., "ORD-1-A1B2" -> "A1B2")
        const parts = orderData.id.split('-');
        const hexPart = parts[parts.length - 1];
        return parseInt(hexPart, 16) || Date.now();
      })(),
      timestamp: new Date(orderData.timestamp || Date.now()),
      items: orderData.items || [],
      total: orderData.total || 0,
      initiated_by: orderData.initiated_by,
      status: orderData.status
    };
    
    set((state) => ({
      orderProcessingStatus: orderData.status,
      pendingOrderId: orderData.id,
      orderTimeout: null,
      orders: [confirmedOrder, ...state.orders], // Add to beginning of orders list
      items: [], // Clear the cart completely
      // Unlock cart immediately after success
      cartLocked: false,
      lockedByMember: null
    }));
  },
  
  handleOrderFailure: (error) => {
    const state = get();
    if (state.orderTimeout) {
      clearTimeout(state.orderTimeout);
    }
    
    set({
      orderProcessingStatus: 'failed',
      orderTimeout: null,
      // Unlock cart on failure so user can retry
      cartLocked: false,
      lockedByMember: null
    });
    
    console.error('Order failed:', error);
  },
  
  // Check if cart operations are allowed
  isCartEditable: () => {
    const state = get();
    return !state.cartLocked;
  },
  
  // Cart methods - new shared cart API with addon/variation support
  addItemOptimistic: (menuItem, qty, note, tmpId, selectedVariationId = null, selectedAddons = []) => {
    const state = get();
    if (!state.isCartEditable()) {
      console.warn('Cannot add item: cart is locked during order processing');
      return;
    }
    
    const sessionStore = useSessionStore?.getState();
    const memberPid = sessionStore?.memberPid;
    
    if (!memberPid) {
      console.error('No member PID available for cart operation');
      return;
    }
    
    set((state) => {
      const newItem = {
        public_id: tmpId || generateShortId(), // Use tmpId or generate one
        member_pid: memberPid,
        menu_item_pid: menuItem.id, // Use dish.id which corresponds to menu_item.public_id
        name: menuItem.name,
        base_price: menuItem.price,
        final_price: (() => {
          const base = menuItem.price || 0;
          let variationPrice = 0;
          if (selectedVariationId) {
            for (const vg of (menuItem.variation_groups || [])) {
              const v = vg.variations.find((vr) => vr.id === selectedVariationId);
              if (v) variationPrice = v.price;
            }
          }
          const activeGroups = getActiveAddonGroups(menuItem, selectedVariationId);
          const addonsPrice = (selectedAddons || []).reduce((acc, { addon_group_item_id, quantity }) => {
            for (const ag of activeGroups) {
              const a = ag.addons.find((ad) => ad.id === addon_group_item_id);
              if (a) return acc + (a.price * quantity);
            }
            return acc;
          }, 0);
          return base + variationPrice + addonsPrice;
        })(),
        image_url: menuItem.image_url || null, // Include image_url for cart display
        qty,
        note: note || '',
        version: 1,
        tmpId: tmpId, // Track temporary ID for optimistic updates
        // Store request data for WebSocket mutations
        selected_variation_id: selectedVariationId,
        selected_addons_request: selectedAddons,
        selected_variation: (() => {
          if (!selectedVariationId) return null;
          for (const vg of (menuItem.variation_groups || [])) {
            const v = vg.variations.find((vr) => vr.id === selectedVariationId);
            if (v) {
              return {
                group_name: vg.display_name,
                variation_name: v.display_name,
                item_variation_id: selectedVariationId,
                price: v.price,
              };
            }
          }
          return null;
        })(),
        selected_addons: (() => {
          const list = [];
          if (!selectedAddons || selectedAddons.length === 0) return list;
          const activeGroupsLocal = getActiveAddonGroups(menuItem, selectedVariationId);
          selectedAddons.forEach(({ addon_group_item_id, quantity }) => {
            for (const ag of activeGroupsLocal) {
              const a = ag.addons.find((ad) => ad.id === addon_group_item_id);
              if (a) list.push({ addon_group_item_id, name: a.display_name, quantity, price: a.price });
            }
          });
          return list;
        })()
      };
      
      return {
        items: [...state.items, newItem]
      };
    });
  },
  
  updateItemOptimistic: (public_id, qty, note, version) => {
    const state = get();
    if (!state.isCartEditable()) {
      console.warn('Cannot update item: cart is locked during order processing');
      return;
    }
    
    set((state) => {
      const itemIndex = state.items.findIndex(item => item.public_id === public_id);
      if (itemIndex === -1) return state;
      
      const updatedItems = [...state.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        qty,
        note: note || updatedItems[itemIndex].note,
        version: version + 1 // Increment version for optimistic update
      };
      console.log('updatedItems ', updatedItems); 
      
      return { items: updatedItems };
    });
  },

  replaceItemOptimistic: (public_id, menuItem, qty, note, version, selectedVariationId = null, selectedAddons = []) => {
    const state = get();
    if (!state.isCartEditable()) {
      console.warn('Cannot replace item: cart is locked during order processing');
      return;
    }
    
    set((state) => {
      const itemIndex = state.items.findIndex(item => item.public_id === public_id);
      if (itemIndex === -1) return state;
      
      const updatedItems = [...state.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        menu_item_pid: menuItem.id,
        name: menuItem.name,
        base_price: menuItem.price,
        final_price: (() => {
          const base = menuItem.price || 0;
          let variationPrice = 0;
          if (selectedVariationId) {
            for (const vg of (menuItem.variation_groups || [])) {
              const v = vg.variations.find((vr) => vr.id === selectedVariationId);
              if (v) variationPrice = v.price;
            }
          }
          const activeGroups = getActiveAddonGroups(menuItem, selectedVariationId);
          const addonsPrice = (selectedAddons || []).reduce((acc, { addon_group_item_id, quantity }) => {
            for (const ag of activeGroups) {
              const a = ag.addons.find((ad) => ad.id === addon_group_item_id);
              if (a) return acc + (a.price * quantity);
            }
            return acc;
          }, 0);
          return base + variationPrice + addonsPrice;
        })(),
        qty,
        note: note || '',
        version: version + 1, // Increment version for optimistic update
        selected_variation_id: selectedVariationId,
        selected_addons_request: selectedAddons,
        selected_variation: (() => {
          if (!selectedVariationId) return null;
          for (const vg of (menuItem.variation_groups || [])) {
            const v = vg.variations.find((vr) => vr.id === selectedVariationId);
            if (v) {
              return {
                group_name: vg.display_name,
                variation_name: v.display_name,
                item_variation_id: selectedVariationId,
                price: v.price,
              };
            }
          }
          return null;
        })(),
        selected_addons: (() => {
          const list = [];
          if (!selectedAddons || selectedAddons.length === 0) return list;
          const activeGroupsLocal = getActiveAddonGroups(menuItem, selectedVariationId);
          selectedAddons.forEach(({ addon_group_item_id, quantity }) => {
            for (const ag of activeGroupsLocal) {
              const a = ag.addons.find((ad) => ad.id === addon_group_item_id);
              if (a) list.push({ addon_group_item_id, name: a.display_name, quantity, price: a.price });
            }
          });
          return list;
        })()
      };
      
      return { items: updatedItems };
    });
  },
  
  deleteItemOptimistic: (public_id, version) => {
    const state = get();
    if (!state.isCartEditable()) {
      console.warn('Cannot delete item: cart is locked during order processing');
      return;
    }
    
    set((state) => ({
      items: state.items.filter(item => item.public_id !== public_id)
    }));
  },
  
  // Real-time sync methods
  applyCartUpdate: (update) => {
    set((state) => {
      let newItems = [...state.items];
      
      // Handle individual cart operations (create/update/delete)
      if (update.op && update.item) {
        const { op, item, tmpId } = update;
        
        if (op === 'create') {
          // Replace optimistic item with server response or add new item
          if (tmpId) {
            // Find and replace optimistic item
            const optimisticIndex = newItems.findIndex(cartItem => cartItem.tmpId === tmpId);
            if (optimisticIndex >= 0) {
              newItems[optimisticIndex] = {
                ...mergeAddonArrays(item),
                tmpId: undefined // Clear tmpId since it's now confirmed
              };
            } else {
              newItems.push(mergeAddonArrays(item));
            }
          } else {
            // Add new item
            newItems.push(mergeAddonArrays(item));
          }
        } else if (op === 'update') {
          // Update existing item
          const itemIndex = newItems.findIndex(cartItem => cartItem.public_id === item.public_id);
          if (itemIndex >= 0) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              ...mergeAddonArrays(item)
            };
          }
        } else if (op === 'delete') {
          // Remove item
          newItems = newItems.filter(cartItem => cartItem.public_id !== item.public_id);
        }
      }
      
      return {
        items: newItems,
        cart_version: update.cart_version || state.cart_version
      };
    });
  },
  
  handleCartError: (error) => {
    if (error.code === 'version_conflict') {
      console.warn('Cart version conflict, reloading cart state');
      // In a real app, you might want to show a toast notification
      // The backend should send the latest cart state to resolve conflicts
    }
  },
  
  // Cart snapshot loading
  loadCartSnapshot: (snapshot) => {
    // Merge addon arrays per item for easier UI handling
    const processedItems = (snapshot.items || []).map(mergeAddonArrays);

    set({
      items: processedItems,
      orders: snapshot.orders || [], // Load orders from backend
      cart_version: snapshot.cart_version || 0,
      cartLocked: snapshot.cart_locked || false,
      pendingOrderId: snapshot.pending_order_id || null,
      orderProcessingStatus: snapshot.order_processing_status || 'idle',
      lockedByMember: snapshot.locked_by_member || null,
    });
    
    // If cart is still processing and we have a pending order, set timeout again
    if (snapshot.cart_locked && snapshot.order_processing_status === 'processing') {
      const timeoutId = setTimeout(() => {
        const state = get();
        if (state.orderProcessingStatus === 'processing') {
          console.warn('Order processing timed out after page refresh');
          get().handleOrderTimeout();
        }
      }, 10000);
      
      set({ orderTimeout: timeoutId });
    }
    
    // Update session store with member data from snapshot
    if (snapshot.members) {
      const sessionStore = useSessionStore.getState();
      snapshot.members.forEach(member => {
        sessionStore.updateMembers(member);
      });
    }
  },
  
  // Password & queue methods
  setPasswordRequired: (required) => set({ isPasswordRequired: required }),
  
  queueMutation: (mutation) => {
    set((state) => ({
      pendingMutations: [...state.pendingMutations, mutation]
    }));
  },
  
  flushPendingMutations: () => {
    const mutations = get().pendingMutations;
    set({ pendingMutations: [] });
    return mutations;
  },
  
  // Utility methods
  getItemsByMember: () => {
    const items = get().items;
    const sessionStore = useSessionStore.getState();
    const members = sessionStore.members;
    
    const groupedItems = {};
    
    // Initialize groups for all members
    members.forEach(member => {
      groupedItems[member.member_pid] = [];
    });
    
    // Group items by member
    items.forEach(item => {
      if (!groupedItems[item.member_pid]) {
        groupedItems[item.member_pid] = [];
      }
      groupedItems[item.member_pid].push(item);
    });
    
    return groupedItems;
  },
  
  canEditItem: (item, currentMemberPid, isHost) => {
    // Host can edit any item, members can only edit their own
    return isHost || item.member_pid === currentMemberPid;
  },
  
  getTotalAmount: () => {
    const items = get().items;
    return items.reduce((total, item) => {
      // Use final_price if available, otherwise fall back to price for backward compatibility
      const itemPrice = item.final_price || item.price || item.base_price || 0;
      return total + (itemPrice * item.qty);
    }, 0);
  },
  
  getCartHash: () => {
    // Simple hash implementation for cart validation
    const items = get().items;
    const sortedItems = items
      .map(item => `${item.public_id}:${item.qty}:${item.selected_variation_id || ''}:${JSON.stringify(item.selected_addons_request || [])}`)
      .sort()
      .join('|');
    
    // Simple string hash (in production, use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < sortedItems.length; i++) {
      const char = sortedItems.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  },

  // Addon/Variation helper methods
  getItemDisplayPrice: (item) => {
    return item.final_price || item.price || item.base_price || 0;
  },

  getItemBasePrice: (item) => {
    return item.base_price || item.price || 0;
  },

  getItemVariationText: (item) => {
    if (item.selected_variation) {
      return `${item.selected_variation.group_name}: ${item.selected_variation.variation_name}`;
    }
    return null;
  },

  getItemAddonsText: (item) => {
    if (item.selected_addons && item.selected_addons.length > 0) {
      return item.selected_addons.map(addon => 
        addon.quantity > 1 ? `${addon.name} (${addon.quantity}x)` : addon.name
      ).join(', ');
    }
    return null;
  },



  // Check if customizations are available for this menu item (not just selected)
  hasCustomizationsAvailable: async (menuItemPid) => {
    try {
      const { getMenuItem } = await import('../api/menu.js');
      const menuItem = await getMenuItem(menuItemPid);
      if (!menuItem) return false;
      
      const hasVariations = menuItem.variation_groups && menuItem.variation_groups.length > 0;
      const hasBaseAddons = menuItem.addon_groups && menuItem.addon_groups.length > 0;
      const hasVariationAddons = (menuItem.variation_groups || []).some((vg) =>
        vg.variations?.some?.((v) => Array.isArray(v.addon_groups) && v.addon_groups.length > 0)
      );
      const hasAddons = hasBaseAddons || hasVariationAddons;
      
      return hasVariations || hasAddons;
    } catch (error) {
      console.error('Error checking customizations availability:', error);
      return false;
    }
  },
  
  // Legacy cart methods (for backward compatibility)
  addItem: (item) => {
    console.warn('Legacy addItem method called. Use addItemOptimistic instead.');
    // For backward compatibility, convert to new format
    get().addItemOptimistic(item, 1, '', null);
  },
  
  removeItem: (item) => {
    console.warn('Legacy removeItem method called. Use updateItemOptimistic instead.');
    // For backward compatibility, find the item and update quantity
    const cartItem = get().items.find(cartItem => cartItem.menu_item_pid === item.id);
    if (cartItem && cartItem.qty > 1) {
      get().updateItemOptimistic(cartItem.public_id, cartItem.qty - 1, cartItem.note, cartItem.version);
    } else if (cartItem) {
      get().deleteItemOptimistic(cartItem.public_id, cartItem.version);
    }
  },
  
  clear: () => {
    const state = get();
    if (!state.isCartEditable()) {
      console.warn('Cannot clear cart: cart is locked during order processing');
      return;
    }
    console.warn('Legacy clear method called. Cart clearing should be done via WebSocket.');
    set({ items: [] });
  },
  
  totalCount: () => {
    const items = get().items;
    return items.reduce((acc, item) => acc + item.qty, 0);
  },
  

  
  // Order methods (updated for backend-driven order creation)
  addOrder: (orderData = null) => {
    console.warn('Legacy addOrder method called. Orders should be created via websocket backend response.');
    
    // If orderData is provided (from backend), add it to orders
    if (orderData) {
      set((state) => ({
        orders: [orderData, ...state.orders], // Add to beginning for descending order
        items: [] // Clear cart after creating order
      }));
      
      // Unlock cart after successful order
      get().unlockCart();
      
      return orderData;
    }
    
    // Legacy behavior for backward compatibility (shouldn't be used)
    const state = get();
    const cartItems = state.items;
    
    if (cartItems.length === 0) return;
    
    const newOrderNumber = state.orders.length + 1;
    const total = state.getTotalAmount();
    
    const newOrder = {
      id: `order-${newOrderNumber}`,
      orderNumber: newOrderNumber,
      timestamp: new Date(),
      items: [...cartItems],
      total: total
    };
    
    set((state) => ({
      orders: [newOrder, ...state.orders],
      items: []
    }));
    
    return newOrder;
  },
  
  // Add confirmed order from backend
  addConfirmedOrder: (orderData) => {
    set((state) => ({
      orders: [orderData, ...state.orders],
      items: [] // Clear cart after successful order
    }));
    
    // Don't unlock cart here - that should be handled by handleOrderSuccess/handleOrderFailure
    
    return orderData;
  },
  
  getOrders: () => get().orders,
  getTotalBill: () => get().orders.reduce((sum, order) => sum + order.total, 0),
  getOrdersCount: () => get().orders.length,
  
  // Filter methods (keep for backward compatibility)
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  getFilterCount: () => {
    const filters = get().filters;
    let count = 0;
    
    // Count category filter only if categories are selected
    if (filters.category && filters.category.length > 0) {
      count++;
    }
    
    // Count isVeg filter only if it's true (false means no filter)
    if (filters.isVeg) {
      count++;
    }
    
    // Count price filter only if it's enabled
    if (filters.priceEnabled) {
      count++;
    }
    
    return count;
  },

  // Item customisation methods
  openCustomisation: (mode, menuItem, customisationData = {}) => {
    // Reset current active item first
    set({ currentActiveItem: null });
    set({
      isCustomisationOpen: true,
      customisationMode: mode,
      currentActiveItem: menuItem,
      customisationData: {
        qty: customisationData.qty || 1,
        note: customisationData.note || '',
        selectedVariationId: customisationData.selectedVariationId || null,
        selectedAddons: customisationData.selectedAddons || [],
        tmpId: customisationData.tmpId || null,
        cartItemId: customisationData.cartItemId || null,
        version: customisationData.version || null,
      },
    });
  },

  closeCustomisation: () => {
    set({
      isCustomisationOpen: false,
      customisationMode: null,
      currentActiveItem: null,
      customisationData: {
        qty: 1,
        note: '',
        selectedVariationId: null,
        selectedAddons: [],
        tmpId: null,
        cartItemId: null,
        version: null,
      },
    });
  },

  updateCustomisationData: (updates) => {
    set((state) => ({
      customisationData: {
        ...state.customisationData,
        ...updates,
      },
    }));
  },


})); 