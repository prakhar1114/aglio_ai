import { ShoppingCartIcon, AdjustmentsHorizontalIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@qrmenu/core';

export function BottomBar({ onFiltersOpen, onAIChatOpen, onCartOpen }) {
  const totalCount = useCartStore((state) => state.totalCount());

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb z-50">
      <div className="flex items-center justify-between max-w-md mx-auto">
        
        {/* Filters Button */}
        <button
          onClick={onFiltersOpen}
          className="flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <AdjustmentsHorizontalIcon className="w-6 h-6" />
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

        {/* AI Chat Button */}
        <button
          onClick={onAIChatOpen}
          className="flex flex-col items-center p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ChatBubbleLeftIcon className="w-6 h-6" />
          <span className="text-xs mt-1">AI Help</span>
        </button>
      </div>
    </div>
  );
} 