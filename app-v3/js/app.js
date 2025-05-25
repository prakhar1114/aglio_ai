// Progressive Image Loading Manager (Pinterest/Instagram-inspired)
class LazyLoadManager {
    constructor() {
        this.batchSize = 15; // Load 15 items per batch
        this.loadedImages = new Set(); // Track loaded images
        this.loadingImages = new Set(); // Track currently loading images
        this.observedElements = new Map(); // Track observed elements
        this.currentBatch = 0;
        this.totalBatches = 0;
        
        // Create intersection observers for different zones
        this.setupObservers();
    }
    
    setupObservers() {
        // Main loading observer (loads when entering viewport + 100px buffer)
        this.loadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                console.log('👁️ Intersection observed:', entry.target.dataset.id, 'isIntersecting:', entry.isIntersecting);
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, {
            rootMargin: '100px',
            threshold: 0.1
        });
        
        // Unload observer (unloads when far from viewport to save memory)
        this.unloadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    this.unloadImage(entry.target);
                }
            });
        }, {
            rootMargin: '-500px 0px -500px 0px', // Unload when 500px away
            threshold: 0
        });
        
        // Preload observer (loads next batch when approaching end)
        this.preloadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadNextBatch();
                }
            });
        }, {
            rootMargin: '300px 0px',
            threshold: 0.1
        });
    }
    
    initialize(items) {
        this.allItems = items;
        this.totalBatches = Math.ceil(items.length / this.batchSize);
        console.log('LazyLoad initialized:', items.length, 'items,', this.totalBatches, 'batches');
        
        // Reset tracking
        this.loadedImages.clear();
        this.loadingImages.clear();
        this.observedElements.clear();
        
        // // Test: Force load first 5 images immediately
        // setTimeout(() => {
        //     console.log('🧪 Testing: Force loading first 5 images');
        //     for (let i = 0; i < Math.min(5, items.length); i++) {
        //         const item = items[i];
        //         const element = document.querySelector(`[data-id="${item.id}"]`);
        //         if (element) {
        //             console.log('🧪 Force loading item:', item.id, item.name);
        //             this.loadImage(element);
        //         }
        //     }
        // }, 1000);
        
        // Start observing elements
        setTimeout(() => {
            const elements = document.querySelectorAll('.menu-item-image-container[data-id]');
            elements.forEach(element => this.observeElement(element));
            console.log('👁️ Started observing', elements.length, 'elements');
        }, 100);
    }
    
    observeElement(element) {
        if (!this.observedElements.has(element)) {
            this.loadObserver.observe(element);
            this.observedElements.set(element, true);
        }
    }
    
    loadImage(element) {
        const itemId = element.dataset.id;
        const imgElement = element.querySelector('.lazy-image');
        const placeholder = element.querySelector('.image-placeholder');
        
        console.log('🔍 loadImage called for item:', itemId, 'imgElement:', imgElement);
        
        if (!imgElement || this.loadedImages.has(itemId) || this.loadingImages.has(itemId)) {
            console.log('❌ Skipping load:', { hasImg: !!imgElement, loaded: this.loadedImages.has(itemId), loading: this.loadingImages.has(itemId) });
            return;
        }
        
        this.loadingImages.add(itemId);
        
        // Show loading state
        if (placeholder) {
            placeholder.classList.add('loading');
        }
        
        // Get image source from data attribute
        const imageSrc = imgElement.dataset.src;
        console.log('🖼️ Attempting to load image:', imageSrc, 'for item:', itemId);
        
        if (!imageSrc) {
            console.log('❌ No image source found for item:', itemId);
            this.loadingImages.delete(itemId);
            return;
        }
        
        // Load the image
        const img = new Image();
        img.onload = () => {
            console.log('✅ Image loaded successfully:', imageSrc);
            // Update the actual image element
            imgElement.src = imageSrc;
            imgElement.classList.add('loaded');
            
            // Hide placeholder
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // Ensure image is visible regardless of source (API or hardcoded)
            imgElement.style.display = 'block';
            imgElement.style.opacity = '1';
            
            this.loadedImages.add(itemId);
            this.loadingImages.delete(itemId);
        };
        
        img.onerror = () => {
            console.log('❌ Image failed to load:', imageSrc);
            this.loadingImages.delete(itemId);
            if (placeholder) {
                placeholder.classList.remove('loading');
            }
        };
        
        img.src = imageSrc;
    }
    
    unloadImage(element) {
        const itemId = element.dataset.id;
        const imgElement = element.querySelector('.lazy-image');
        const placeholder = element.querySelector('.image-placeholder');
        
        // Only unload if image is loaded and element is far from viewport
        if (this.loadedImages.has(itemId) && imgElement && imgElement.src) {
            // Create placeholder again and remove image src to save memory
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.classList.remove('loading', 'error');
            }
            imgElement.src = '';
            imgElement.style.opacity = '0';
            
            this.loadedImages.delete(itemId);
        }
    }
    
    loadNextBatch() {
        if (this.currentBatch >= this.totalBatches) return;
        
        this.currentBatch++;
        console.log(`Loading batch ${this.currentBatch}/${this.totalBatches}`);
        
        // This will be called when we need to load more items
        // The actual loading happens through intersection observer
    }
    
    destroy() {
        this.loadObserver.disconnect();
        this.unloadObserver.disconnect();
        this.preloadObserver.disconnect();
        this.observedElements.clear();
        this.loadedImages.clear();
        this.loadingImages.clear();
    }
}

// Global LazyLoad instance
let lazyLoadManager = new LazyLoadManager();

// Global state
let menuItems = [];
let filteredMenuItems = []; // Store filtered items
let likedItems = new Set();
let cartItems = [];
let currentPreviewItem = null;
let currentPreviewIndex = 0;
let touchStartX = 0;
let touchCurrentX = 0;
let isSwipeEnabled = false;
let isSwiping = false;
let isAnimating = false;
let preloadedImages = {};
let currentSlideIndex = 0;
let isBackToTopClicked = false; // Track when back to top was clicked
let isDarkMode = false; // Track current theme mode

// Filter state
let currentFilters = {
    vegOnly: false
};

// Category FAB state
let isCategoryFabOpen = false;
let currentActiveCategory = null;
let availableCategories = [];

// Category icons mapping
const categoryIcons = {
    'Main Courses': 'fas fa-drumstick-bite',
    'Vegetarian': 'fas fa-leaf',
    'Pasta': 'fas fa-utensils',
    'Featured': 'fas fa-star',
    'Appetizers': 'fas fa-cheese',
    'Desserts': 'fas fa-ice-cream',
    'Beverages': 'fas fa-coffee',
    'Salads': 'fas fa-seedling',
    'Soups': 'fas fa-bowl-hot',
    'Pizza': 'fas fa-pizza-slice',
    'Seafood': 'fas fa-fish',
    'Other': 'fas fa-utensils'
};

