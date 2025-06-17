import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getSessionId } from '../session.js';
import { getBaseApiCandidates } from './base.js';

const BASE_API = import.meta.env.VITE_API_BASE || '';

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

// Helper function to get the working base API URL
function getWorkingBaseApi() {
  const bases = getBaseApiCandidates();
  // Return the first base (preferring env var, then localhost:8005)
  return bases[0] || 'http://localhost:8005';
}

// Helper function to construct complete image URLs
function constructImageUrl(imageUrl, baseApi) {
  if (!imageUrl) return null;
  // If already a complete URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  // Construct complete URL by prepending base API
  return `${baseApi}/${imageUrl}`;
}

export const useMenu = (filters = {}) => {
  return useInfiniteQuery({
    queryKey: ['menu', filters],
    queryFn: async ({ pageParam }) => {
      // Map frontend filter names to backend API parameter names
      const mappedFilters = {};
      
      // Map isVeg -> is_veg
      if (filters.isVeg !== undefined) {
        mappedFilters.is_veg = filters.isVeg;
      }
      
      // Map category -> group_category
      if (filters.category && filters.category.length > 0) {
        mappedFilters.group_category = filters.category;
      }
      
      // Map priceRange + priceEnabled -> price_cap
      if (filters.priceEnabled && filters.priceRange && filters.priceRange[1]) {
        mappedFilters.price_cap = filters.priceRange[1];
      }
      
      const queryString = buildQueryString({ cursor: pageParam ?? '', ...mappedFilters });
      console.log("original filters ", filters);
      console.log("mapped filters ", mappedFilters);
      const path = `/menu/?${queryString}`;
      const res = await fetchWithFallback(path, {
        headers: { 'x-session-id': getSessionId() },
      });
      if (!res.ok) throw new Error('Failed to fetch menu');
      const data = await res.json();
      
      // Transform image URLs to include base API
      const baseApi = getWorkingBaseApi();
      if (data.items) {
        data.items = data.items.map(item => ({
          ...item,
          image_url: constructImageUrl(item.image_url, baseApi)
        }));
      }
      
      return data;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetchWithFallback('/categories/', {
        headers: { 'x-session-id': getSessionId() },
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}; 