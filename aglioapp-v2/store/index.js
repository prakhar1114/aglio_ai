import { create } from 'zustand';
import { getOrCreateSessionId, setSessionIdCookie, getFiltersCookie, setFiltersCookie } from '../lib/session';

const useStore = create((set) => ({
  sessionId: getOrCreateSessionId(),
  cart: [],
  filters: getFiltersCookie(),
  user: null,

  setSessionId: (id) => {
    setSessionIdCookie(id);
    set({ sessionId: id });
  },
  addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
  removeFromCart: (itemId) => set((state) => ({ cart: state.cart.filter((i) => i.id !== itemId) })),
  clearCart: () => set({ cart: [] }),
  setFilters: (filters) => {
    setFiltersCookie(filters);
    set({ filters });
  },
  setUser: (user) => set({ user }),
}));

export default useStore;