// Generate Instagram embed HTML dynamically
const generateInstagramEmbed = (instagramUrl) => {
    if (!instagramUrl) return '';
    
    // Ensure the URL has the proper embed parameters
    let embedUrl = instagramUrl;
    if (!embedUrl.includes('utm_source=ig_embed')) {
        const separator = embedUrl.includes('?') ? '&' : '?';
        embedUrl += `${separator}utm_source=ig_embed&utm_campaign=loading`;
    }
    
    return `<blockquote class="instagram-media" data-instgrm-permalink="${embedUrl}" data-instgrm-version="14">
        <a href="${embedUrl}" target="_blank">View this ${instagramUrl.includes('/reel/') ? 'reel' : 'post'} on Instagram</a>
    </blockquote>`;
};

// Theme functionality
const toggleTheme = () => {
    isDarkMode = !isDarkMode;
    
    if (isDarkMode) {
        document.body.classList.add('dark-theme');
        updateThemeIcons('moon');
    } else {
        document.body.classList.remove('dark-theme');
        updateThemeIcons('sun');
    }
    
    // Save theme preference
    localStorage.setItem('isDarkMode', isDarkMode.toString());
    
    // Show toast notification
    showToast(isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
};

const updateThemeIcons = (icon) => {
    const iconClass = icon === 'moon' ? 'fas fa-moon' : 'fas fa-sun';
    document.querySelectorAll('.theme-toggle i').forEach(iconEl => {
        iconEl.className = iconClass;
    });
};

const loadThemePreference = () => {
    const savedTheme = localStorage.getItem('isDarkMode');
    if (savedTheme === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-theme');
        updateThemeIcons('moon');
    } else {
        isDarkMode = false;
        updateThemeIcons('sun');
    }
};

// Filter functionality
const openFilterModal = () => {
    const modal = document.getElementById('filterModal');
    const vegToggle = document.getElementById('vegOnlyToggle');
    
    // Set current filter state
    vegToggle.checked = currentFilters.vegOnly;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeFilterModal = () => {
    const modal = document.getElementById('filterModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
};

const applyFilters = () => {
    const vegToggle = document.getElementById('vegOnlyToggle');
    
    // Update filter state
    currentFilters.vegOnly = vegToggle.checked;
    
    console.log('Applying filters:', currentFilters);
    console.log('Total menu items before filtering:', menuItems.length);
    
    // Apply filters to menu items
    if (currentFilters.vegOnly) {
        filteredMenuItems = menuItems.filter(item => item.veg === true);
        console.log('Filtered to veg items only:', filteredMenuItems.length);
    } else {
        filteredMenuItems = [...menuItems]; // Show all items
        console.log('Showing all items:', filteredMenuItems.length);
    }
    
    // Debug: Log categories in filtered items
    const categories = [...new Set(filteredMenuItems.map(item => item.category || 'Other'))];
    console.log('Categories in filtered items:', categories);
    
    // Re-render the menu with filtered items
    renderFilteredMenuItems();
    
    // Save filter preferences
    saveFilterPreferences();
    
    // Update filter button state
    updateFilterButtonState();
    
    // Close modal
    closeFilterModal();
    
    // Show toast notification
    const itemCount = filteredMenuItems.length;
    showToast(`Showing ${itemCount} item${itemCount !== 1 ? 's' : ''}`);
};

// Category FAB Functions
const updateAvailableCategories = () => {
    // Get categories from filtered items
    const categories = [...new Set(filteredMenuItems.map(item => item.category || 'Other'))];
    availableCategories = categories.sort();
    
    console.log('Available categories updated:', availableCategories);
    renderCategoryFab();
};

const renderCategoryFab = () => {
    const categoryFabItems = document.getElementById('categoryFabItems');
    
    if (availableCategories.length === 0) {
        categoryFabItems.innerHTML = '<div class="no-categories">No categories available</div>';
        return;
    }
    
    // Count items per category
    const categoryCounts = {};
    filteredMenuItems.forEach(item => {
        const category = item.category || 'Other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    const categoryItemsHTML = availableCategories.map(category => {
        const count = categoryCounts[category] || 0;
        const isActive = currentActiveCategory === category;
        
        return `
            <button class="category-fab-item ${isActive ? 'active' : ''}" data-category="${category}">
                <span>${category}</span>
                <span class="item-count">${count}</span>
            </button>
        `;
    }).join('');
    
    categoryFabItems.innerHTML = categoryItemsHTML;
    
    // Add event listeners to category items
    categoryFabItems.querySelectorAll('.category-fab-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = item.dataset.category;
            navigateToCategory(category);
        });
    });
};

const toggleCategoryFab = () => {
    isCategoryFabOpen = !isCategoryFabOpen;
    const fabToggle = document.getElementById('categoryFabToggle');
    const fabMenu = document.getElementById('categoryFabMenu');
    
    if (isCategoryFabOpen) {
        fabToggle.classList.add('active');
        fabMenu.classList.add('active');
        updateAvailableCategories(); // Refresh categories when opening
    } else {
        fabToggle.classList.remove('active');
        fabMenu.classList.remove('active');
    }
};

const closeCategoryFab = () => {
    if (isCategoryFabOpen) {
        isCategoryFabOpen = false;
        document.getElementById('categoryFabToggle').classList.remove('active');
        document.getElementById('categoryFabMenu').classList.remove('active');
    }
};

const navigateToCategory = (category) => {
    console.log('Navigating to category:', category);
    
    // Update active category
    currentActiveCategory = category;
    
    // Update FAB item states
    document.querySelectorAll('.category-fab-item').forEach(item => {
        if (item.dataset.category === category) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Find the category header in the main grid
    const categoryHeader = document.querySelector(`[data-category="${category}"]`);
    
    if (categoryHeader) {
        // Close the FAB menu
        closeCategoryFab();
        
        // Calculate scroll position with offset for better visibility
        const headerRect = categoryHeader.getBoundingClientRect();
        const currentScrollY = window.scrollY;
        const targetScrollY = currentScrollY + headerRect.top - 80; // 80px offset from top
        
        // Smooth scroll to category
        window.scrollTo({
            top: Math.max(0, targetScrollY),
            behavior: 'smooth'
        });
        
        // Show toast notification
        showToast(`Scrolled to ${category}`);
        
        // Highlight the category briefly
        categoryHeader.style.transition = 'background-color 0.3s ease';
        categoryHeader.style.backgroundColor = 'var(--color-accent)';
        categoryHeader.style.color = 'white';
        
        setTimeout(() => {
            categoryHeader.style.backgroundColor = '';
            categoryHeader.style.color = '';
        }, 1500);
    } else {
        showToast(`Category "${category}" not found`);
    }
};

const setupCategoryFabListeners = () => {
    const fabToggle = document.getElementById('categoryFabToggle');
    const fabMenu = document.getElementById('categoryFabMenu');
    
    // Toggle FAB on button click
    fabToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCategoryFab();
    });
    
    // Prevent menu from closing when clicking inside it
    fabMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
        if (isCategoryFabOpen && !e.target.closest('.category-fab')) {
            closeCategoryFab();
        }
    });
    
    // Close FAB on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isCategoryFabOpen) {
            closeCategoryFab();
        }
    });
};

