import React, { useState, useRef, useEffect } from 'react';
import { useCartStore, useSessionStore, addItemToCart, updateCartItem, deleteCartItem, useChatStore } from '@qrmenu/core';
import { useSwipeable } from 'react-swipeable';
import { SimpleMasonryGrid } from '../components/SimpleMasonryGrid.jsx';
import { OptimizedMedia } from '../components/OptimizedMedia.jsx';

// Simple Swipe Indicators
function SwipeIndicators({ show }) {
  if (!show) return null;

  return (
    <>
      <style jsx>{`
        @keyframes bounceLeft {
          0%, 50%, 100% { transform: translateY(-50%) translateX(0); }
          25% { transform: translateY(-50%) translateX(-3px); }
        }
        
        @keyframes bounceRight {
          0%, 50%, 100% { transform: translateY(-50%) translateX(0); }
          25% { transform: translateY(-50%) translateX(3px); }
        }
      `}</style>
      
      <div style={{
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 15,
        width: '24px',
        height: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'bounceLeft 1.5s ease-in-out infinite',
        pointerEvents: 'none'
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M17 18l-6-6 6-6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 18l-6-6 6-6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 15,
        width: '24px',
        height: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'bounceRight 1.5s ease-in-out infinite',
        pointerEvents: 'none'
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M7 6l6 6-6 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 6l6 6-6 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
}

// Header Component - Minimal design
function Header({ onClose }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 flex items-start justify-start p-4 pt-6">
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
function MediaSection({ item, currentIndex, totalItems, playerContextId, showSwipeIndicators }) {
  // Calculate dynamic viewport width for optimal media sizing
  const getViewportWidth = () => {
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth, 449);
    }
    return 428; // Fallback for SSR
  };

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());
  // console.log("viewportWidth media ", viewportWidth)

  // Update viewport width on resize
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(Math.min(getViewportWidth(), 449));
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
          containerHeight={viewportWidth}
          className="w-full h-auto"
          addControls={true}
          preload={true}
          autoplay={true}
          muted={true}
          reuseStream={true}
          contextId={playerContextId}
        />
      ) : (
        <div className="text-gray-400 text-6xl py-16">🍽️</div>
      )}
      
      {/* Progress Dots */}
      <ProgressDots currentIndex={currentIndex} totalItems={totalItems} />
      
      {/* Swipe Indicators */}
      {totalItems > 1 && (
        <SwipeIndicators show={showSwipeIndicators} />
      )}
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

  // Hide price and add button if base_price is 0
  const shouldShowPriceAndButton = item.base_price > 0;

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
    backgroundColor: '#C72C48',
    color: '#FFFFFF',
    minWidth: '36px',
    padding: '0 12px',
    boxShadow: '0 2px 4px rgba(226, 55, 68, 0.2)',
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#C72C48',
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
      {shouldShowPriceAndButton && (
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
      )}

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
  // Hide price and add button if base_price is 0
  const shouldShowPriceAndButton = item.base_price > 0;

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
          {shouldShowPriceAndButton && (
            <span className="text-lg font-bold text-red-500 whitespace-nowrap">
              ₹{item.base_price}
            </span>
          )}
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
const CategorySection = React.memo(function CategorySection({ categoryItems, currentItem, onItemClick }) {
  const otherItems = categoryItems.filter((item) => item.id !== currentItem.id);

  // Debug logging
  console.log('CategorySection render:', {
    categoryItems: categoryItems?.length || 0,
    currentItem: currentItem?.name,
    currentItemId: currentItem?.id,
    otherItems: otherItems?.length || 0,
    category_brief: currentItem?.category_brief,
  });

  const gridWrapperRef = React.useRef(null);

  // Defer grid *visibility* (not mounting) to give MediaSection priority –
  // avoids an extra React render (perf tweak C improved).
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;

    // Initially hide grid
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';

    const timer = setTimeout(() => {
      el.style.transition = 'opacity 0.25s ease-out';
      el.style.opacity = '1';
      el.style.pointerEvents = '';
    }, 1000); // 1000 ms delay matches previous logic

    return () => clearTimeout(timer);
  }, [currentItem.id]);

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
    e.stopPropagation(); // Prevent parent swipe handlers
  };

  const handleWrapperTouch = (e) => {
    if (e.type === 'touchstart') {
      e.currentTarget._touchStartY = e.touches[0].clientY;
      e.currentTarget._touchStartX = e.touches[0].clientX;
    } else if (e.type === 'touchmove') {
      const deltaY = Math.abs(e.touches[0].clientY - e.currentTarget._touchStartY);
      const deltaX = Math.abs(e.touches[0].clientX - e.currentTarget._touchStartX);
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
      <div ref={gridWrapperRef}>
        <SimpleMasonryGrid
          items={otherItems}
          onItemClick={handleItemClick}
          title={`Other ${currentItem.category_brief}`}
          className="flex-1"
        />
      </div>
    </div>
  );
});

// Main PreviewScreen Component
function PreviewScreenComponent({ 
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
  
  // State for swipe indicators
  const [showSwipeIndicators, setShowSwipeIndicators] = useState(false);
  
  // Show indicators when preview opens
  useEffect(() => {
    if (isOpen && isTopmost && categoryItems.length > 1) {
      setShowSwipeIndicators(true);
    }
  }, [isOpen, isTopmost, categoryItems.length]);
  
  // Define navigation functions
  const navigateToNext = () => {
    if (!isTopmost || !onItemChange) {
      return;
    }
    setShowSwipeIndicators(false); // Hide on navigation
    const nextIndex = (currentIndex + 1) % categoryItems.length;
    onItemChange(nextIndex);
  };

  const navigateToPrevious = () => {
    if (!isTopmost || !onItemChange) {
      return;
    }
    setShowSwipeIndicators(false); // Hide on navigation
    // console.log('Navigating to previous item, current index:', currentIndex, 'total items:', categoryItems.length);
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
    
    // Safely create extraContext with proper JSON formatting
    const contextData = {
      "information-type": "item background information",
      "name": item.name || "",
      "category_brief": item.category_brief || "",
      "category_name": item.group_category || "",
      "price": item.base_price || 0,
      "is_veg": item.is_veg || false,
      "description": item.description || ""
    };
    
    const extraContext = JSON.stringify(contextData);
    sendMessageAndOpenDrawer(message, nickname, extraContext);
  };

  const playerContextIdRef = useRef(null);
  if (!playerContextIdRef.current) {
    playerContextIdRef.current = `preview-player-${Math.random().toString(36).slice(2, 8)}`;
  }

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
          touchAction: 'manipulation', // More permissive than pan-y
          maxWidth: '449px',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        {/* Header */}
        <Header onClose={onClose} />
        
        {/* Media Section */}
        <MediaSection 
          item={item} 
          currentIndex={currentIndex}
          totalItems={categoryItems.length}
          playerContextId={playerContextIdRef.current}
          showSwipeIndicators={showSwipeIndicators}
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

// Memoised wrapper to prevent re-renders of background previews (perf plan 1)
const propsAreEqual = (prev, next) => {
  // If topmost status flips, always re-render
  if (prev.isTopmost !== next.isTopmost) return false;

  // Always re-render the topmost preview to show new item/progress etc.
  if (next.isTopmost) {
    return (
      prev.item?.id === next.item?.id &&
      prev.currentIndex === next.currentIndex &&
      prev.categoryItems.length === next.categoryItems.length
    );
  }

  // For non-top previews, skip re-rendering after initial mount
  return true;
};

export const PreviewScreen = React.memo(PreviewScreenComponent, propsAreEqual); 