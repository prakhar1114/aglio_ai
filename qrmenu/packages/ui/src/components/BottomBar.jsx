import { ShoppingCartIcon, AdjustmentsHorizontalIcon, ChatBubbleLeftIcon, ClipboardDocumentListIcon, BellIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, useChatStore } from '@qrmenu/core';
import { useState, useEffect } from 'react';

export function BottomBar({ onFiltersOpen, onAIChatOpen, onCartOpen, onMyOrdersOpen, onCallWaiterOpen }) {
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

  const TabButton = ({ 
    onClick, 
    icon: Icon, 
    label, 
    badge, 
    bounceAnimation = false,
    notificationDot = false 
  }) => {
    const [isPressed, setIsPressed] = useState(false);
    
    return (
      <button
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
  };

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
            
            {/* My Table Button */}
            {showMyTable && (
              <TabButton
                onClick={onMyOrdersOpen}
                icon={ClipboardDocumentListIcon}
                label="My Table"
                badge={ordersCount}
                bounceAnimation={myTableBounce}
              />
            )}

            {/* Filters Button */}
            <TabButton
              onClick={onFiltersOpen}
              icon={AdjustmentsHorizontalIcon}
              label="Filters"
              badge={filterCount}
            />

            {/* AI Chat Button */}
            <TabButton
              onClick={onAIChatOpen}
              icon={ChatBubbleLeftIcon}
              label="Ask AI"
              bounceAnimation={messageBounce}
              notificationDot={hasUnreadMessages}
            />

            {/* Call Waiter Button */}
            <TabButton
              onClick={onCallWaiterOpen}
              icon={BellIcon}
              label="Call Waiter"
            />

            {/* Cart Button */}
            <TabButton
              onClick={onCartOpen}
              icon={ShoppingCartIcon}
              label="Cart"
              badge={totalCount}
              bounceAnimation={cartBounce}
            />

          </div>
        </div>
      </div>
    </>
  );
} 