const renderFilteredMenuItems = () => {
    const grid = document.getElementById('menuGrid');
    
    // Clean up previous lazy loading observers
    lazyLoadManager.destroy();
    lazyLoadManager = new LazyLoadManager();
    
    // Clear main grid
    grid.innerHTML = '';
    
    // Force immediate reflow to clear any cached layout
    grid.offsetHeight;
    
    // Reset any masonry-related styles that might interfere
    grid.style.columnCount = '';
    grid.style.height = '';
    
    // Initialize lazy loading with filtered items
    lazyLoadManager.initialize(filteredMenuItems);
    
    console.log('renderFilteredMenuItems: Processing', filteredMenuItems.length, 'items');
    
    // Group filtered items by category
    const groupedItems = filteredMenuItems.reduce((groups, item) => {
        const category = item.category || 'Other';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(item);
        return groups;
    }, {});
    
    console.log('Grouped items by category:', groupedItems);
    
    // Generate HTML for each category (only show categories that have items)
    let itemsHTML = '';
    Object.keys(groupedItems).forEach(category => {
        const categoryItems = groupedItems[category];
        
        console.log(`Processing category "${category}" with ${categoryItems.length} items`);
        
        // Only add category header if there are items in this category
        if (categoryItems.length > 0) {
            itemsHTML += `
                <div class="category-header" data-category="${category}">
                    <h2 class="category-title">${category}</h2>
                </div>
            `;
            
            // Add items in this category
            const categoryItemsHTML = categoryItems.map(item => {
                if (item.type === 'ipost' || item.type === 'ireel') {
                    // Render Instagram item - load immediately (no lazy loading for embeds)
                    const embedHtml = generateInstagramEmbed(item.instagramUrl);
                    return `
                        <div class="menu-item instagram-item" data-id="${item.id}" data-type="${item.type}" data-category="${item.category}">
                            <div class="instagram-embed-container">
                                ${embedHtml}
                            </div>
                            <div class="quick-actions">
                                <button class="quick-action-btn like-btn" data-id="${item.id}">
                                    <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                                </button>
                                <button class="quick-action-btn share-btn" data-id="${item.id}">
                                    <i class="fas fa-share"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // Render regular menu item with lazy loading
                    return `
                        <div class="menu-item lazy-item" data-category="${item.category}">
                            <div class="menu-item-image-container" data-id="${item.id}">
                                <!-- Placeholder for lazy loading -->
                                <div class="image-placeholder">
                                    <div class="skeleton-shimmer"></div>
                                    <div class="placeholder-icon">
                                        <i class="fas fa-utensils"></i>
                                    </div>
                                </div>
                                <!-- Lazy loaded image -->
                                <img 
                                    class="menu-item-image lazy-image" 
                                    data-src="${item.image}" 
                                    alt="${item.name}" 
                                    style="display: none; opacity: 0;"
                                >
                            </div>
                            <div class="menu-item-info">
                                <h3 class="dish-name">${item.name}</h3>
                            </div>
                            <div class="quick-actions">
                                <button class="quick-action-btn like-btn" data-id="${item.id}">
                                    <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                                </button>
                                <button class="quick-action-btn cart-btn" data-id="${item.id}">
                                    <i class="fas fa-shopping-cart"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            }).join('');
            
            itemsHTML += categoryItemsHTML;
        }
    });
    
    // Update main grid with new content
    grid.innerHTML = itemsHTML;
    
    // Enhanced masonry grid reflow function
    const forceCompleteReflow = () => {
        // Reset all masonry-related styles for main grid only
        grid.style.columnCount = '';
        grid.style.columnGap = '';
        grid.style.height = '';
        grid.style.transform = '';
        
        // Force layout recalculation
        grid.offsetHeight;
        
        // Temporarily set to single column to force complete reflow
        grid.style.columnCount = '1';
        grid.offsetHeight;
        
        // Reset to let CSS handle the columns
        grid.style.columnCount = '';
        
        // Force another layout pass
        setTimeout(() => {
            grid.offsetHeight;
            
            // Trigger window resize to help with any remaining layout issues
            window.dispatchEvent(new Event('resize'));
        }, 50);
    };
    
    // Setup lazy loading for regular menu items
    const lazyItems = grid.querySelectorAll('.menu-item-image-container[data-id]');
    lazyItems.forEach(item => {
        lazyLoadManager.observeElement(item);
    });
    
    // Load Instagram embed script
    loadInstagramScript();
    
    // Add event listeners
    addMenuItemEventListeners(grid);
    updateCartCount();
    
    // Apply enhanced reflow with multiple passes for better stability
    setTimeout(() => {
        forceCompleteReflow();
    }, 100);
    
    // Additional reflow after everything is set up
    setTimeout(() => {
        forceCompleteReflow();
    }, 300);
    
    // Final reflow to ensure everything is properly laid out
    setTimeout(() => {
        forceCompleteReflow();
    }, 600);
    
    // Update category FAB with new filtered categories
    updateAvailableCategories();
};

const updateFilterButtonState = () => {
    const filtersBtn = document.getElementById('filtersBtn');
    const hasActiveFilters = currentFilters.vegOnly;
    
    if (hasActiveFilters) {
        filtersBtn.classList.add('active');
    } else {
        filtersBtn.classList.remove('active');
    }
};

const saveFilterPreferences = () => {
    localStorage.setItem('currentFilters', JSON.stringify(currentFilters));
};

const loadFilterPreferences = () => {
    const savedFilters = localStorage.getItem('currentFilters');
    if (savedFilters) {
        currentFilters = { ...currentFilters, ...JSON.parse(savedFilters) };
    }
    
    // Apply saved filters
    if (currentFilters.vegOnly) {
        filteredMenuItems = menuItems.filter(item => item.veg === true);
    } else {
        filteredMenuItems = [...menuItems];
    }
    
    // Update filter button state
    updateFilterButtonState();
};

// Load menu items from API
const loadMenuItems = async () => {
    try {
        // Show loading indicator
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        
        // Fetch menu from API
        const apiMenuItems = await window.api.fetchMenu();
        
        // Check if we got valid data from API
        if (apiMenuItems && apiMenuItems.length > 0) {
            // Transform API response to match our current structure
            menuItems = apiMenuItems.map(item => ({
                id: item.id,
                name: item.name || 'Untitled Item',
                price: item.price ? (typeof item.price === 'string' ? item.price : `₹${item.price}`) : '',
                description: item.description || '',
                image: item.image_url || item.image || '',
                category: item.category_brief || '',
                type: item.type || 'regular', // Default to regular if no type specified
                instagramUrl: item.instagram_url || item.instagramUrl || '',
                veg: item.veg_flag,
            })).filter(item => item.id && item.image !== ''); // Filter out items without valid IDs or empty images
            
            // Append pasta items as Instagram content
            menuItems.push(
                {
                    id: 1000,
                    name: "Behind the Scenes Carbonara",
                    type: "ipost",
                    description: "See how our chefs prepare this classic carbonara with love and passion, using authentic Italian techniques.",
                    instagramUrl: "https://www.instagram.com/p/DIgX-MjSKaU/",
                    category: "Pasta",
                    veg: false,
                },
                {
                    id: 1001,
                    name: "Season Special Wine",
                    type: "ireel", 
                    description: "Watch our head chef create culinary magic with this signature pasta dish, crafted with seasonal ingredients.",
                    instagramUrl: "https://www.instagram.com/reel/DD4dMuISn-C/",
                    category: "Pasta",
                    veg: true,
                }
            );
            
            console.log('Loaded menu items from API:', menuItems);
        } else {
            throw new Error('API returned empty or invalid data');
        }
        
        // Hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Failed to load menu items from API, using fallback:', error);
        
        // Hide loading indicator
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Fallback to hardcoded menu items if API fails
        menuItems = [
            {
                id: 1,
                name: "Chianti's Signature Mozzarella Stuffed Chicken",
                price: "$28.99",
                description: "Tender chicken breast stuffed with creamy mozzarella cheese and herbs, served with roasted vegetables and garlic mashed potatoes.",
                image: "images/Chianti'S_Signature_Mozzarella_Stuffed_Chicken.png",
                category: "Main Courses",
                veg: false,
            },
            {
                id: 2,
                name: "Surf & Turf (Tenderloin and Prawn)",
                price: "$42.99",
                description: "Premium beef tenderloin paired with succulent prawns, grilled to perfection and served with seasonal vegetables.",
                image: "images/Surf_&_Turf_(Tenderloin_and_Prawn).png",
                category: "Main Courses",
                veg: false,
            },
            {
                id: 3,
                name: "Grilled Lamb Chops",
                price: "$36.99",
                description: "Herb-crusted lamb chops grilled to your preference, served with mint sauce and roasted root vegetables.",
                image: "images/Grilled_Lamb_Chops.png",
                category: "Main Courses",
                veg: false,
            },
            {
                id: 4,
                name: "Chicken Parmigiana",
                price: "$24.99",
                description: "Crispy breaded chicken breast topped with marinara sauce and melted mozzarella, served over pasta.",
                image: "images/Chicken_Parmigiana.png",
                category: "Main Courses",
                veg: false,
            },
            {
                id: 5,
                name: "Chianti's Signature Grilled Chicken",
                price: "$22.99",
                description: "Marinated grilled chicken breast with our signature blend of herbs and spices, served with seasonal sides.",
                image: "images/Chianti'S_Signature_Grilled_Chicken.png",
                category: "Main Courses",
                veg: false,
            },
            {
                id: 6,
                name: "Vegan Penne Con Broccoli",
                price: "$18.99",
                description: "Fresh penne pasta with crisp broccoli, garlic, olive oil, and nutritional yeast in a light herb sauce.",
                image: "images/Vegan_Penne_Con_Broccoli.png",
                category: "Vegetarian",
                veg: true,
            },
            {
                id: 7,
                name: "Mediterranean Vegetable Platter",
                price: "$16.99",
                description: "A colorful array of grilled Mediterranean vegetables with hummus, olives, and fresh herbs.",
                image: "images/Veg_Platter.png",
                category: "Vegetarian",
                veg: true,
            },
            {
                id: 8,
                name: "Season Special Wine",
                type: "ireel",
                description: "Watch our head chef create culinary magic in this behind-the-scenes reel.",
                instagramUrl: "https://www.instagram.com/reel/DD4dMuISn-C/",
                category: "Featured",
                veg: true,
            },
            {
                id: 9,
                name: "Behind the Scenes at Chianti",
                type: "ipost",
                description: "See how our chefs prepare your favorite dishes with love and passion.",
                instagramUrl: "https://www.instagram.com/p/DIgX-MjSKaU/",
                category: "Featured",
                veg: true,
            },
            {
                id: 10,
                name: "Cooking in Action - Chef's Special",
                type: "ireel",
                description: "Watch our head chef create culinary magic in this behind-the-scenes reel.",
                instagramUrl: "https://www.instagram.com/reel/DFNWZQ1Srds/",
                category: "Featured",
                veg: true,
            }
        ];
        
        console.log('Using fallback menu items:', menuItems);
    }

    // Load filter preferences and apply them
    loadFilterPreferences();
    
    // If no filters are applied, show all items
    if (filteredMenuItems.length === 0) {
        filteredMenuItems = [...menuItems];
    }
    
    renderMenuItems();
    loadUserPreferences();
};

// Render menu items in masonry grid
const renderMenuItems = () => {
    const grid = document.getElementById('menuGrid');
    
    // Clean up previous lazy loading observers
    lazyLoadManager.destroy();
    lazyLoadManager = new LazyLoadManager();
    
    // Initialize lazy loading with filtered items
    lazyLoadManager.initialize(filteredMenuItems);
    
    // Group filtered items by category
    const groupedItems = filteredMenuItems.reduce((groups, item) => {
        const category = item.category || 'Other';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(item);
        return groups;
    }, {});
    
    // Generate HTML for each category (only show categories that have items)
    let itemsHTML = '';
    Object.keys(groupedItems).forEach(category => {
        const categoryItems = groupedItems[category];
        
        // Only add category header if there are items in this category
        if (categoryItems.length > 0) {
            itemsHTML += `
                <div class="category-header" data-category="${category}">
                    <h2 class="category-title">${category}</h2>
                </div>
            `;
            
            // Add items in this category
            const categoryItemsHTML = categoryItems.map(item => {
            if (item.type === 'ipost' || item.type === 'ireel') {
                // Render Instagram item - load immediately (no lazy loading for embeds)
                const embedHtml = generateInstagramEmbed(item.instagramUrl);
                return `
                    <div class="menu-item instagram-item" data-id="${item.id}" data-type="${item.type}" data-category="${item.category}">
                        <div class="instagram-embed-container">
                            ${embedHtml}
                        </div>
                        <div class="quick-actions">
                            <button class="quick-action-btn like-btn" data-id="${item.id}">
                                <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                            <button class="quick-action-btn share-btn" data-id="${item.id}">
                                <i class="fas fa-share"></i>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Render regular menu item with lazy loading
                return `
                    <div class="menu-item lazy-item" data-category="${item.category}">
                        <div class="menu-item-image-container" data-id="${item.id}">
                            <!-- Placeholder for lazy loading -->
                            <div class="image-placeholder">
                                <div class="skeleton-shimmer"></div>
                                <div class="placeholder-icon">
                                    <i class="fas fa-utensils"></i>
                                </div>
                            </div>
                            <!-- Lazy loaded image -->
                            <img 
                                class="menu-item-image lazy-image" 
                                data-src="${item.image}" 
                                alt="${item.name}" 
                                style="display: none; opacity: 0;"
                            >
                        </div>
                        <div class="menu-item-info">
                            <h3 class="dish-name">${item.name}</h3>
                        </div>
                        <div class="quick-actions">
                            <button class="quick-action-btn like-btn" data-id="${item.id}">
                                <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                            <button class="quick-action-btn cart-btn" data-id="${item.id}">
                                <i class="fas fa-shopping-cart"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
            }).join('');
            
            itemsHTML += categoryItemsHTML;
        }
    });
    
    grid.innerHTML = itemsHTML;
    
    // Setup lazy loading for regular menu items
    const lazyItems = grid.querySelectorAll('.menu-item-image-container[data-id]');
    lazyItems.forEach(item => {
        lazyLoadManager.observeElement(item);
    });
    
    // Load Instagram embed script
    loadInstagramScript();
    
    // Add event listeners
    addMenuItemEventListeners(grid);
    updateCartCount();
    
    // Force masonry grid reflow for initial render
    setTimeout(() => {
        const forceReflow = () => {
            // Reset any inline styles that might interfere
            grid.style.columnCount = '';
            grid.style.height = '';
            
            // Force a reflow by reading layout properties
            grid.offsetHeight;
            
            // Trigger a window resize event to help with any remaining layout issues
            window.dispatchEvent(new Event('resize'));
        };
        
        forceReflow();
        
        // Additional reflow after a longer delay
        setTimeout(forceReflow, 100);
    }, 50);
    
    // Update category FAB with available categories
    updateAvailableCategories();
    
    // Note: Removed the setInterval for Instagram scaling as it's heavy
    // Instagram embeds will auto-scale when they load
};

// Add event listeners to menu items with debugging
const addMenuItemEventListeners = (container) => {
    const containerName = container.id === 'menuGrid' ? 'MAIN_GRID' : 'PREVIEW_GRID';
    
    container.querySelectorAll('.menu-item').forEach(item => {
        // Remove existing listeners by cloning
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', (e) => {
            if (!e.target.closest('.quick-action-btn')) {
                // Try to get ID from the image container first, then fall back to the menu item
                const imageContainer = newItem.querySelector('.menu-item-image-container[data-id]');
                const itemId = imageContainer ? parseInt(imageContainer.dataset.id) : parseInt(newItem.dataset.id);
                console.log(`${containerName}: Clicked item ID ${itemId} - ${menuItems.find(m => m.id === itemId)?.name}`);
                showPreview(itemId);
            }
        });
    });
    
    container.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = parseInt(btn.dataset.id);
            toggleLike(itemId);
        });
    });
    
    container.querySelectorAll('.cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = parseInt(btn.dataset.id);
            addToCart(itemId);
        });
    });
    
    container.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = parseInt(btn.dataset.id);
            const item = menuItems.find(i => i.id === itemId);
            if (item) {
                shareItem(item);
            }
        });
    });
};

