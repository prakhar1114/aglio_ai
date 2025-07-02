import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getBaseApiCandidates, constructImageUrl } from './base.js';
import useMenuStore from '../store/menu.js';
import React from 'react';

const restaurantSlug = import.meta.env.VITE_RESTAURANT_SLUG;
if (!restaurantSlug) {
  throw new Error('Restaurant slug not configured. Please set VITE_RESTAURANT_SLUG environment variable.');
}

function buildQueryString(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') {
      // Handle arrays by appending each item separately
      if (Array.isArray(v)) {
        v.forEach(item => usp.append(k, item));
      } else {
        usp.append(k, v);
      }
    }
  });
  return usp.toString();
}

async function fetchWithFallback(pathOrUrl, options) {
  const bases = getBaseApiCandidates();
  // If pathOrUrl already includes protocol (http/https), treat as absolute URL and try directly
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl, options);
    return res;
  }
  for (const base of bases) {
    const url = `${base}${pathOrUrl}`;
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch (err) {
      // network error -> try next base
    }
  }
  throw new Error('All API base URLs failed');
}

export const useMenu = (filters = {}) => {
  // First, get the full menu without filters
  const fullMenuQuery = useInfiniteQuery({
    queryKey: ['fullMenu'], 
    queryFn: async ({ pageParam }) => {      
      // Check if we have full menu in store first
      const menuStore = useMenuStore.getState();
      if (menuStore && typeof menuStore.getFullMenu === 'function') {
        const cachedFullMenu = menuStore.getFullMenu();
        if (cachedFullMenu) {
          return cachedFullMenu;
        }
      }
      
      // Fetch full menu without any filters
      const path = `/restaurants/${restaurantSlug}/menu/`;
      const res = await fetchWithFallback(path, {
        headers: { 'x-session-id': '1234' },
      });
      if (!res.ok) throw new Error('Failed to fetch menu');
      const data = await res.json();
      
      // Store full menu in cache
      if (data.items && data.items.length > 0) {
        try {
          const menuStore = useMenuStore.getState();
          if (menuStore && typeof menuStore.setFullMenu === 'function') {
            menuStore.setFullMenu(data);
          }
        } catch (error) {
          console.warn('Menu store not available for caching:', error);
        }
      }
      
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  // Apply filters to the result
  const filteredData = React.useMemo(() => {
    if (!fullMenuQuery.data) return null;
    
    // Apply filters client-side
    try {
      const menuStore = useMenuStore.getState();
      if (menuStore && typeof menuStore.getFilteredMenu === 'function') {
        // Set the full menu in store if not already set
        if (!menuStore.getFullMenu()) {
          menuStore.setFullMenu(fullMenuQuery.data);
        }
        return menuStore.getFilteredMenu(filters);
      }
    } catch (error) {
      console.warn('Menu store not available for filtering:', error);
    }
    
    return fullMenuQuery.data;
  }, [fullMenuQuery.data, filters]);

  // Return query result with filtered data
  return {
    ...fullMenuQuery,
    data: filteredData
  };
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // First try to get categories from full menu cache
      try {
        const menuStore = useMenuStore.getState();
        if (menuStore && typeof menuStore.getCategories === 'function') {
          const cachedCategories = menuStore.getCategories();
          console.log('Cached categories:', cachedCategories);  
          if (cachedCategories.length > 0) {
            return cachedCategories;
          }
        }
      } catch (error) {
        console.warn('Menu store not available for categories:', error);
      }
      
      // Fallback to API if no cached categories available
      const res = await fetchWithFallback(`/restaurants/${restaurantSlug}/categories/`, {
        headers: { 'x-session-id': '1234' },
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 3 * 60 * 60 * 1000, // Match full menu cache duration
  });
};

// Get individual menu item with new caching support
export const getMenuItem = async (itemId) => {
  let menuStore, cachedItem;
  
  // First check if we have the item in full menu cache
  try {
    menuStore = useMenuStore.getState();
    
    // Priority 1: Check fullMenu cache using new helper function
    if (menuStore && typeof menuStore.getMenuItemFromFullMenu === 'function') {
      cachedItem = menuStore.getMenuItemFromFullMenu(itemId);
      if (cachedItem) {
        return cachedItem;
      }
    }
    
    // Priority 2: Check individual item cache as fallback
    if (menuStore && typeof menuStore.getMenuItem === 'function') {
      cachedItem = menuStore.getMenuItem(itemId);
      if (cachedItem && menuStore.isCacheValid()) {
        return cachedItem;
      }
    }
  } catch (error) {
    console.warn('Menu store not available for cache lookup:', error);
  }
  
  // Fetch from API if not found in cache
  try {
    const res = await fetchWithFallback(`/restaurants/${restaurantSlug}/menu/item/${itemId}/`, {
      headers: { 'x-session-id': '1234' },
    });
    
    if (!res.ok) throw new Error('Failed to fetch menu item');
    
    const item = await res.json();
    
    // Add to cache (with availability check)
    try {
      if (menuStore && typeof menuStore.addMenuItem === 'function') {
        menuStore.addMenuItem(item);
      }
    } catch (error) {
      console.warn('Menu store not available for caching:', error);
    }
    
    return item;
  } catch (error) {
    console.error('Error fetching menu item:', error);
    // Return cached item even if expired as fallback
    return cachedItem || null;
  }
};

// Hook version for React components
export const useMenuItem = (itemId) => {
  return useQuery({
    queryKey: ['menuItem', itemId],
    queryFn: async () => {
      // First check if we have the item in full menu cache
      let menuStore, cachedItem;
      
      try {
        menuStore = useMenuStore.getState();
        
        // Priority 1: Check fullMenu cache using new helper function
        if (menuStore && typeof menuStore.getMenuItemFromFullMenu === 'function') {
          cachedItem = menuStore.getMenuItemFromFullMenu(itemId);
          if (cachedItem) {
            return cachedItem;
          }
        }
        
        // Priority 2: Check individual item cache as fallback
        if (menuStore && typeof menuStore.getMenuItem === 'function') {
          cachedItem = menuStore.getMenuItem(itemId);
          if (cachedItem && menuStore.isCacheValid()) {
            return cachedItem;
          }
        }
      } catch (error) {
        console.warn('Menu store not available for cache lookup:', error);
      }
      
      // Priority 3: Fetch from API if not found in cache
      try {
        const res = await fetchWithFallback(`/restaurants/${restaurantSlug}/menu/item/${itemId}/`, {
          headers: { 'x-session-id': '1234' },
        });
        
        if (!res.ok) throw new Error('Failed to fetch menu item');
        
        const item = await res.json();
        
        // Add to individual cache (with availability check)
        try {
          if (menuStore && typeof menuStore.addMenuItem === 'function') {
            menuStore.addMenuItem(item);
          }
        } catch (error) {
          console.warn('Menu store not available for caching:', error);
        }
        
        return item;
      } catch (error) {
        console.error('Error fetching menu item:', error);
        // Return cached item even if expired as fallback
        return cachedItem || null;
      }
    },
    enabled: !!itemId,
    staleTime: 3 * 60 * 60 * 1000, // 3 hours to match cache duration
    retry: (failureCount, error) => {
      // Don't retry if we have a cached version from fullMenu or individual cache
      try {
        const menuStore = useMenuStore.getState();
        if (menuStore) {
          // Check fullMenu first
          if (typeof menuStore.getMenuItemFromFullMenu === 'function') {
            const fullMenuCachedItem = menuStore.getMenuItemFromFullMenu(itemId);
            if (fullMenuCachedItem) return false;
          }
          
          // Check individual cache
          if (typeof menuStore.getMenuItem === 'function') {
            const cachedItem = menuStore.getMenuItem(itemId);
            if (cachedItem) return false;
          }
        }
      } catch (error) {
        console.warn('Menu store not available for retry check:', error);
      }
      return failureCount < 2;
    }
  });
}; 