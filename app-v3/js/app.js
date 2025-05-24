// Global state
let menuItems = [];
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

// Load menu items from local images
const loadMenuItems = async () => {
    menuItems = [
        {
            id: 1,
            name: "Chianti's Signature Mozzarella Stuffed Chicken",
            price: "$28.99",
            description: "Tender chicken breast stuffed with creamy mozzarella cheese and herbs, served with roasted vegetables and garlic mashed potatoes.",
            image: "images/Chianti'S_Signature_Mozzarella_Stuffed_Chicken.png"
        },
        {
            id: 2,
            name: "Surf & Turf (Tenderloin and Prawn)",
            price: "$42.99",
            description: "Premium beef tenderloin paired with succulent prawns, grilled to perfection and served with seasonal vegetables.",
            image: "images/Surf_&_Turf_(Tenderloin_and_Prawn).png"
        },
        {
            id: 3,
            name: "Grilled Lamb Chops",
            price: "$36.99",
            description: "Herb-crusted lamb chops grilled to your preference, served with mint sauce and roasted root vegetables.",
            image: "images/Grilled_Lamb_Chops.png"
        },
        {
            id: 4,
            name: "Chicken Parmigiana",
            price: "$24.99",
            description: "Crispy breaded chicken breast topped with marinara sauce and melted mozzarella, served over pasta.",
            image: "images/Chicken_Parmigiana.png"
        },
        {
            id: 5,
            name: "Chianti's Signature Grilled Chicken",
            price: "$22.99",
            description: "Marinated grilled chicken breast with our signature blend of herbs and spices, served with seasonal sides.",
            image: "images/Chianti'S_Signature_Grilled_Chicken.png"
        },
        {
            id: 6,
            name: "Vegan Penne Con Broccoli",
            price: "$18.99",
            description: "Fresh penne pasta with crisp broccoli, garlic, olive oil, and nutritional yeast in a light herb sauce.",
            image: "images/Vegan_Penne_Con_Broccoli.png"
        },
        {
            id: 7,
            name: "Mediterranean Vegetable Platter",
            price: "$16.99",
            description: "A colorful array of grilled Mediterranean vegetables with hummus, olives, and fresh herbs.",
            image: "images/Veg_Platter.png"
        }
    ];

    renderMenuItems();
    loadUserPreferences();
};

// Render menu items in masonry grid
const renderMenuItems = () => {
    const grid = document.getElementById('menuGrid');
    const previewGrid = document.getElementById('previewMenuGrid');
    
    const itemsHTML = menuItems.map(item => `
        <div class="menu-item" data-id="${item.id}">
            <img src="${item.image}" alt="${item.name}" class="menu-item-image" loading="lazy">
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
    `).join('');
    
    grid.innerHTML = itemsHTML;
    previewGrid.innerHTML = itemsHTML;
    
    // Add event listeners
    addMenuItemEventListeners(grid);
    addMenuItemEventListeners(previewGrid);
    updateCartCount();
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
                const itemId = parseInt(newItem.dataset.id);
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
};

// Preload images for smooth swiping
const preloadImages = (centerIndex) => {
    const preloadIndices = [
        centerIndex,
        (centerIndex + 1) % menuItems.length,
        centerIndex === 0 ? menuItems.length - 1 : centerIndex - 1
    ];
    
    preloadIndices.forEach(index => {
        const item = menuItems[index];
        if (item && !preloadedImages[item.id]) {
            const img = new Image();
            img.src = item.image;
            preloadedImages[item.id] = img;
        }
    });
};

// Update specific slide content
const updateSlideContent = (slideId, item) => {
    if (!item) return;
    
    const slide = document.getElementById(slideId);
    const image = slide.querySelector('img');
    const title = slide.querySelector('.preview-title');
    const descriptionText = slide.querySelector('.description-text');
    const descriptionPrice = slide.querySelector('.description-price');
    
    image.src = item.image;
    title.textContent = item.name;
    descriptionText.textContent = item.description;
    descriptionPrice.textContent = item.price;
};

// Update all three slides (previous, current, next)
const updateAllSlides = () => {
    const prevIndex = currentPreviewIndex === 0 ? menuItems.length - 1 : currentPreviewIndex - 1;
    const nextIndex = (currentPreviewIndex + 1) % menuItems.length;
    
    // Update all slide contents
    updateSlideContent('previousSlide', menuItems[prevIndex]);
    updateSlideContent('currentSlide', menuItems[currentPreviewIndex]);
    updateSlideContent('nextSlide', menuItems[nextIndex]);
    
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
    
    // Reset quantity
    document.getElementById('quantity').textContent = '1';
};

// Navigate to next item
const showNextItem = () => {
    if (isAnimating) return;
    
    isAnimating = true;
    const nextIndex = (currentPreviewIndex + 1) % menuItems.length;
    const nextItem = menuItems[nextIndex];
    
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
    }, 300);
};

// Navigate to previous item
const showPreviousItem = () => {
    if (isAnimating) return;
    
    isAnimating = true;
    const prevIndex = currentPreviewIndex === 0 ? menuItems.length - 1 : currentPreviewIndex - 1;
    const prevItem = menuItems[prevIndex];
    
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

// Show preview mode
const showPreview = (itemId) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) {
        console.error(`Item not found for ID: ${itemId}`);
        return;
    }
    
    console.log(`Opening preview for: ${itemId} - ${item.name}`);
    
    currentPreviewItem = item;
    currentPreviewIndex = menuItems.findIndex(i => i.id === itemId);
    
    // Update all slides
    updateAllSlides();
    
    // Show preview page and hide feed
    document.getElementById('feedPage').style.display = 'none';
    document.getElementById('previewPage').classList.add('active');
    
    // Reset all UI state for clean preview experience
    document.getElementById('topHeader').classList.remove('visible');
    document.getElementById('bottomHeader').classList.remove('visible');
    document.getElementById('scrollToTopBtn').classList.remove('visible');
    
    // Reset back to top flag to ensure clean state
    isBackToTopClicked = false;
    
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
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    
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
    const shareData = {
        title: item.name,
        text: `Check out this delicious ${item.name} at Aglio Restaurant!`,
        url: window.location.href
    };
    
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
        if (currentPreviewItem) {
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
}); 