// Preload images for smooth swiping
const preloadImages = (centerIndex) => {
    const preloadIndices = [
        centerIndex,
        (centerIndex + 1) % filteredMenuItems.length,
        centerIndex === 0 ? filteredMenuItems.length - 1 : centerIndex - 1
    ];
    
    preloadIndices.forEach(index => {
        const item = filteredMenuItems[index];
        if (item && !preloadedImages[item.id]) {
            const img = new Image();
            img.src = item.image;
            preloadedImages[item.id] = img;
        }
    });
};

// Load Instagram embed script
const loadInstagramScript = () => {
    if (!document.querySelector('script[src*="instagram.com/embed.js"]')) {
        const script = document.createElement('script');
        script.src = '//www.instagram.com/embed.js';
        script.async = true;
        script.onload = handleInstagramLoad;
        document.body.appendChild(script);
    } else if (window.instgrm) {
        // Process existing embeds
        window.instgrm.Embeds.process();
        // Set up observer for new embeds
        setTimeout(handleInstagramLoad, 1000);
    }
};

// Handle Instagram content after it loads
const handleInstagramLoad = () => {
    if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
        
        // Set up observer to handle when Instagram embeds are fully rendered
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && (node.classList?.contains('instagram-media-rendered') || 
                            node.querySelector?.('.instagram-media-rendered'))) {
                            // Delay scaling to ensure content is fully loaded
                            setTimeout(scaleInstagramEmbeds, 500);
                        }
                    });
                }
                
                // Also watch for attribute changes (like style changes)
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.classList?.contains('instagram-media-rendered') || 
                        target.closest('.instagram-embed-container')) {
                        setTimeout(scaleInstagramEmbeds, 100);
                    }
                }
            });
        });
        
        // Observe all Instagram containers
        document.querySelectorAll('.instagram-embed-container').forEach(container => {
            observer.observe(container, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['style', 'class'] 
            });
        });
        
        // Initial scaling
        setTimeout(scaleInstagramEmbeds, 2000);
    }
};

