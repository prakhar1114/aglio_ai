import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCartIcon, AdjustmentsHorizontalIcon, ChatBubbleLeftIcon, ClipboardDocumentListIcon, BellIcon, HomeIcon, PhotoIcon, ListBulletIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, useChatStore } from '@qrmenu/core';
import { WaiterOptionsPopup } from './WaiterOptionsPopup.jsx';
import { CategorySwitcherDropdown } from './CategorySwitcherDropdown.jsx';

export function BottomBar({ onFiltersOpen, onAIChatOpen, onCartOpen, onMyOrdersOpen, onCallWaiterOpen, onHomeOpen, enableCallWaiter, enablePlaceOrder, enableNavigationOverlay, enableBottombarFilters, enableImageGalleryFeed, showImageGalleryFeed, onToggleImageGallery, enableBottombarCategoryDropdown, groupCategories = [], hasRecommendations = false }) {
  const totalCount = useCartStore((state) => state.totalCount());
  const filterCount = useCartStore((state) => state.getFilterCount());
  const ordersCount = useCartStore((state) => state.getOrdersCount());
  const tableNumber = useSessionStore((state) => state.tableNumber);
  const members = useSessionStore((state) => state.members);
  const hasUnreadMessages = useChatStore((state) => state.hasUnreadMessages);
  
  // Animation states
  const [cartBounce, setCartBounce] = useState(false);
  const [myTableBounce, setMyTableBounce] = useState(false);
  const [messageBounce, setMessageBounce] = useState(false);
  const [previousCartCount, setPreviousCartCount] = useState(0);
  const [previousMemberCount, setPreviousMemberCount] = useState(0);
  const [previousHasUnreadMessages, setPreviousHasUnreadMessages] = useState(false);

  // Waiter options popup state
  const waiterButtonRef = useRef(null);
  const [isWaiterOptionsOpen, setIsWaiterOptionsOpen] = useState(false);
  const [waiterAnchor, setWaiterAnchor] = useState({ x: 0, y: 0 });

  // Category switcher dropdown state
  const [isCategorySwitcherOpen, setIsCategorySwitcherOpen] = useState(false);

  // Get current filters to determine active category
  const filters = useCartStore((state) => state.filters);
  const setFilters = useCartStore((state) => state.setFilters);

  const toggleWaiterOptions = () => {
    if (waiterButtonRef.current) {
      const rect = waiterButtonRef.current.getBoundingClientRect();
      setWaiterAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setIsWaiterOptionsOpen((prev) => !prev);
  };

  // Determine current active category
  const getCurrentActiveCategory = () => {
    if (filters?.category && filters.category.length > 0) {
      const activeCategory = filters.category[0];
      if (activeCategory === 'Recommendations') {
        return 'Recommendations';
      }
      if (groupCategories.includes(activeCategory)) {
        return activeCategory;
      }
      return 'all';
    }
    return 'all';
  };

  const currentActiveCategory = getCurrentActiveCategory();

  // Get display text for current selection
  const getCategoryDisplayText = () => {
    if (currentActiveCategory === 'Recommendations') {
      return 'Trending Menu';
    }
    if (currentActiveCategory === 'all') {
      return 'Full Menu';
    }
    return `${currentActiveCategory} Menu`;
  };

  // Handle category selection
  const handleCategorySelect = (category) => {
    if (category === 'Recommendations') {
      setFilters({ category: ['Recommendations'] });
    } else {
      setFilters({ category: [category] });
    }
  };

  // Toggle category switcher dropdown
  const toggleCategorySwitcher = () => {
    setIsCategorySwitcherOpen((prev) => !prev);
  };

  // Show My Table tab if there are orders OR if there's a table number
  const showMyTable = ordersCount > 0 || tableNumber !== null;

  // Animate cart when count changes
  useEffect(() => {
    if (totalCount > previousCartCount) {
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 600);
    }
    setPreviousCartCount(totalCount);
  }, [totalCount, previousCartCount]);

  // Animate My Table when member joins - more prominent bounce
  useEffect(() => {
    const currentMemberCount = members ? members.length : 0;
    if (currentMemberCount > previousMemberCount && previousMemberCount > 0) {
      setMyTableBounce(true);
      setTimeout(() => setMyTableBounce(false), 800);
    }
    setPreviousMemberCount(currentMemberCount);
  }, [members, previousMemberCount]);

  // Brief animation for new messages
  useEffect(() => {
    if (hasUnreadMessages && !previousHasUnreadMessages) {
      setMessageBounce(true);
      setTimeout(() => setMessageBounce(false), 600);
    }
    setPreviousHasUnreadMessages(hasUnreadMessages);
  }, [hasUnreadMessages, previousHasUnreadMessages]);

  const TabButton = React.forwardRef(({ 
    onClick, 
    icon: Icon, 
    label, 
    badge, 
    bounceAnimation = false,
    notificationDot = false 
  }, ref) => {
    const [isPressed, setIsPressed] = useState(false);
    
    return (
      <button
        ref={ref}
        onClick={onClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={`
          relative flex flex-col items-center p-1.5 rounded-lg transition-all duration-150 ease-out
          text-gray-600 hover:text-gray-800 hover:bg-gray-50/60
          ${isPressed ? 'scale-95' : 'scale-100'}
          ${bounceAnimation ? 'animate-bounce' : ''}
        `}
      >
        {/* Icon */}
        <div className={`
          relative transition-transform duration-150 
          ${isPressed ? 'scale-110' : 'scale-100'}
        `}>
          <Icon className="w-5 h-5" />
          
          {/* Badge */}
          {badge > 0 && (
            <span className={`
              absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center px-1
              text-xs font-semibold text-white rounded-full shadow-sm bg-red-500
              ${bounceAnimation ? 'animate-bounce' : ''}
              transform transition-transform duration-150
            `}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          
          {/* Notification dot */}
          {notificationDot && (
            <span className={`
              absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm
              ${bounceAnimation ? 'animate-bounce' : ''}
            `} />
          )}
        </div>
        
        {/* Label */}
        <span className="text-xs font-medium mt-0.5 tracking-tight text-gray-600">
          {label}
        </span>
      </button>
    );
  });

  return (
    <>
      {/* Minimal backdrop */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/70 to-transparent z-40" />
      
      {/* Ultra-compact bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200/50 px-2 py-1 safe-area-pb shadow-md">
          <div className={`
            flex items-center max-w-md mx-auto 
            ${showMyTable ? 'justify-around' : 'justify-between'}
          `}>
            
                         {/* Image Gallery Toggle Button */}
             {enableImageGalleryFeed && (
               <button
                 onClick={onToggleImageGallery}
                 className="flex items-center justify-center px-3.5 py-2 rounded-lg transition-all duration-200 ease-out active:scale-95"
                 style={{
                   backgroundColor: showImageGalleryFeed 
                     ? '#F3F4F6' 
                     : '#1C1C1E',
                   color: showImageGalleryFeed ? '#374151' : 'white',
                   fontSize: '11px',
                   fontWeight: '500',
                   fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                   letterSpacing: '-0.003em',
                   border: showImageGalleryFeed ? '1px solid #E5E7EB' : 'none',
                   outline: 'none',
                   boxShadow: showImageGalleryFeed 
                     ? '0 1px 2px rgba(0, 0, 0, 0.05)' 
                     : '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
                   backdropFilter: 'blur(10px)',
                   WebkitBackdropFilter: 'blur(10px)',
                 }}
               >
                 <span>
                   {showImageGalleryFeed ? "Show Full Menu" : "Show Trending"}
                 </span>
               </button>
             )}

            {/* Category Switcher Button */}
            {enableBottombarCategoryDropdown && (groupCategories.length > 0 || hasRecommendations) && (
              <button
                onClick={toggleCategorySwitcher}
                className="flex items-center justify-center px-3.5 py-2 rounded-lg transition-all duration-200 ease-out active:scale-95"
                style={{
                  backgroundColor: currentActiveCategory !== 'all' 
                    ? '#F3F4F6' 
                    : '#1C1C1E',
                  color: currentActiveCategory !== 'all' ? '#374151' : 'white',
                  fontSize: '11px',
                  fontWeight: '500',
                  fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                  letterSpacing: '-0.003em',
                  border: currentActiveCategory !== 'all' ? '1px solid #E5E7EB' : 'none',
                  outline: 'none',
                  boxShadow: currentActiveCategory !== 'all' 
                    ? '0 1px 2px rgba(0, 0, 0, 0.05)' 
                    : '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  gap: '4px',
                }}
              >
                <span>
                  {getCategoryDisplayText()}
                </span>
                <ChevronDownIcon 
                  style={{
                    width: '12px',
                    height: '12px',
                    transition: 'transform 0.2s ease',
                    transform: isCategorySwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    color: currentActiveCategory !== 'all' ? '#6B7280' : 'rgba(255, 255, 255, 0.8)',
                  }}
                />
              </button>
            )}

            {/* Home Button - only show if navigation overlay is enabled */}
            {enableNavigationOverlay && (
              <TabButton
                onClick={onHomeOpen}
                icon={HomeIcon}
                label="Home"
              />
            )}

            {/* My Table Button */}
            {enablePlaceOrder && showMyTable && (
              <TabButton
                onClick={onMyOrdersOpen}
                icon={ClipboardDocumentListIcon}
                label="My Table"
                badge={ordersCount}
                bounceAnimation={myTableBounce}
              />
            )}

            {/* Filters Button */}
            {enableBottombarFilters && (
              <TabButton
                onClick={onFiltersOpen}
                icon={AdjustmentsHorizontalIcon}
                label="Filters"
                badge={filterCount}
              />
            )}

            {/* AI Chat Button */}
            <TabButton
              onClick={onAIChatOpen}
              icon={ChatBubbleLeftIcon}
              label="Ask AI"
              bounceAnimation={messageBounce}
              notificationDot={hasUnreadMessages}
            />

            {/* Waiter Options Button */}
            {enableCallWaiter && (
            <TabButton
              ref={waiterButtonRef}
              onClick={toggleWaiterOptions}
              icon={BellIcon}
              label="Waiter"
            />
            )}

            {/* Cart Button */}
            <TabButton
              onClick={onCartOpen}
              icon={ShoppingCartIcon}
              label={enablePlaceOrder ? "Cart" : "My List"}
              badge={totalCount}
              bounceAnimation={cartBounce}
            />

          </div>
        </div>
      </div>

      {/* Waiter Options Popup */}
      {isWaiterOptionsOpen && (
        <WaiterOptionsPopup
          anchor={waiterAnchor}
          onClose={() => setIsWaiterOptionsOpen(false)}
        />
      )}

      {/* Category Switcher Dropdown */}
      {isCategorySwitcherOpen && (
        <CategorySwitcherDropdown
          isOpen={isCategorySwitcherOpen}
          onClose={() => setIsCategorySwitcherOpen(false)}
          groupCategories={groupCategories}
          hasRecommendations={hasRecommendations}
          currentActiveCategory={filters?.category?.[0] || null}
          onCategorySelect={handleCategorySelect}
        />
      )}
    </>
  );
} 