import { create } from 'zustand';
import { useSessionStore } from './session.js';
import { generateShortId } from '../utils/general.js';

export const useCartStore = create((set, get) => ({
  // Cart data - new shared cart structure
  items: [], // Array of CartItem objects
  orders: [], // Array of completed orders
  cart_version: 0, // Overall cart version for optimistic locking
  
  // UI state
  isPasswordRequired: false,
  pendingMutations: [], // Queue for mutations when password is required
  
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
  
  // Cart methods - new shared cart API with addon/variation support
  addItemOptimistic: (menuItem, qty, note, tmpId, selectedVariationId = null, selectedAddons = []) => {
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
          const addonsPrice = (selectedAddons || []).reduce((acc, { addon_group_item_id, quantity }) => {
            for (const ag of (menuItem.addon_groups || [])) {
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
          selectedAddons.forEach(({ addon_group_item_id, quantity }) => {
            for (const ag of (menuItem.addon_groups || [])) {
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
          const addonsPrice = (selectedAddons || []).reduce((acc, { addon_group_item_id, quantity }) => {
            for (const ag of (menuItem.addon_groups || [])) {
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
          selectedAddons.forEach(({ addon_group_item_id, quantity }) => {
            for (const ag of (menuItem.addon_groups || [])) {
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
                ...item,
                tmpId: undefined // Clear tmpId since it's now confirmed
              };
            } else {
              // Add new item if optimistic item not found
              newItems.push(item);
            }
          } else {
            // Add new item
            newItems.push(item);
          }
        } else if (op === 'update') {
          // Update existing item
          const itemIndex = newItems.findIndex(cartItem => cartItem.public_id === item.public_id);
          if (itemIndex >= 0) {
            newItems[itemIndex] = {
              ...newItems[itemIndex],
              ...item
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
    set({
      items: snapshot.items || [],
      cart_version: snapshot.cart_version || 0
    });
    
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
      const hasAddons = menuItem.addon_groups && menuItem.addon_groups.length > 0;
      
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
    console.warn('Legacy clear method called. Cart clearing should be done via WebSocket.');
    set({ items: [] });
  },
  
  totalCount: () => {
    const items = get().items;
    return items.reduce((acc, item) => acc + item.qty, 0);
  },
  

  
  // Order methods (updated for new structure)
  addOrder: () => {
    const state = get();
    const cartItems = state.items;
    
    if (cartItems.length === 0) return;
    
    const newOrderNumber = state.orders.length + 1;
    const total = state.getTotalAmount();
    
    const newOrder = {
      id: `order-${newOrderNumber}`,
      orderNumber: newOrderNumber,
      timestamp: new Date(),
      items: [...cartItems], // Create a copy of cart items
      total: total
    };
    
    set((state) => ({
      orders: [newOrder, ...state.orders], // Add to beginning for descending order
      items: [] // Clear cart after creating order
    }));
    
    return newOrder;
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