// Scale Instagram embeds to fit containers
const scaleInstagramEmbeds = () => {
    document.querySelectorAll('.instagram-embed-container').forEach(container => {
        const instagramMedia = container.querySelector('.instagram-media-rendered') || 
                              container.querySelector('.instagram-media');
        
        if (instagramMedia) {
            // Get container dimensions
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Get original embed dimensions
            const embedWidth = instagramMedia.offsetWidth || instagramMedia.scrollWidth;
            const embedHeight = instagramMedia.offsetHeight || instagramMedia.scrollHeight;
            
            if (embedWidth > 0 && embedHeight > 0) {
                // Calculate scale factors for both width and height
                const scaleX = containerWidth / embedWidth;
                const scaleY = containerHeight / embedHeight;
                
                // Use the smaller scale to ensure entire content is visible
                const scale = Math.min(scaleX, scaleY, 1);
                
                // Apply the scaling
                instagramMedia.style.transform = `scale(${scale})`;
                instagramMedia.style.transformOrigin = 'center center';
                
                // Handle iframe inside the embed
                const iframe = instagramMedia.querySelector('iframe');
                if (iframe) {
                    iframe.style.transform = 'none'; // Reset iframe transform to avoid double scaling
                }
            }
        }
    });
};

// Update specific slide content
const updateSlideContent = (slideId, item) => {
    if (!item) return;
    
    const slide = document.getElementById(slideId);
    const title = slide.querySelector('.preview-title');
    const descriptionText = slide.querySelector('.description-text');
    const descriptionPrice = slide.querySelector('.description-price');
    
    if (item.type === 'ipost' || item.type === 'ireel') {
        // Handle Instagram item
        const imageContainer = slide.querySelector('.preview-image-container');
        const embedHtml = generateInstagramEmbed(item.instagramUrl);
        imageContainer.innerHTML = `
            <div class="instagram-embed-preview">
                ${embedHtml}
            </div>
        `;
        // Set max height for Instagram embed containers
        imageContainer.style.maxHeight = '900px';
        imageContainer.style.height = 'auto';
        title.textContent = item.name;
        descriptionText.textContent = ''; // Hide description for Instagram items
        descriptionText.style.display = 'none'; // Hide the description element
        // descriptionPrice.textContent = item.type === 'ipost' ? 'Instagram Post' : 'Instagram Reel';
        descriptionPrice.textContent = '';
        descriptionPrice.style.display = 'none';
        
        // Process Instagram embeds
        if (window.instgrm) {
            setTimeout(() => window.instgrm.Embeds.process(), 100);
        }
    } else {
        // Handle regular menu item
        const imageContainer = slide.querySelector('.preview-image-container');
        imageContainer.innerHTML = `<img src="${item.image}" alt="${item.name}" class="preview-image">`;
        title.textContent = item.name;
        descriptionText.textContent = item.description;
        descriptionText.style.display = 'block'; // Show description for regular items
        descriptionPrice.textContent = item.price;
        descriptionPrice.style.display = 'block';
    }
};

