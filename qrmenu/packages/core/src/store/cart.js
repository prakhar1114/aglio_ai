import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: {}, // { [id]: { item, qty } }
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
})); 