import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { isItemCurrentlyAvailable } from '../utils/general';

const RESTAURANT_SLUG = import.meta.env.VITE_RESTAURANT_SLUG;

const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

const useMenuStore = create(
  persist(
    (set, get) => ({
      // Cached menu items with timestamp
      cachedItems: {},
      lastCacheTime: null,
      
      // Full menu data
      fullMenu: null,
      fullMenuLastFetch: null,
      
      // Get a menu item from cache
      getMenuItem: (itemId) => {
        const { cachedItems, lastCacheTime } = get();
        
        // Check if cache is still valid (within 3 hours)
        if (lastCacheTime && Date.now() - lastCacheTime > CACHE_DURATION) {
          // Cache expired, clear it
          set({ cachedItems: {}, lastCacheTime: null });
          return null;
        }
        
        return cachedItems[itemId] || null;
      },
      
      // Add menu item to cache
      addMenuItem: (item) => {
        const { cachedItems } = get();
        set({
          cachedItems: {
            ...cachedItems,
            [item.public_id]: {
              ...item,
              cachedAt: Date.now()
            }
          },
          lastCacheTime: Date.now()
        });
      },
      
      // Add multiple menu items to cache
      addMenuItems: (items) => {
        const { cachedItems } = get();
        const newCachedItems = { ...cachedItems };
        const now = Date.now();
        
        items.forEach(item => {
          newCachedItems[item.public_id] = {
            ...item,
            cachedAt: now
          };
        });
        
        set({
          cachedItems: newCachedItems,
          lastCacheTime: now
        });
      },
      
      // Store full menu
      setFullMenu: (menuData) => {
        set({
          fullMenu: menuData,
          fullMenuLastFetch: Date.now()
        });
        
        // Also add items to individual cache
        if (menuData && menuData.items) {
          get().addMenuItems(menuData.items);
        }
      },
      
      // Get full menu
      getFullMenu: () => {
        const { fullMenu, fullMenuLastFetch } = get();
        
        // Check if full menu cache is still valid
        if (fullMenuLastFetch && Date.now() - fullMenuLastFetch > CACHE_DURATION) {
          set({ fullMenu: null, fullMenuLastFetch: null });
          return null;
        }
        
        return fullMenu;
      },
      
      // Apply filters to full menu
      getFilteredMenu: (filters = {}) => {
        const fullMenu = get().getFullMenu();
        if (!fullMenu || !fullMenu.items) {
          return null;
        }
        
        let filteredItems = [...fullMenu.items];
        
        // Apply isVeg filter
        if (filters.isVeg === true) {
          filteredItems = filteredItems.filter(item => item.veg_flag === true);
        }
        
        // Apply category filter
        if (filters.category && filters.category.length > 0) {
          filteredItems = filteredItems.filter(item =>
            filters.category.includes(item.group_category)
          );
        }
        
        // Apply price filter
        if (filters.priceEnabled && filters.priceRange && filters.priceRange[1]) {
          filteredItems = filteredItems.filter(item => 
            item.base_price <= filters.priceRange[1]
          );
        }
        
        // Apply timing filter (check if items are currently available)
        if (filters.includeTiming !== false) { // Default to true
          filteredItems = filteredItems.filter(isItemCurrentlyAvailable);
        }
        
        return {
          ...fullMenu,
          items: filteredItems
        };
      },
      
      // Check if cache is valid
      isCacheValid: () => {
        const { lastCacheTime } = get();
        return lastCacheTime && Date.now() - lastCacheTime <= CACHE_DURATION;
      },
      
      // Check if full menu is valid
      isFullMenuValid: () => {
        const { fullMenuLastFetch } = get();
        return fullMenuLastFetch && Date.now() - fullMenuLastFetch <= CACHE_DURATION;
      },

      // Compute categories from full menu
      getCategories: () => {
        const fullMenu = get().getFullMenu();
        if (!fullMenu || !fullMenu.items) {
          console.log('No full menu or items');
          return [];
        }

        // Group items by category combination and count them
        const categoryMap = new Map();

        fullMenu.items.forEach(item => {
          if (item.group_category && item.category_brief) {
            const key = `${item.group_category}|${item.category_brief}`;
            
            if (!categoryMap.has(key)) {
              categoryMap.set(key, {
                group_category: item.group_category,
                category_brief: item.category_brief,
                total_count: 0,
                veg_count: 0
              });
            }
            
            const category = categoryMap.get(key);
            category.total_count += 1;
            if (item.veg_flag === true) {
              category.veg_count += 1;
            }
          }
        });

        return Array.from(categoryMap.values());
      },

      // Get menu item from full menu
      getMenuItemFromFullMenu: (itemId) => {
        const fullMenu = get().getFullMenu();
        if (!fullMenu || !fullMenu.items) {
          return null;
        }
        return fullMenu.items.find(item => item.id === itemId) || null;
      },
      
      // Clear cache
      clearCache: () => {
        set({ cachedItems: {}, lastCacheTime: null, fullMenu: null, fullMenuLastFetch: null });
      },
      
      // Get cache stats (for debugging)
      getCacheStats: () => {
        const { cachedItems, lastCacheTime, fullMenu, fullMenuLastFetch } = get();
        return {
          itemCount: Object.keys(cachedItems).length,
          lastCacheTime,
          isValid: get().isCacheValid(),
          expiresAt: lastCacheTime ? new Date(lastCacheTime + CACHE_DURATION) : null,
          hasFullMenu: !!fullMenu,
          fullMenuLastFetch,
          isFullMenuValid: get().isFullMenuValid(),
          fullMenuExpiresAt: fullMenuLastFetch ? new Date(fullMenuLastFetch + CACHE_DURATION) : null
        };
      }
    }),
    {
      name: `qrmenu-cache-${RESTAURANT_SLUG}`,
      storage: createJSONStorage(() => sessionStorage),
      // Only persist the cached items and timestamp
      partialize: (state) => ({
        cachedItems: state.cachedItems,
        lastCacheTime: state.lastCacheTime,
        fullMenu: state.fullMenu,
        fullMenuLastFetch: state.fullMenuLastFetch
      }),
      // Migrate function to handle version changes
      migrate: (persistedState, version) => {
        // If cache is too old, clear it
        if (persistedState.lastCacheTime && 
            Date.now() - persistedState.lastCacheTime > CACHE_DURATION) {
          return {
            cachedItems: {},
            lastCacheTime: null,
            fullMenu: null,
            fullMenuLastFetch: null
          };
        }
        return persistedState;
      },
      version: 2
    }
  )
);

export default useMenuStore; 