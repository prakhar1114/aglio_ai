import React, { useState } from 'react';
import { useCartStore, useSessionStore, addItemToCart, updateCartItem, deleteCartItem, constructImageUrl } from '@qrmenu/core';

export function DishCard({ id, name, price, image_url, tags = [], description = '', className = '' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Cart functionality
  const { items } = useCartStore();
  const { memberPid } = useSessionStore();
  
  const userCartItems = items.filter(cartItem => 
    cartItem.menu_item_pid === id && cartItem.member_pid === memberPid
  );
  const qty = userCartItems.reduce((total, cartItem) => total + cartItem.qty, 0);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (qty === 0) {
      addItemToCart({ id, name, price, image_url, tags, description }, 1, '');
    } else {
      const cartItem = userCartItems[0];
      if (cartItem) {
        updateCartItem(cartItem.public_id, cartItem.qty + 1, cartItem.note, cartItem.version);
      }
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    const cartItem = userCartItems[0];
    if (!cartItem) return;
    
    if (cartItem.qty === 1) {
      deleteCartItem(cartItem.public_id, cartItem.version);
    } else {
      updateCartItem(cartItem.public_id, cartItem.qty - 1, cartItem.note, cartItem.version);
    }
  };

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  // Helper function to check if URL is a video
  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  const formattedPrice = price ? `₹${price}` : 'Price not available';
  const fullImageUrl = constructImageUrl(image_url);
  const hasImage = fullImageUrl && !imageError;
  const isVideo = hasImage && isVideoUrl(fullImageUrl);

  return (
    <>
      <div 
        className={`
          bg-white/90 backdrop-blur-xl
          border border-black/8 rounded-2xl
          overflow-hidden w-[240px] flex-shrink-0
          cursor-pointer relative
          transition-all duration-300 ease-out
          ${isHovered 
            ? 'shadow-lg shadow-black/8 -translate-y-1 scale-[1.02]' 
            : 'shadow-sm shadow-black/4'}
          ${className}
        `}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image/Video Container - More compact */}
        {hasImage ? (
          <div className="relative w-full h-28 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
            {isVideo ? (
              <video
                src={fullImageUrl}
                className={`
                  w-full h-full object-cover
                  transition-transform duration-500 ease-out
                  ${isHovered ? 'scale-105' : 'scale-100'}
                `}
                autoPlay
                loop
                muted={true}
                playsInline
                controls={false}
                onError={() => setImageError(true)}
              />
            ) : (
              <img 
                src={fullImageUrl} 
                alt={name}
                className={`
                  w-full h-full object-cover
                  transition-transform duration-500 ease-out
                  ${isHovered ? 'scale-105' : 'scale-100'}
                `}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        ) : (
          <div className="relative w-full h-16 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-400 text-sm">🍽️</span>
            </div>
          </div>
        )}
        
        {/* Content - More compact */}
        <div className="p-3 relative">
          <h3 
            className="
              text-sm font-semibold text-gray-900
              mb-1.5 leading-tight tracking-tight
              line-clamp-2
            "
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
          >
            {name}
          </h3>
          
          {/* Price and Action Row */}
          <div className="flex justify-between items-center mb-2">
            <div 
              className="text-sm font-bold text-blue-600 tracking-tight"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
            >
              {formattedPrice}
            </div>
            
            {qty === 0 ? (
              <button 
                className="
                  bg-blue-500 text-white text-xs font-medium
                  px-3 py-1.5 rounded-full
                  transition-all duration-200 ease-out
                  hover:scale-105 active:scale-95
                  shadow-sm
                "
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
                onClick={handleAdd}
              >
                Add
              </button>
            ) : (
              <div 
                className="
                  flex items-center
                  bg-white/90 backdrop-blur-xl
                  border border-black/8 rounded-full
                  shadow-sm overflow-hidden min-w-[80px]
                "
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="
                    bg-transparent border-none
                    px-2 py-1 cursor-pointer
                    text-sm font-medium text-blue-500
                    flex items-center justify-center
                    transition-all duration-200 ease-out
                    hover:bg-blue-50
                  "
                  onClick={handleRemove}
                >
                  −
                </button>
                <span 
                  className="
                    px-2 text-sm font-medium text-gray-900
                    min-w-[20px] text-center
                  "
                  style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
                >
                  {qty}
                </span>
                <button 
                  className="
                    bg-transparent border-none
                    px-2 py-1 cursor-pointer
                    text-sm font-medium text-blue-500
                    flex items-center justify-center
                    transition-all duration-200 ease-out
                    hover:bg-blue-50
                  "
                  onClick={handleAdd}
                >
                  +
                </button>
              </div>
            )}
          </div>
          
          {/* Tags - More compact */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag, index) => (
                <span 
                  key={index} 
                  className="
                    bg-gray-100 text-gray-600
                    text-[10px] font-medium uppercase tracking-wider
                    px-1.5 py-0.5 rounded-lg
                  "
                  style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-[10px] text-gray-400">+{tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div 
          className="
            fixed inset-0 bg-black/30 backdrop-blur-sm
            flex items-center justify-center z-[9999] p-4
          "
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="
              bg-white/95 backdrop-blur-3xl
              border border-white/20 rounded-2xl
              p-6 max-w-md w-full
              shadow-2xl shadow-black/10
            "
            onClick={(e) => e.stopPropagation()}
          >
            <h3 
              className="
                text-lg font-bold text-gray-900
                mb-3 tracking-tight
              "
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
            >
              {name}
            </h3>
            {description && (
              <p 
                className="
                  text-sm text-gray-600 leading-relaxed mb-4
                "
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
              >
                {description}
              </p>
            )}
            <div className="flex justify-between items-center">
              <span 
                className="
                  text-lg font-bold text-blue-600
                "
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
              >
                {formattedPrice}
              </span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="
                  bg-gray-100 text-gray-600
                  border-none rounded-xl
                  px-4 py-2 cursor-pointer
                  text-sm font-medium
                  transition-all duration-200 ease-out
                  hover:bg-gray-200
                "
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 