// Update all three slides (previous, current, next)
const updateAllSlides = () => {
    const prevIndex = currentPreviewIndex === 0 ? filteredMenuItems.length - 1 : currentPreviewIndex - 1;
    const nextIndex = (currentPreviewIndex + 1) % filteredMenuItems.length;
    
    // Update all slide contents
    updateSlideContent('previousSlide', filteredMenuItems[prevIndex]);
    updateSlideContent('currentSlide', filteredMenuItems[currentPreviewIndex]);
    updateSlideContent('nextSlide', filteredMenuItems[nextIndex]);
    
    // Update like button state for current item only
    const likeBtn = document.getElementById('previewLikeBtn');
    const likeIcon = likeBtn.querySelector('i');
    if (likedItems.has(currentPreviewItem.id)) {
        likeBtn.classList.add('liked');
        likeIcon.className = 'fas fa-heart';
    } else {
        likeBtn.classList.remove('liked');
        likeIcon.className = 'far fa-heart';
    }
    
    // Reset quantity for regular items
    if (currentPreviewItem.type !== 'ipost' && currentPreviewItem.type !== 'ireel') {
        document.getElementById('quantity').textContent = '1';
    }
};

// Update preview action buttons based on item type
const updatePreviewActions = () => {
    const addToCartBtn = document.getElementById('previewAddToCartBtn');
    const quantityContainer = document.querySelector('.quantity-container');
    
    if (currentPreviewItem && (currentPreviewItem.type === 'ipost' || currentPreviewItem.type === 'ireel')) {
        // Hide cart and quantity controls for Instagram items
        addToCartBtn.style.display = 'none';
        quantityContainer.style.display = 'none';
    } else {
        // Show cart and quantity controls for regular items
        addToCartBtn.style.display = 'flex';
        quantityContainer.style.display = 'flex';
    }
};

// Navigate to next item
const showNextItem = () => {
    if (isAnimating) return;
    
    isAnimating = true;
    const nextIndex = (currentPreviewIndex + 1) % filteredMenuItems.length;
    const nextItem = filteredMenuItems[nextIndex];
    
    console.log(`Swiping to NEXT: ${nextIndex} - ${nextItem.name}`);
    
    // Update state immediately
    currentPreviewIndex = nextIndex;
    currentPreviewItem = nextItem;
    
    const slider = document.getElementById('previewSlider');
    
    // Animate to show next slide
    slider.style.transform = 'translateX(-66.666%)';
    
    setTimeout(() => {
            // Update all slides with new content
    updateAllSlides();
    
    // Update thumbnails for the new item's category
    renderPreviewThumbnails(nextItem);
    
    // Reset position to center without animation
    slider.style.transition = 'none';
    slider.style.transform = 'translateX(-33.333%)';
    
    // Re-enable animation
    setTimeout(() => {
        slider.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        isAnimating = false;
        
        // Scroll to top after swipe completes
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, 50);
    
    preloadImages(nextIndex);
    
    // Update action buttons visibility
    updatePreviewActions();
    }, 300);
};

// Navigate to previous item
const showPreviousItem = () => {
    if (isAnimating) return;
    
    isAnimating = true;
    const prevIndex = currentPreviewIndex === 0 ? filteredMenuItems.length - 1 : currentPreviewIndex - 1;
    const prevItem = filteredMenuItems[prevIndex];
    
    console.log(`Swiping to PREVIOUS: ${prevIndex} - ${prevItem.name}`);
    
    // Update state immediately
    currentPreviewIndex = prevIndex;
    currentPreviewItem = prevItem;
    
    const slider = document.getElementById('previewSlider');
    
    // Animate to show previous slide
    slider.style.transform = 'translateX(0%)';
    
    setTimeout(() => {
        // Update all slides with new content
        updateAllSlides();
        
        // Update thumbnails for the new item's category
        renderPreviewThumbnails(prevItem);
        
        // Reset position to center without animation
        slider.style.transition = 'none';
        slider.style.transform = 'translateX(-33.333%)';
        
        // Re-enable animation
        setTimeout(() => {
            slider.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            isAnimating = false;
            
            // Scroll to top after swipe completes
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }, 50);
        
            preloadImages(prevIndex);
    
    // Update action buttons visibility
    updatePreviewActions();
}, 300);
};

// Handle touch events for smooth dragging
const handleTouchStart = (e) => {
    if (!isSwipeEnabled || isAnimating) return;
    touchStartX = e.changedTouches[0].screenX;
    touchCurrentX = touchStartX;
    isSwiping = false;
    
    const slider = document.getElementById('previewSlider');
    slider.style.transition = 'none';
};

const handleTouchMove = (e) => {
    if (!isSwipeEnabled || isAnimating) return;
    
    touchCurrentX = e.changedTouches[0].screenX;
    const swipeDistance = touchCurrentX - touchStartX;
    const maxSwipe = 100;
    const clampedDistance = Math.max(-maxSwipe, Math.min(maxSwipe, swipeDistance));
    
    if (Math.abs(swipeDistance) > 10) {
        isSwiping = true;
        
        // Calculate new transform based on swipe distance
        const baseTransform = -33.333; // Center position
        const swipePercent = (clampedDistance / window.innerWidth) * 33.333; // 1/3 of total width
        const newTransform = baseTransform + swipePercent;
        
        const slider = document.getElementById('previewSlider');
        slider.style.transform = `translateX(${newTransform}%)`;
    }
};

const handleTouchEnd = (e) => {
    if (!isSwipeEnabled || isAnimating) return;
    
    const slider = document.getElementById('previewSlider');
    slider.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    if (isSwiping) {
        const swipeDistance = touchCurrentX - touchStartX;
        const swipeThreshold = 50;
        
        if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance > 0) {
                showPreviousItem();
            } else {
                showNextItem();
            }
        } else {
            // Return to center position
            slider.style.transform = 'translateX(-33.333%)';
        }
    }
    
    isSwiping = false;
};

// Show swipe indicator (removed - no longer needed)
const showSwipeIndicator = () => {
    // Removed for clean experience
};

