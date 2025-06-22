import { ShoppingCartIcon, AdjustmentsHorizontalIcon, ChatBubbleLeftIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore } from '@qrmenu/core';

export function BottomBar({ onFiltersOpen, onAIChatOpen, onCartOpen, onMyOrdersOpen }) {
  const totalCount = useCartStore((state) => state.totalCount());
  const filterCount = useCartStore((state) => state.getFilterCount());
  const ordersCount = useCartStore((state) => state.getOrdersCount());
  const tableNumber = useSessionStore((state) => state.tableNumber);

  // Show My Table tab if there are orders OR if there's a table number
  const showMyTable = ordersCount > 0 || tableNumber !== null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb z-50">
      <div className={`flex items-center max-w-md mx-auto ${showMyTable ? 'justify-around' : 'justify-between'}`}>
        
        {/* Filters Button with Badge */}
        <button
          onClick={onFiltersOpen}
          className="relative flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <AdjustmentsHorizontalIcon className="w-6 h-6" />
          {filterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {filterCount}
            </span>
          )}
          <span className="text-xs mt-1">Filters</span>
        </button>

        {/* Cart Button with Badge */}
        <button
          onClick={onCartOpen}
          className="relative flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ShoppingCartIcon className="w-6 h-6" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {totalCount}
            </span>
          )}
          <span className="text-xs mt-1">Cart</span>
        </button>

        {/* My Table Button - Show when orders exist OR table number is available */}
        {showMyTable && (
          <button
            onClick={onMyOrdersOpen}
            className="relative flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ClipboardDocumentListIcon className="w-6 h-6" />
            {ordersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {ordersCount}
              </span>
            )}
            <span className="text-xs mt-1">My Table</span>
          </button>
        )}

        {/* AI Chat Button */}
        <button
          onClick={onAIChatOpen}
          className="flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ChatBubbleLeftIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Ask AI</span>
        </button>
      </div>
    </div>
  );
} 