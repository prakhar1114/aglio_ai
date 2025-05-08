import { create } from 'zustand';
import { getSessionId, getFiltersCookie, setFiltersCookie, getUserCookie } from '../lib/session';
import { GiftedChat } from 'react-native-gifted-chat';

// Generate a unique thread ID on app load
const generateThreadId = () => `${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;

const useStore = create((set) => ({
  sessionId: getSessionId(),
  threadId: generateThreadId(),
  cart: [],
  wishlist: [],
  filters: getFiltersCookie(),
  user: getUserCookie(),
  currentOrder: [],
  messages: [],
  socket: null,

  setSessionId: () => {
    set({ sessionId: getSessionId() });
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
  addMessage: (msg) => set((state) => ({ messages: GiftedChat.append(state.messages, [msg]) })),
  setSocket: (socket) => set({ socket }),
}));

export default useStore;
