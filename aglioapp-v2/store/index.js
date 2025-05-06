import { create } from 'zustand';
import { getOrCreateSessionId, setSessionIdCookie, getFiltersCookie, setFiltersCookie } from '../lib/session';

const useStore = create((set) => ({
  sessionId: getOrCreateSessionId(),
  cart: [],
  wishlist: [],
  filters: getFiltersCookie(),
  user: null,
  currentOrder: [],

  setSessionId: (id) => {
    setSessionIdCookie(id);
    set({ sessionId: id });
  },
  addToCart: (item) => set((state) => {
    const exists = state.cart.find(i => i.id === item.id);
    if (exists) {
      return {
        cart: state.cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i),
      };
    }
    return {
      cart: [...state.cart, { ...item, qty: 1 }],
    };
  }),
  updateQty: (id, qty) => set((state) => {
    if (qty <= 0) {
      return { cart: state.cart.filter(item => item.id !== id) };
    }
    return { cart: state.cart.map(item => item.id === id ? { ...item, qty } : item) };
  }),
  clearCart: () => set({ cart: [] }),
  setFilters: (filters) => {
    setFiltersCookie(filters);
    set({ filters });
  },
  setUser: (user) => set({ user }),
  // promote current cart to currentOrder and clear cart in one action
  setCurrentOrder: () => set((state) => ({ currentOrder: state.cart, cart: [] })),
  // wishlist management
  addToWishlist: (item) => set((state) => ({ wishlist: [...state.wishlist, item] })),
  removeFromWishlist: (itemId) => set((state) => ({ wishlist: state.wishlist.filter((i) => i.id !== itemId) })),
  toggleWishlist: (item) => set((state) => {
    const exists = state.wishlist.find((i) => i.id === item.id);
    return exists
      ? { wishlist: state.wishlist.filter((i) => i.id !== item.id) }
      : { wishlist: [...state.wishlist, item] };
  }),
}));

export default useStore;
