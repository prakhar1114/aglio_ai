// Dashboard Menu Management - Fetching, Caching, and Search

class DashboardMenuManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.menu = null;
        this.menuCache = null;
        this.fuse = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
        this.init();
    }
    
    init() {
        this.loadCachedMenu();
        this.initializeFuse();
    }
    
    async fetchMenu() {
        if (!this.dashboard.restaurantSlug) {
            console.error('Restaurant slug not available');
            return null;
        }
        
        try {
            const response = await fetch(`/restaurants/${this.dashboard.restaurantSlug}/menu/`, {
                headers: {
                    'x-session-id': 'admin_session',
                    'Authorization': `Bearer ${this.dashboard.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.menu = data.items || [];
            
            // Cache the menu with timestamp
            this.cacheMenu();
            
            // Re-initialize Fuse with new menu data
            this.initializeFuse();
            
            console.log(`✅ Menu loaded: ${this.menu.length} items`);
            return this.menu;
            
        } catch (error) {
            console.error('Error fetching menu:', error);
            this.dashboard.showToast('Failed to load menu', 'error');
            return null;
        }
    }
    
    cacheMenu() {
        if (!this.menu) return;
        
        const cacheData = {
            menu: this.menu,
            timestamp: Date.now(),
            restaurantSlug: this.dashboard.restaurantSlug
        };
        
        try {
            localStorage.setItem('dashboardMenuCache', JSON.stringify(cacheData));
            console.log('✅ Menu cached successfully');
        } catch (error) {
            console.error('Error caching menu:', error);
        }
    }
    
    loadCachedMenu() {
        try {
            const cacheData = localStorage.getItem('dashboardMenuCache');
            if (!cacheData) return;
            
            const parsedData = JSON.parse(cacheData);
            
            // Check if cache is valid
            if (parsedData.restaurantSlug !== this.dashboard.restaurantSlug) {
                console.log('Cache restaurant mismatch, clearing cache');
                localStorage.removeItem('dashboardMenuCache');
                return;
            }
            
            const cacheAge = Date.now() - parsedData.timestamp;
            if (cacheAge > this.cacheExpiry) {
                console.log('Cache expired, will fetch fresh menu');
                localStorage.removeItem('dashboardMenuCache');
                return;
            }
            
            this.menu = parsedData.menu;
            console.log(`✅ Menu loaded from cache: ${this.menu.length} items`);
            
        } catch (error) {
            console.error('Error loading cached menu:', error);
            localStorage.removeItem('dashboardMenuCache');
        }
    }
    
    initializeFuse() {
        if (!this.menu || this.menu.length === 0) {
            this.fuse = null;
            return;
        }
        
        // Configure Fuse.js options for menu search
        const options = {
            keys: [
                { name: 'name', weight: 0.4 },
                { name: 'description', weight: 0.3 },
                { name: 'category_brief', weight: 0.2 },
                { name: 'group_category', weight: 0.1 }
            ],
            threshold: 0.3,
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 2,
            shouldSort: true
        };
        
        this.fuse = new Fuse(this.menu, options);
        console.log('✅ Fuse.js initialized for menu search');
    }
    
    async ensureMenuLoaded() {
        if (!this.menu || this.menu.length === 0) {
            await this.fetchMenu();
        }
        return this.menu;
    }
    
    searchMenu(query) {
        if (!this.fuse || !query || query.length < 2) {
            return [];
        }
        
        const results = this.fuse.search(query);
        return results.map(result => ({
            ...result.item,
            score: result.score,
            matches: result.matches
        }));
    }
    
    getMenuItemById(itemId) {
        if (!this.menu) return null;
        return this.menu.find(item => item.id === itemId);
    }
    
    getMenuItemsByCategory(category) {
        if (!this.menu) return [];
        return this.menu.filter(item => 
            item.category_brief === category || 
            item.group_category === category
        );
    }
    
    getAllCategories() {
        if (!this.menu) return [];
        
        const categories = new Set();
        this.menu.forEach(item => {
            if (item.category_brief) categories.add(item.category_brief);
            if (item.group_category) categories.add(item.group_category);
        });
        
        return Array.from(categories).sort();
    }
    
    getVegItems() {
        if (!this.menu) return [];
        return this.menu.filter(item => item.veg_flag === true);
    }
    
    getNonVegItems() {
        if (!this.menu) return [];
        return this.menu.filter(item => item.veg_flag === false);
    }
    
    getBestsellers() {
        if (!this.menu) return [];
        return this.menu.filter(item => item.is_bestseller === true);
    }
    
    getItemsWithCustomizations() {
        if (!this.menu) return [];
        return this.menu.filter(item => 
            (item.variation_groups && item.variation_groups.length > 0) ||
            (item.addon_groups && item.addon_groups.length > 0)
        );
    }
    
    hasCustomizations(item) {
        return (item.variation_groups && item.variation_groups.length > 0) ||
               (item.addon_groups && item.addon_groups.length > 0);
    }
    
    getItemImageUrl(item) {
        if (item.cloudflare_image_id) {
            return `https://imagedelivery.net/YOUR_ACCOUNT_HASH/${item.cloudflare_image_id}/w=200,h=200,fit=cover,q=85`;
        }
        return item.image_url || null;
    }
    
    formatPrice(price) {
        return `₹${price.toFixed(2)}`;
    }
    
    // Clear cache manually
    clearCache() {
        localStorage.removeItem('dashboardMenuCache');
        this.menu = null;
        this.fuse = null;
        console.log('✅ Menu cache cleared');
    }
    
    // Get menu statistics
    getMenuStats() {
        if (!this.menu) return null;
        
        const stats = {
            total: this.menu.length,
            veg: this.getVegItems().length,
            nonVeg: this.getNonVegItems().length,
            bestsellers: this.getBestsellers().length,
            withCustomizations: this.getItemsWithCustomizations().length,
            categories: this.getAllCategories().length
        };
        
        return stats;
    }
}

// Add Fuse.js CDN if not already loaded
if (typeof Fuse === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js';
    script.onload = () => {
        console.log('✅ Fuse.js loaded');
        // Initialize menu manager after Fuse.js is loaded
        if (window.dashboard) {
            window.dashboard.menuManager = new DashboardMenuManager(window.dashboard);
        }
    };
    document.head.appendChild(script);
} else {
    // Fuse.js already loaded, initialize immediately
    if (window.dashboard) {
        window.dashboard.menuManager = new DashboardMenuManager(window.dashboard);
    }
} 