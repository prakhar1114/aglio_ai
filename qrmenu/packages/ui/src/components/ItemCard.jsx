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

  // --- Premium helpers for no-media cards ---
  const getInitials = (name) => {
    if (!name) return '';
    const words = String(name).trim().split(/\s+/);
    const first = words[0]?.[0] || '';
    const second = words[1]?.[0] || '';
    return (first + second).toUpperCase();
  };

  const hashToHue = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    return Math.abs(hash) % 360;
  };

  const getPastelGradient = (seed) => {
    const hue = hashToHue(seed || 'menu');
    const hue2 = (hue + 30) % 360;
    const c1 = `hsl(${hue}, 82%, 86%)`;
    const c2 = `hsl(${hue2}, 78%, 75%)`;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  };

  // Base styles
  const cardStyle = {
    borderRadius: '12px', // theme radius.lg
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // theme colors.surface
    display: 'flex',
    flexDirection: 'column',
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
    padding: '6px',
    fontSize: '12px',
    color: '#FFFFFF',
    borderRadius: '8px',
    border: 'none',
    background: '#C72C48',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(199, 44, 72, 0.25)',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'transform 0.15s ease, box-shadow 0.2s ease',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const quantityButtonStyle = {
    padding: '6px 10px',
    fontSize: '12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#1C1C1E',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'opacity 0.15s ease'
  };

  const quantityStyle = {
    padding: '0 8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minWidth: '20px',
    textAlign: 'center'
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
    overflow: 'hidden'
  };

  // ---- Premium styles for inline cards without images ----
  const noImageCardStyle = {
    borderRadius: '14px',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: '84px',
    padding: '10px 12px',
    margin: 0,
    transition: 'transform 0.12s ease, box-shadow 0.2s ease, background 0.3s ease',
    gap: '10px',
    border: '1px solid rgba(17, 24, 39, 0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.04)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)'
  };

  const avatarWrapperStyle = {
    position: 'relative',
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    overflow: 'hidden',
    flexShrink: 0,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)'
  };

  const avatarInnerStyle = {
    width: '100%',
    height: '100%'
  };

  const avatarMonogramStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(0,0,0,0.45)',
    fontWeight: 700,
    fontSize: '16px',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    letterSpacing: '0.04em',
    textShadow: '0 1px 0 rgba(255,255,255,0.8)'
  };

  const avatarGlossStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.0))'
  };

  const noImageMiddleStyle = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  };

  const noImageTitleStyle = {
    fontSize: '15px',
    fontWeight: '600',
    color: '#101114',
    lineHeight: 1.35,
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  };

  const chipRowStyle = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'nowrap',
    overflow: 'hidden'
  };

  const chipStyle = {
    fontSize: '11px',
    color: '#374151',
    background: 'rgba(17, 24, 39, 0.06)',
    border: '1px solid rgba(17,24,39,0.08)',
    padding: '4px 8px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    letterSpacing: '-0.01em'
  };

  const noImageRightSectionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0
  };

  const noImagePriceStyle = {
    fontSize: '13px',
    color: '#C72C48',
    whiteSpace: 'nowrap',
    fontWeight: 700,
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0
  };

  const noImageButtonStyle = {
    padding: '6px',
    fontSize: '12px',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    background: '#C72C48',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(199, 44, 72, 0.25)',
    fontWeight: '600',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'transform 0.15s ease, box-shadow 0.2s ease',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const noImageQuantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '18px',
    border: '1px solid rgba(17,24,39,0.08)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
    overflow: 'hidden'
  };

  // Use passed containerWidth or fallback
  const cardWidth = containerWidth || 180;

  // Hide price and add button if base_price is 0
  const shouldShowPriceAndButton = item.base_price > 0;

  const hasMedia = item.image_url !== null;

  // Prepare chips from tags (up to 2, short labels)
  const chips = Array.isArray(item?.tags)
    ? item.tags.filter(t => typeof t === 'string' && t.length <= 16).slice(0, 2)
    : [];

  return (
    <div 
      style={cardStyle}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 14px 32px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
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
                      aria-label="Add item"
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
                        aria-label="Decrease quantity"
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
                        aria-label="Increase quantity"
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
        // Premium inline card without image
        <div style={noImageCardStyle}>
          {/* Avatar gradient */}
          <div style={avatarWrapperStyle} aria-hidden>
            <div style={{ ...avatarInnerStyle, background: getPastelGradient(item?.name || String(item?.id || '')) }} />
            <div style={avatarGlossStyle} />
            <div style={avatarMonogramStyle}>{getInitials(item?.name)}</div>
          </div>

          {/* Middle text + chips */}
          <div style={noImageMiddleStyle}>
            <h3 style={noImageTitleStyle}>{item.name}</h3>
            {chips.length > 0 && (
              <div style={chipRowStyle}>
                {chips.map((chip) => (
                  <span key={chip} style={chipStyle}>{chip}</span>
                ))}
              </div>
            )}
          </div>

          {/* Right section with price and add/qty */}
          <div style={noImageRightSectionStyle}>
            {shouldShowPriceAndButton && <p style={noImagePriceStyle}>₹{item.base_price}</p>}
            {shouldShowPriceAndButton && (
              qty === 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd();
                  }}
                  style={noImageButtonStyle}
                  aria-label="Add item"
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
                    aria-label="Decrease quantity"
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
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

    </div>
  );
} 