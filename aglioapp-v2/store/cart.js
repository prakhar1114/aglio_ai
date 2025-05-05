import { create } from 'zustand';

const useCartStore = create((set) => ({
  cart: [],
  wishlist: [],

  addToCart: (item) => set((state) => ({ cart: [...state.cart, item] })),
  removeFromCart: (itemId) => set((state) => ({ cart: state.cart.filter((i) => i.id !== itemId) })),
  clearCart: () => set({ cart: [] }),
  updateQty: (itemId, qty) => set((state) => ({
    cart: state.cart.map((item) =>
      item.id === itemId ? { ...item, qty } : item
    ),
  })),
  addToWishlist: (item) => set((state) => ({ wishlist: [...state.wishlist, item] })),
  removeFromWishlist: (itemId) => set((state) => ({ wishlist: state.wishlist.filter((i) => i.id !== itemId) })),
  toggleWish: (item) => set((state) => {
    const exists = state.wishlist.find((i) => i.id === item.id);
    return exists
      ? { wishlist: state.wishlist.filter((i) => i.id !== item.id) }
      : { wishlist: [...state.wishlist, item] };
  }),
}));

export default useCartStore;