// Setup swipe listeners
const setupSwipeListeners = () => {
    const previewContent = document.getElementById('previewContent');
    if (previewContent) {
        previewContent.addEventListener('touchstart', handleTouchStart, { passive: true });
        previewContent.addEventListener('touchmove', handleTouchMove, { passive: false });
        previewContent.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
};

// Render preview thumbnails with category filtering and current item exclusion
const renderPreviewThumbnails = (currentItem) => {
    const previewGrid = document.getElementById('previewMenuGrid');
    const categoryHeading = document.getElementById('previewCategoryHeading');
    const categoryHeadingText = categoryHeading.querySelector('.category-heading-text');
    
    if (!currentItem) {
        previewGrid.innerHTML = '';
        categoryHeading.style.display = 'none';
        return;
    }
    
    // Update category heading
    const categoryName = currentItem.category || 'Other';
    categoryHeadingText.textContent = `Other ${categoryName}`;
    categoryHeading.style.display = 'block';
    
    // Filter items: same category, exclude current item
    const categoryItems = filteredMenuItems.filter(item => 
        item.category === currentItem.category && item.id !== currentItem.id
    );
    
    console.log(`Rendering preview thumbnails for category "${currentItem.category}": ${categoryItems.length} items (excluding current item)`);
    
    if (categoryItems.length === 0) {
        previewGrid.innerHTML = '<div class="no-thumbnails-message"><p>No other items in this category</p></div>';
        return;
    }
    
    // Generate HTML for category items (no category headers in thumbnails)
    const itemsHTML = categoryItems.map(item => {
        if (item.type === 'ipost' || item.type === 'ireel') {
            // Render Instagram item
            const embedHtml = generateInstagramEmbed(item.instagramUrl);
            return `
                <div class="menu-item instagram-item" data-id="${item.id}" data-type="${item.type}" data-category="${item.category}">
                    <div class="instagram-embed-container">
                        ${embedHtml}
                    </div>
                    <div class="quick-actions">
                        <button class="quick-action-btn like-btn" data-id="${item.id}">
                            <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="quick-action-btn share-btn" data-id="${item.id}">
                            <i class="fas fa-share"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Render regular menu item with immediate loading (no lazy loading for thumbnails)
            return `
                <div class="menu-item" data-category="${item.category}">
                    <div class="menu-item-image-container" data-id="${item.id}">
                        <img 
                            class="menu-item-image" 
                            src="${item.image}" 
                            alt="${item.name}"
                            loading="lazy"
                        >
                    </div>
                    <div class="menu-item-info">
                        <h3 class="dish-name">${item.name}</h3>
                    </div>
                    <div class="quick-actions">
                        <button class="quick-action-btn like-btn" data-id="${item.id}">
                            <i class="${likedItems.has(item.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="quick-action-btn cart-btn" data-id="${item.id}">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    // Update preview grid with filtered content
    previewGrid.innerHTML = itemsHTML;
    
    // Add event listeners to the new thumbnails
    addMenuItemEventListeners(previewGrid);
    
    // Force masonry reflow for thumbnails
    setTimeout(() => {
        previewGrid.style.columnCount = '';
        previewGrid.style.height = '';
        previewGrid.offsetHeight;
    }, 50);
};

// Show preview mode
const showPreview = (itemId) => {
    const item = filteredMenuItems.find(i => i.id === itemId);
    if (!item) {
        console.error(`Item not found for ID: ${itemId}`);
        return;
    }
    
    console.log(`Opening preview for: ${itemId} - ${item.name}`);
    
    currentPreviewItem = item;
    currentPreviewIndex = filteredMenuItems.findIndex(i => i.id === itemId);
    
    // Update all slides
    updateAllSlides();
    
    // Update action buttons for current item type
    updatePreviewActions();
    
    // Render filtered thumbnails for the same category (excluding current item)
    renderPreviewThumbnails(item);
    
    // Show preview page and hide feed
    document.getElementById('feedPage').style.display = 'none';
    document.getElementById('previewPage').classList.add('active');
    
    // Reset all UI state for clean preview experience
    document.getElementById('topHeader').classList.remove('visible');
    document.getElementById('bottomHeader').classList.remove('visible');
    document.getElementById('scrollToTopBtn').classList.remove('visible');
    
    // Reset back to top flag to ensure clean state
    isBackToTopClicked = false;
    
    // Close category FAB when entering preview mode
    closeCategoryFab();
    
    // Enable swipe functionality
    isSwipeEnabled = true;
    
    // Preload adjacent images
    preloadImages(currentPreviewIndex);
    
    // Scroll to top of preview (instant, not smooth)
    window.scrollTo(0, 0);
    
    // Set up scroll listener for when user scrolls to thumbnails
    setupPreviewScrollListener();
    
    // Force trigger scroll handler after a brief delay to ensure proper state
    setTimeout(() => {
        if (window.previewScrollHandler) {
            window.previewScrollHandler();
        }
    }, 100);
};

// Set up scroll listener for preview mode
const setupPreviewScrollListener = () => {
    const handlePreviewScroll = () => {
        const thumbnailsSection = document.getElementById('previewThumbnails');
        const thumbnailsRect = thumbnailsSection.getBoundingClientRect();
        const scrollToTopBtn = document.getElementById('scrollToTopBtn');
        const topHeader = document.getElementById('topHeader');
        const bottomHeader = document.getElementById('bottomHeader');
        const currentScrollY = window.scrollY;
        
        // If back to top was clicked and we're near the top, hide everything
        if (isBackToTopClicked && currentScrollY <= 50) {
            hideBackToTopElements();
            return;
        }
        
        // If user scrolls down after back to top, reset the flag to resume normal behavior
        if (isBackToTopClicked && currentScrollY > 100) {
            isBackToTopClicked = false;
        }
        
        // Normal scroll behavior
        const isInThumbnailsSection = thumbnailsRect.top <= window.innerHeight && thumbnailsRect.bottom > 0;
        
        // Only apply normal scroll logic if back to top wasn't clicked
        if (!isBackToTopClicked) {
            if (isInThumbnailsSection) {
                // Show scroll-to-top button when in thumbnails section
                scrollToTopBtn.classList.add('visible');
                // Show bottom header when in thumbnails section
                bottomHeader.classList.add('visible');
                // Hide top header in thumbnails
                topHeader.classList.remove('visible');
            } else {
                // Hide scroll-to-top button when not in thumbnails section
                scrollToTopBtn.classList.remove('visible');
                // Hide bottom header when not in thumbnails section
                bottomHeader.classList.remove('visible');
                // Keep top header hidden in preview content
                topHeader.classList.remove('visible');
            }
        }
    };
    
    // Remove existing listener if any
    window.removeEventListener('scroll', window.previewScrollHandler);
    
    // Add new listener
    window.previewScrollHandler = handlePreviewScroll;
    window.addEventListener('scroll', handlePreviewScroll);
};

// Set up scroll listener for main feed
const setupFeedScrollListener = () => {
    const handleFeedScroll = () => {
        // Show bottom header in feed mode
        document.getElementById('bottomHeader').classList.add('visible');
        document.getElementById('topHeader').classList.remove('visible');
    };
    
    // Remove existing listener if any
    window.removeEventListener('scroll', window.previewScrollHandler);
    
    // Add feed scroll behavior
    window.addEventListener('scroll', handleFeedScroll);
    
    // Initially show bottom header
    setTimeout(() => {
        document.getElementById('bottomHeader').classList.add('visible');
    }, 100);
};

// Go back to feed
const goBackToFeed = () => {
    document.getElementById('previewPage').classList.remove('active');
    document.getElementById('feedPage').style.display = 'block';
    
    // Show bottom header, hide top header
    document.getElementById('topHeader').classList.remove('visible');
    
    // Disable swipe functionality
    isSwipeEnabled = false;
    
    // Remove preview scroll listener and set up feed listener
    window.removeEventListener('scroll', window.previewScrollHandler);
    setupFeedScrollListener();
    
    // Hide scroll-to-top button
    document.getElementById('scrollToTopBtn').classList.remove('visible');
    
    // Close category FAB if open
    closeCategoryFab();
};

// Scroll to top function
const scrollToTop = () => {
    isBackToTopClicked = true; // Set flag when back to top is clicked
    
    // Hide elements immediately if already at top
    if (window.scrollY <= 20) {
        hideBackToTopElements();
        return;
    }
    
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Use timeout as backup to ensure elements hide after smooth scroll
    setTimeout(() => {
        if (isBackToTopClicked) {
            hideBackToTopElements();
        }
    }, 800); // Wait for smooth scroll animation to complete
};

// Helper function to hide back-to-top related elements
const hideBackToTopElements = () => {
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const topHeader = document.getElementById('topHeader');
    const bottomHeader = document.getElementById('bottomHeader');
    
    scrollToTopBtn.classList.remove('visible');
    topHeader.classList.remove('visible');
    bottomHeader.classList.remove('visible');
    isBackToTopClicked = false; // Reset the flag
};

// Toggle like
const toggleLike = (itemId) => {
    if (likedItems.has(itemId)) {
        likedItems.delete(itemId);
    } else {
        likedItems.add(itemId);
    }
    
    // Update all like buttons for this item
    document.querySelectorAll(`.like-btn[data-id="${itemId}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (likedItems.has(itemId)) {
            icon.className = 'fas fa-heart';
            btn.style.color = '#e53e3e';
            // Add animation
            icon.style.animation = 'heartPulse 0.6s ease';
            setTimeout(() => icon.style.animation = '', 600);
        } else {
            icon.className = 'far fa-heart';
            btn.style.color = '';
        }
    });
    
    // Update preview like button if showing this item
    if (currentPreviewItem && currentPreviewItem.id === itemId) {
        const previewLikeBtn = document.getElementById('previewLikeBtn');
        const previewLikeIcon = previewLikeBtn.querySelector('i');
        
        if (likedItems.has(itemId)) {
            previewLikeBtn.classList.add('liked');
            previewLikeIcon.className = 'fas fa-heart';
        } else {
            previewLikeBtn.classList.remove('liked');
            previewLikeIcon.className = 'far fa-heart';
        }
    }
    
    saveUserPreferences();
    showToast(likedItems.has(itemId) ? 'Added to favorites!' : 'Removed from favorites');
};

// Add to cart
const addToCart = (itemId, quantity = 1) => {
    const item = menuItems.find(i => i.id === itemId); // Use original menuItems for cart (not filtered)
    if (!item) return;
    
    // Instagram items cannot be added to cart
    if (item.type === 'ipost' || item.type === 'ireel') {
        showToast('Instagram content cannot be added to cart');
        return;
    }
    
    const existingItem = cartItems.find(cartItem => cartItem.id === itemId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cartItems.push({
            ...item,
            quantity: quantity
        });
    }
    
    updateCartCount();
    saveUserPreferences();
    showToast(`Added ${item.name} to cart!`);
};

// Update cart count
const updateCartCount = () => {
    const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(counter => {
        counter.textContent = totalItems;
        counter.style.display = totalItems > 0 ? 'flex' : 'none';
    });
};

// Show toast notification
const showToast = (message) => {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
};

// Save user preferences
const saveUserPreferences = () => {
    localStorage.setItem('likedItems', JSON.stringify([...likedItems]));
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
};

// Load user preferences
const loadUserPreferences = () => {
    const savedLikes = localStorage.getItem('likedItems');
    const savedCart = localStorage.getItem('cartItems');
    
    if (savedLikes) {
        likedItems = new Set(JSON.parse(savedLikes));
    }
    
    if (savedCart) {
        cartItems = JSON.parse(savedCart);
    }
    
    updateCartCount();
};

// Desktop Warning Functions
const initDesktopWarning = () => {
    const continueBtn = document.getElementById('continueDesktop');
    const shareBtn = document.getElementById('shareToMobile');
    
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            document.body.classList.add('desktop-continue');
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const shareData = {
                title: 'Aglio Restaurant Menu',
                text: 'Check out this mobile-optimized restaurant menu!',
                url: window.location.href
            };
            
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    await navigator.clipboard.writeText(window.location.href);
                    showToast('Link copied to clipboard!');
                }
            } catch (error) {
                await navigator.clipboard.writeText(window.location.href);
                showToast('Link copied to clipboard!');
            }
        });
    }
};

// Share functionality
const shareItem = async (item) => {
    let shareData;
    
    if (item.type === 'ipost' || item.type === 'ireel') {
        // For Instagram items, use the direct Instagram URL
        const instagramUrl = item.instagramUrl || window.location.href;
        
        shareData = {
            title: item.name,
            text: `Check out this ${item.type === 'ipost' ? 'Instagram post' : 'Instagram reel'} from Aglio Restaurant!`,
            url: instagramUrl
        };
    } else {
        shareData = {
            title: item.name,
            text: `Check out this delicious ${item.name} at Aglio Restaurant!`,
            url: window.location.href
        };
    }
    
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            showToast('Link copied to clipboard!');
        }
    } catch (error) {
        showToast('Unable to share');
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadMenuItems();
    loadThemePreference(); // Load saved theme preference
    initDesktopWarning();
    setupSwipeListeners();
    
    // Theme toggle buttons
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('themeToggleBottom').addEventListener('click', toggleTheme);
    
    // Filter modal buttons
    document.getElementById('filtersBtn').addEventListener('click', openFilterModal);
    document.getElementById('closeFilterBtn').addEventListener('click', closeFilterModal);
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    
    // Close modal when clicking outside
    document.getElementById('filterModal').addEventListener('click', (e) => {
        if (e.target.id === 'filterModal') {
            closeFilterModal();
        }
    });
    
    // Back button (header back button)
    document.getElementById('backBtn').addEventListener('click', goBackToFeed);
    
    // Persistent back button in preview mode
    document.getElementById('previewBackBtn').addEventListener('click', goBackToFeed);
    
    // Scroll to top button
    document.getElementById('scrollToTopBtn').addEventListener('click', scrollToTop);
    
    // Preview action buttons
    document.getElementById('previewLikeBtn').addEventListener('click', () => {
        if (currentPreviewItem) {
            toggleLike(currentPreviewItem.id);
        }
    });
    
    document.getElementById('previewAddToCartBtn').addEventListener('click', () => {
        if (currentPreviewItem && currentPreviewItem.type !== 'ipost' && currentPreviewItem.type !== 'ireel') {
            const quantity = parseInt(document.getElementById('quantity').textContent);
            addToCart(currentPreviewItem.id, quantity);
        }
    });
    
    document.getElementById('previewShareBtn').addEventListener('click', () => {
        if (currentPreviewItem) {
            shareItem(currentPreviewItem);
        }
    });
    
    // Quantity controls
    document.getElementById('decreaseQty').addEventListener('click', () => {
        const qtyElement = document.getElementById('quantity');
        const currentQty = parseInt(qtyElement.textContent);
        if (currentQty > 1) {
            qtyElement.textContent = currentQty - 1;
        }
    });
    
    document.getElementById('increaseQty').addEventListener('click', () => {
        const qtyElement = document.getElementById('quantity');
        const currentQty = parseInt(qtyElement.textContent);
        if (currentQty < 10) {
            qtyElement.textContent = currentQty + 1;
        }
    });
    
    // Set up initial feed scroll listener
    setupFeedScrollListener();
    
    // Initialize category FAB
    setupCategoryFabListeners();
    
    // Handle window resize for Instagram scaling and masonry layout
    window.addEventListener('resize', () => {
        setTimeout(scaleInstagramEmbeds, 300);
        
        // Also help with masonry layout on resize
        const grids = document.querySelectorAll('.masonry-grid');
        grids.forEach(grid => {
            // Force reflow
            grid.style.columnCount = '';
            grid.style.height = '';
            grid.offsetHeight;
        });
    });
}); 