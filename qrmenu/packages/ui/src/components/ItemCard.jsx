import React from 'react';
import { useCartStore, useSessionStore, addItemToCart, updateCartItem, deleteCartItem, constructImageUrl, getOptimalVariant } from '@qrmenu/core';
import { OptimizedMedia } from './OptimizedMedia.jsx';

export function ItemCard({ item, containerWidth, onItemClick, preload=false, autoplay=false, muted=true, context_namespace=null }) {
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

  const handleCardClick = (e) => {
    // Don't trigger if clicking on add/remove buttons
    if (e.target.closest('button')) return;
    
    onItemClick?.(item);
  };

  const cardStyle = {
    borderRadius: '12px', // theme radius.lg
    overflow: 'hidden',
    // boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)', // theme shadows.lg
    backgroundColor: '#FFFFFF', // theme colors.surface
    display: 'flex',
    flexDirection: 'column',
    // border: '1px solid #E5E7EB', // theme colors.border.light
    width: '100%',
    margin: 0,
    transition: 'all 0.2s ease-in-out'
  };

  const imageContainerStyle = {
    position: 'relative',
    aspectRatio: '1',
    width: '100%'
  };

  const imageStyle = {
    aspectRatio: '1',
    objectFit: 'cover',
    width: '100%',
    height: '100%',
    display: 'block'
  };

  const videoStyle = {
    aspectRatio: '1',
    objectFit: 'cover',
    width: '100%',
    height: '100%',
    display: 'block'
  };

  

  const contentStyle = {
    padding: '8px 12px', // theme spacing sm + md
    display: 'flex',
    alignItems: 'center',
    gap: '8px', // theme spacing.sm
    minHeight: '44px',
    backgroundColor: 'rgba(250, 251, 252, 0.95)', // theme colors.surfaceElevated with subtle transparency
    backdropFilter: 'blur(8px)', // Subtle blur for Apple-like elevation
    WebkitBackdropFilter: 'blur(8px)'
  };

  const titleStyle = {
    fontSize: '14px', // theme typography.sizes.sm
    fontWeight: '600', // theme typography.weights.semibold
    color: '#1C1C1E', // theme colors.text.primary
    lineHeight: '1.4', // theme typography.lineHeights.normal
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", // theme typography.fontFamily
    wordBreak: 'break-word',
    flex: '1',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  };

  const priceStyle = {
    fontSize: '12px', // theme typography.sizes.xs
    color: '#C72C48', // theme colors.primary (Zomato Red)
    whiteSpace: 'nowrap',
    fontWeight: '700', // theme typography.weights.bold
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0
  };

  const buttonOverlayStyle = {
    position: 'absolute',
    bottom: '6px', // Closer to corner, Apple-style
    right: '6px', // Closer to corner, Apple-style
    zIndex: 20 // Increased z-index to ensure it's above iframe
  };

  const addButtonStyle = {
    padding: '6px', // Reduced footprint - square aspect ratio
    fontSize: '12px', // theme typography.sizes.xs
    color: '#FFFFFF', // theme colors.text.inverse
    borderRadius: '6px', // Slightly smaller radius to match smaller size
    border: 'none',
    background: '#C72C48', // theme colors.primary (Zomato Red)
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)', // Subtle shadow for smaller element
    fontWeight: '600', // theme typography.weights.semibold
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'all 0.2s ease-in-out',
    width: '28px', // Explicit size for perfect square
    height: '28px', // Maintains minimum touch target
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
    }
  };

  const quantityButtonStyle = {
    padding: '4px 8px', // theme spacing xs + sm
    fontSize: '12px', // theme typography.sizes.xs
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#1C1C1E', // theme colors.text.primary
    fontWeight: '600', // theme typography.weights.semibold
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'all 0.15s ease-in-out'
  };

  const quantityStyle = {
    padding: '0 8px', // theme spacing.sm
    fontSize: '12px', // theme typography.sizes.xs
    fontWeight: '600', // theme typography.weights.semibold
    color: '#1C1C1E', // theme colors.text.primary
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minWidth: '20px',
    textAlign: 'center'
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF', // theme colors.surface
    borderRadius: '16px', // theme radius.xl
    border: '1px solid #E5E7EB', // theme colors.border.light
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)', // theme shadows.lg
    overflow: 'hidden'
  };

  // Style for inline cards without images
  const noImageCardStyle = {
    borderRadius: '12px', // Same as media cards
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // Same as media cards
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '56px', // Fixed single-row height
    padding: '8px 12px', // Same padding as media card content
    margin: 0,
    transition: 'all 0.2s ease-in-out',
    gap: '8px'
  };

  const noImageTitleStyle = {
    fontSize: '14px', // Same as media cards
    fontWeight: '600', // Same as media cards
    color: '#1C1C1E', // Same as media cards
    lineHeight: '1.4',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
    flex: 1, // Take available space
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' // Single line only
  };

  const noImageRightSectionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0 // Don't shrink, maintain fixed width
  };

  const noImagePriceStyle = {
    fontSize: '12px', // Same as media cards
    color: '#C72C48', // Same as media cards
    whiteSpace: 'nowrap',
    fontWeight: '700',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0
  };

  const noImageButtonStyle = {
    padding: '6px',
    fontSize: '12px',
    color: '#FFFFFF',
    borderRadius: '6px',
    border: 'none',
    background: '#C72C48',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'all 0.2s ease-in-out',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const noImageQuantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden'
  };

  // Use passed containerWidth or fallback
  const cardWidth = containerWidth || 180;

  // Hide price and add button if base_price is 0
  const shouldShowPriceAndButton = item.base_price > 0;

  const hasMedia = item.image_url !== null;

  return (
    <div 
      style={cardStyle}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      className="cursor-pointer"
    >
      {hasMedia ? (
        // Card with optimized image or video
        <div>
          <div style={imageContainerStyle}>
            <OptimizedMedia
              imageUrl={item.image_url}
              cloudflareImageId={item.cloudflare_image_id}
              cloudflareVideoId={item.cloudflare_video_id}
              alt={item.name}
              containerWidth={cardWidth}
              containerHeight={cardWidth} // Square aspect ratio
              className="w-full h-full"
              preload={preload}
              autoplay={autoplay}
              muted={muted}
              reuseStream={true}
              contextId={`${context_namespace}-${item.id}`}
            />
            <div style={buttonOverlayStyle}>
              {shouldShowPriceAndButton ? (
                <>
                  {qty === 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd();
                      }}
                      style={addButtonStyle}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 5v14m-7-7h14"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <div style={quantityPillStyle}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove();
                        }}
                        style={quantityButtonStyle}
                      >
                        −
                      </button>
                      <span style={quantityStyle}>{qty}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdd();
                        }}
                        style={quantityButtonStyle}
                      >
                        +
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Hide Add button and quantity controls if base_price is 0
                null
              )}
            </div>
          </div>
          <div style={contentStyle}>
            <h3 style={titleStyle}>{item.name}</h3>
            {shouldShowPriceAndButton && <p style={priceStyle}>₹{item.base_price}</p>}
          </div>
        </div>
      ) : (
        // Inline card without image
        <div style={noImageCardStyle}>
          <h3 style={noImageTitleStyle}>{item.name}</h3>
          <div style={noImageRightSectionStyle}>
            {shouldShowPriceAndButton && (
              qty === 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd();
                  }}
                  style={noImageButtonStyle}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 5v14m-7-7h14"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : (
                <div style={noImageQuantityPillStyle}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove();
                    }}
                    style={quantityButtonStyle}
                  >
                    −
                  </button>
                  <span style={quantityStyle}>{qty}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd();
                    }}
                    style={quantityButtonStyle}
                  >
                    +
                  </button>
                </div>
              )
            )}
            {shouldShowPriceAndButton && <p style={noImagePriceStyle}>₹{item.base_price}</p>}
          </div>
        </div>
      )}

    </div>
  );
} 