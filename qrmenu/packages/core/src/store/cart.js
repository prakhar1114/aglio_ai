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
  
  // Legacy filter state (keep for backward compatibility)
  filters: {},
  
  // Cart methods - new shared cart API
  addItemOptimistic: (menuItem, qty, note, tmpId) => {
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
        price: menuItem.price,
        image_url: menuItem.image_url || null, // Include image_url for cart display
        qty,
        note: note || '',
        version: 1,
        tmpId: tmpId // Track temporary ID for optimistic updates
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
    return items.reduce((total, item) => total + (item.price * item.qty), 0);
  },
  
  getCartHash: () => {
    // Simple hash implementation for cart validation
    const items = get().items;
    const sortedItems = items
      .map(item => `${item.public_id}:${item.qty}`)
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
})); 