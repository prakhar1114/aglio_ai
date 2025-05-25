// API Configuration
const EXPO_PUBLIC_API = 'https://api.aglioapp.com';
const sessionId = '123456';

// Create API instance with base configuration
const api = {
    baseURL: EXPO_PUBLIC_API,
    
    // Make API request with session headers
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
            ...options.headers
        };
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },
    
    // Fetch menu items from API
    async fetchMenu() {
        try {
            const data = await this.request('/menu');
            
            // Process menu items similar to Menu.js
            const menuWithFullImageUrl = data.map(item => ({
                ...item,
                image_url: item.image_url
                    ? item.image_url.startsWith('http')
                        ? item.image_url
                        : `${this.baseURL.replace(/\/$/, '')}/${item.image_url.replace(/^\//, '')}`
                    : null,
            }));
            
            return menuWithFullImageUrl;
        } catch (error) {
            console.error('Failed to fetch menu:', error);
            // Return empty array if API fails
            return [];
        }
    }
};

// Export for use in other files
window.api = api; 