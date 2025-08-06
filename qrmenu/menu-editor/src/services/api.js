const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8005';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // Menu Items API
  async getMenuItems(token, params = {}) {
    const searchParams = new URLSearchParams();
    
    // Add pagination
    searchParams.append('page', params.page || '1');
    searchParams.append('per_page', params.per_page || '50');
    
    // Add filters only if they have values
    if (params.category_brief && params.category_brief.trim()) {
      searchParams.append('category_brief', params.category_brief);
    }
    if (params.group_category && params.group_category.trim()) {
      searchParams.append('group_category', params.group_category);
    }
    if (params.is_veg !== null && params.is_veg !== undefined) {
      searchParams.append('is_veg', params.is_veg.toString());
    }
    if (params.is_active !== null && params.is_active !== undefined) {
      searchParams.append('is_active', params.is_active.toString());
    }
    if (params.promote !== null && params.promote !== undefined) {
      searchParams.append('promote', params.promote.toString());
    }
    if (params.is_bestseller !== null && params.is_bestseller !== undefined) {
      searchParams.append('is_bestseller', params.is_bestseller.toString());
    }
    if (params.is_recommended !== null && params.is_recommended !== undefined) {
      searchParams.append('is_recommended', params.is_recommended.toString());
    }
    if (params.search && params.search.trim()) {
      searchParams.append('search', params.search);
    }

    console.log('API Service - getMenuItems params:', params);
    console.log('API Service - searchParams:', searchParams.toString());
    console.log('API Service - Special filters:', {
      promote: params.promote,
      is_bestseller: params.is_bestseller,
      is_recommended: params.is_recommended
    });

    return this.request(`/menu/items?${searchParams}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });
  }

  async getMenuItem(token, publicId) {
    return this.request(`/menu/items/${publicId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });
  }

  async createMenuItem(token, itemData) {
    return this.request('/menu/items', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(itemData),
    });
  }

  async updateMenuItem(token, publicId, itemData) {
    console.log('API Service - Updating menu item:', publicId, itemData);
    const result = await this.request(`/menu/items/${publicId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(itemData),
    });
    console.log('API Service - Update result:', result);
    return result;
  }

  async toggleMenuItemActive(token, publicId) {
    return this.request(`/menu/items/${publicId}/toggle-active`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(token),
    });
  }

  // Auth API
  async login(restaurantSlug, apiKey) {
    return this.request('/menu/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        restaurant_slug: restaurantSlug,
        api_key: apiKey,
      }),
    });
  }

  // Media API
  async uploadMedia(token, file) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/menu/upload-media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type for FormData
      },
      body: formData,
    });
  }

  async uploadMediaFromUrl(token, url) {
    return this.request('/menu/upload-media-from-url', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({ url }),
    });
  }

  async updateMenuItemMedia(token, publicId, mediaData) {
    return this.request(`/menu/update-menu-item-media?public_id=${publicId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(mediaData),
    });
  }
}

export const apiService = new ApiService(); 