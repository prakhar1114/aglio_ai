import React, { useState, useRef, useEffect } from 'react';
import { useCartStore, useSessionStore, addItemToCart, updateCartItem, deleteCartItem, useChatStore } from '@qrmenu/core';
import { useSwipeable } from 'react-swipeable';
import { SimpleMasonryGrid } from '../components/SimpleMasonryGrid.jsx';
import { OptimizedMedia } from '../components/OptimizedMedia.jsx';



// Header Component - Minimal design
function Header({ onClose }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-start p-4 pt-6">
      <button
        onClick={onClose}
        className="flex items-center justify-center w-11 h-11 bg-white bg-opacity-95 backdrop-blur-md rounded-full shadow-lg transition-all duration-200 hover:bg-opacity-100 hover:scale-105"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}

// Progress Dots Component
function ProgressDots({ currentIndex, totalItems }) {
  if (totalItems <= 1) return null;
  
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
      {Array.from({ length: Math.min(totalItems, 5) }, (_, index) => {
        let isActive = false;
        
        if (totalItems <= 5) {
          // For 5 or fewer items, show normal behavior
          isActive = index === currentIndex;
        } else {
          // For more than 5 items, use Instagram-like logic
          if (currentIndex <= 2) {
            // At the beginning, show normal dots
            isActive = index === currentIndex;
          } else if (currentIndex >= totalItems - 2) {
            // At the end, map to the last few dots
            const endOffset = totalItems - currentIndex - 1;
            isActive = index === 4 - endOffset;
          } else {
            // In the middle, keep active dot at position 3 (4th dot)
            isActive = index === 3;
          }
        }
        
        return (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isActive 
                ? 'bg-white shadow-lg' 
                : 'bg-white bg-opacity-50'
            }`}
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />
        );
      })}
    </div>
  );
}

// Media Section Component
function MediaSection({ item, currentIndex, totalItems }) {
  // Calculate dynamic viewport width for optimal media sizing
  const getViewportWidth = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 428; // Fallback for SSR
  };

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());
  console.log("viewportWidth media ", viewportWidth)

  // Update viewport width on resize
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(getViewportWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full bg-gray-100 flex items-center justify-center">
      {(item.image_url || item.cloudflare_image_id || item.cloudflare_video_id) ? (
        <OptimizedMedia
          imageUrl={item.image_url}
          cloudflareImageId={item.cloudflare_image_id}
          cloudflareVideoId={item.cloudflare_video_id}
          alt={item.name}
          containerWidth={viewportWidth}
          containerHeight={viewportWidth * (9 / 16)}
          className="w-full h-auto"
        />
      ) : (
        <div className="text-gray-400 text-6xl py-16">🍽️</div>
      )}
      
      {/* Progress Dots */}
      <ProgressDots currentIndex={currentIndex} totalItems={totalItems} />
    </div>
  );
}

// Compact Action Buttons Component
function CompactActionButtons({ item, onAskAI }) {
  // Calculate current quantity for this menu item from shared cart
  const { items } = useCartStore();
  const { memberPid } = useSessionStore();
  
  // Find the current user's cart items for this menu item
  const userCartItems = items.filter(cartItem => 
    cartItem.menu_item_pid === item.id && cartItem.member_pid === memberPid
  );
  const qty = userCartItems.reduce((total, cartItem) => total + cartItem.qty, 0);

  const handleAdd = () => {
    if (qty === 0) {
      // Item not in cart, add new item
      addItemToCart(item, 1, ''); // item, qty, note
    } else {
      // Item already in cart, update existing item's quantity
      const cartItem = userCartItems[0]; // Get the first (should be only one per user per item)
      if (cartItem) {
        updateCartItem(cartItem.public_id, cartItem.qty + 1, cartItem.note, cartItem.version);
      }
    }
  };

  const handleRemove = () => {
    // Find the first item to decrease or remove
    const cartItem = userCartItems[0];
    if (!cartItem) {
      console.log('No cart item found to remove for menu item:', item.id);
      return;
    }
    
    console.log('Removing cart item:', cartItem);
    
    if (cartItem.qty === 1) {
      deleteCartItem(cartItem.public_id, cartItem.version);
    } else {
      updateCartItem(cartItem.public_id, cartItem.qty - 1, cartItem.note, cartItem.version);
    }
  };

  const buttonBaseStyle = {
    borderRadius: '8px',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '14px',
    transition: 'all 0.2s ease-in-out',
    border: 'none',
    cursor: 'pointer',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const addButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#E23744',
    color: '#FFFFFF',
    minWidth: '36px',
    padding: '0 12px',
    boxShadow: '0 2px 4px rgba(226, 55, 68, 0.2)',
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#E23744',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(226, 55, 68, 0.2)',
    overflow: 'hidden',
    height: '36px'
  };

  const quantityButtonStyle = {
    padding: '0 10px',
    fontSize: '16px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'all 0.15s ease-in-out',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const quantityDisplayStyle = {
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minWidth: '32px',
    textAlign: 'center',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const askAIButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#8B5CF6', // Purple - magical and sophisticated
    color: '#FFFFFF',
    padding: '0 16px',
    minWidth: '80px',
    boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)',
  };

  return (
    <div className="flex items-center space-x-3 px-4 py-3">
      {/* Add to Cart / Quantity Control */}
      <div className="flex-shrink-0">
        {qty === 0 ? (
          <button
            onClick={handleAdd}
            style={addButtonStyle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5v14m-7-7h14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div style={quantityPillStyle}>
            <button
              onClick={handleRemove}
              style={quantityButtonStyle}
            >
              −
            </button>
            <span style={quantityDisplayStyle}>{qty}</span>
            <button
              onClick={handleAdd}
              style={quantityButtonStyle}
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* Ask AI Button */}
      <button
        onClick={() => onAskAI(item)}
        style={askAIButtonStyle}
        className="flex items-center space-x-1"
      >
        <span style={{ fontSize: '16px' }}>✨</span>
        <span>Ask AI</span>
      </button>
    </div>
  );
}

// Details Section Component
function DetailsSection({ item, onAskAI }) {
  return (
    <div className="space-y-4">
      {/* Compact Action Buttons */}
      <CompactActionButtons item={item} onAskAI={onAskAI} />
      
      {/* Name and Price */}
      <div className="px-4">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900 flex-1 mr-4 leading-tight">
            {item.name}
          </h1>
          <span className="text-lg font-bold text-red-500 whitespace-nowrap">
            ₹{item.price}
          </span>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-gray-600 text-sm leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Category Section Component
function CategorySection({ categoryItems, currentItem, onItemClick }) {
  const otherItems = categoryItems.filter(item => item.id !== currentItem.id);
  
  // Debug logging
  console.log('CategorySection render:', {
    categoryItems: categoryItems?.length || 0,
    currentItem: currentItem?.name,
    currentItemId: currentItem?.id,
    otherItems: otherItems?.length || 0,
    category_brief: currentItem?.category_brief
  });
  
  if (otherItems.length === 0) {
    console.log('CategorySection: No other items to show, returning null');
    return null;
  }

  // Handle clicks and prevent event propagation to parent swipe handlers
  const handleItemClick = (item) => {
    console.log('CategorySection item clicked:', item.name);
    onItemClick?.(item);
  };

  const handleWrapperClick = (e) => {
    // Stop event propagation to prevent parent swipe handlers from interfering
    e.stopPropagation();
  };

  const handleWrapperTouch = (e) => {
    // Only stop propagation for vertical touch events (taps and vertical scrolling)
    // Let horizontal swipes bubble up to parent swipe handlers
    if (e.type === 'touchstart') {
      // Store initial touch position to determine if this is a vertical or horizontal gesture
      e.currentTarget._touchStartY = e.touches[0].clientY;
      e.currentTarget._touchStartX = e.touches[0].clientX;
    } else if (e.type === 'touchmove') {
      const deltaY = Math.abs(e.touches[0].clientY - e.currentTarget._touchStartY);
      const deltaX = Math.abs(e.touches[0].clientX - e.currentTarget._touchStartX);
      
      // If this is primarily a vertical gesture, stop propagation
      // If it's primarily horizontal, let it bubble up for swipe detection
      if (deltaY > deltaX) {
        e.stopPropagation();
      }
    }
  };

  return (
    <div 
      onClick={handleWrapperClick} 
      onTouchStart={handleWrapperTouch}
      onTouchMove={handleWrapperTouch}
      className="mt-6"
    >
      <SimpleMasonryGrid
        items={otherItems}
        onItemClick={handleItemClick}
        title={`Other ${currentItem.category_brief}`}
        className="flex-1"
      />
    </div>
  );
}

// Main PreviewScreen Component
export function PreviewScreen({ 
  isOpen, 
  item, 
  categoryItems, 
  currentIndex, 
  onClose, 
  onItemChange, 
  onItemClick,
  zIndex = 50,
  isTopmost = true
}) {
  // AI Chat method from store
  const sendMessageAndOpenDrawer = useChatStore((state) => state.sendMessageAndOpenDrawer);
  const { nickname } = useSessionStore();
  
  // Define navigation functions
  const navigateToNext = () => {
    if (!isTopmost || !onItemChange) {
      return;
    }
    const nextIndex = (currentIndex + 1) % categoryItems.length;
    onItemChange(nextIndex);
  };

  const navigateToPrevious = () => {
    if (!isTopmost || !onItemChange) {
      return;
    }
    console.log('Navigating to previous item, current index:', currentIndex, 'total items:', categoryItems.length);
    const prevIndex = currentIndex === 0 
      ? categoryItems.length - 1 
      : currentIndex - 1;
    onItemChange(prevIndex);
  };

  // Swipe handlers using react-swipeable
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      if (isTopmost && categoryItems.length > 1) {
        navigateToNext();
      }
    },
    onSwipedRight: (eventData) => {
      if (isTopmost && categoryItems.length > 1) {
        navigateToPrevious();
      }
    },
    onSwiping: (eventData) => {
    },
    onTouchStartOrOnMouseDown: (eventData) => {
    },
    trackMouse: true,
    trackTouch: true,
    delta: 40, // Minimum distance for swipe
    preventScrollOnSwipe: false, // Allow vertical scrolling
    rotationAngle: 0,
    swipeDuration: 1000, // Max time for swipe
    touchEventOptions: { passive: false },
  });

  // Handle category item click
  const handleCategoryItemClick = (clickedItem) => {
    console.log('Category item clicked:', clickedItem.name, 'isTopmost:', isTopmost, 'onItemClick exists:', !!onItemClick);
    if (onItemClick && isTopmost) {
      // If we have onItemClick and this is the topmost preview, open a new preview
      onItemClick(clickedItem, categoryItems);
    } else {
      // Otherwise, just navigate within current preview
      const newIndex = categoryItems.findIndex(i => i.id === clickedItem.id);
      if (newIndex !== -1 && onItemChange) {
        onItemChange(newIndex);
      }
    }
  };

  // AI chat handler
  const handleAskAI = (item) => {
    const message = `Tell me more about ${item.name}`;
    sendMessageAndOpenDrawer(message, nickname);
  };

  if (!isOpen || !item) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
      />
      
      {/* Preview Container */}
      <div 
        {...swipeHandlers}
        className="fixed inset-0 bg-white flex flex-col animate-slide-in-right overflow-y-auto"
        style={{ 
          zIndex: zIndex,
          touchAction: 'manipulation' // More permissive than pan-y
        }}
      >
        {/* Header */}
        <Header onClose={onClose} />
        
        {/* Media Section */}
        <MediaSection 
          item={item} 
          currentIndex={currentIndex}
          totalItems={categoryItems.length}
        />
        
        {/* Details Section */}
        <DetailsSection item={item} onAskAI={handleAskAI} />
        
        {/* Category Items Section */}
        <CategorySection 
          categoryItems={categoryItems} 
          currentItem={item} 
          onItemClick={handleCategoryItemClick}
        />
      </div>
    </>
  );
} 