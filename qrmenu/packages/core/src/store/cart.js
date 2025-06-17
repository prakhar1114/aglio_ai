import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: {}, // { [id]: { item, qty } }
  filters: {}, // Applied filters object
  orders: [], // Array of placed orders
  orderCounter: 0, // Counter for order numbering
  
  // Cart methods
  addItem: (item) => {
    set((state) => {
      const prev = state.items[item.id]?.qty ?? 0;
      return {
        items: {
          ...state.items,
          [item.id]: { item, qty: prev + 1 },
        },
      };
    });
  },
  removeItem: (item) => {
    set((state) => {
      const entry = state.items[item.id];
      if (!entry) return state;
      const newQty = entry.qty - 1;
      const newItems = { ...state.items };
      if (newQty <= 0) delete newItems[item.id];
      else newItems[item.id] = { item, qty: newQty };
      return { items: newItems };
    });
  },
  clear: () => set({ items: {} }),
  totalCount: () => Object.values(get().items).reduce((acc, e) => acc + e.qty, 0),
  
  // Order methods
  addOrder: () => {
    const state = get();
    const cartItems = Object.values(state.items);
    
    if (cartItems.length === 0) return;
    
    const newOrderNumber = state.orderCounter + 1;
    const total = cartItems.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
    
    const newOrder = {
      id: `order-${newOrderNumber}`,
      orderNumber: newOrderNumber,
      timestamp: new Date(),
      items: [...cartItems], // Create a copy of cart items
      total: total
    };
    
    set((state) => ({
      orders: [newOrder, ...state.orders], // Add to beginning for descending order
      orderCounter: newOrderNumber,
      items: {} // Clear cart after creating order
    }));
    
    return newOrder;
  },
  
  getOrders: () => get().orders,
  getTotalBill: () => get().orders.reduce((sum, order) => sum + order.total, 0),
  getOrdersCount: () => get().orders.length,
  
  // Filter methods
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