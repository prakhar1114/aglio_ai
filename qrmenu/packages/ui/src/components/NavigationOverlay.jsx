import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useCartStore } from '@qrmenu/core';

export function NavigationOverlay({ 
  isVisible, 
  groupCategories = [], 
  categoryIndexMap = {}, 
  groupCategoryMap = {}, 
  onNavigate, 
  onClose 
}) {
  let theme;
  try {
    theme = useTheme();
  } catch (error) {
    // Fallback if theme context is not available
    console.warn('Theme context not available, using defaults');
    theme = {};
  }
  
  const [isAnimating, setIsAnimating] = useState(false);

  // Extract theme values with fallbacks
  const {
    restaurantName = 'Restaurant',
    logo = null,
    restaurantLogo = null,
    navigationOverlay = {},
    font = null
  } = theme || {};

  // Get font from theme with fallback hierarchy
  const getThemeFont = () => {
    // Check multiple possible font locations in theme
    if (font) return `'${font}', serif`;
    return "'Playfair Display', 'Georgia', serif";
  };

  const themeFont = getThemeFont();

  const {
    title = 'Navigation Menu',
    specialsTitle = "Trending",
    browseMenuTitle = 'Browse Menu',
    brandColor = '#C72C48',
    showLogo = true,
    logoPosition = 'top',
    specialsBackgroundImage = null,
    coverImage = null,
    rotate = 0
  } = navigationOverlay;

  // Use restaurantLogo if available, otherwise fall back to logo
  const logoUrl = restaurantLogo || logo;

  // Handle entrance animation
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  // Check if "Recommendations" category exists
  const hasRecommendations = groupCategories.some(cat => 
    Object.values(groupCategoryMap).some(groupCat => groupCat === cat) &&
    Object.keys(categoryIndexMap).some(catKey => catKey === 'Recommendations')
  );

  const handleCategoryClick = (groupCategory) => {
    // Get setFilters function from cart store
    const setFilters = useCartStore.getState()?.setFilters;
    
    if (setFilters) {
      if (groupCategory === "Today's Specials") {
        // Filter for Recommendations category
        setFilters({ category: ['Recommendations'] });
      } else {
        // Filter for the selected group category
        setFilters({ category: [groupCategory] });
      }
    }
    
    // Auto-dismiss after selection
    onClose?.();
  };

  return (
    <>
      <style>
        {`
          @keyframes scaleIn {
            0% {
              opacity: 0;
              transform: scale(0.95) translateY(10px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          
          @keyframes backdropBlur {
            0% {
              backdrop-filter: blur(0px);
              background: rgba(0, 0, 0, 0);
            }
            100% {
              backdrop-filter: blur(30px);
              background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%);
            }
          }
          
          .navigation-overlay {
            animation: scaleIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
          
          .navigation-backdrop {
            animation: backdropBlur 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
          
          .nav-button {
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
          
          .nav-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          }
          
          .nav-button:active {
            transform: translateY(0px);
          }
        `}
      </style>
      
      {/* Full Screen Overlay */}
      <div 
        className="navigation-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflow: 'hidden',
        }}
        onClick={onClose}
      >
        {/* Navigation Menu */}
        <div 
          className="navigation-overlay"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '28px',
            maxWidth: '380px',
            width: '100%',
            maxHeight: '90vh',
            boxShadow: '0 32px 64px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Cover Image Section */}
            {coverImage && (
              <div style={{
                position: 'relative',
                width: '100%',
                height: '25vh',
                minHeight: '120px',
                maxHeight: '200px',
                overflow: 'hidden',
                borderTopLeftRadius: '28px',
                borderTopRightRadius: '28px',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
              }}>
                <img 
                  src={coverImage} 
                  alt="Restaurant Cover"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.4))',
                }} />
              </div>
            )}

            {/* Header - Apple-Style Branding */}
            <div style={{
              marginBottom: '24px',
              padding: '24px 24px 0 24px',
              position: 'relative',
            }}>
              {/* Logo Section - Centered */}
              {showLogo && logoUrl && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  marginTop: coverImage ? '-60px' : '0',
                  zIndex: 3,
                }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.98)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 6px 12px rgba(0, 0, 0, 0.08)',
                    border: '3px solid rgba(255, 255, 255, 0.95)',
                    position: 'relative',
                    zIndex: 2,
                    marginBottom: '16px',
                    overflow: 'hidden',
                  }}>
                    <img 
                      src={logoUrl} 
                      alt={restaurantName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                      }}
                      onError={(e) => {
                        // Hide logo if image fails to load
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              
              {/* Restaurant Name - Bottom Position */}
              <div style={{
                textAlign: 'center',
                marginTop: '12px',
              }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '300',
                  color: '#1A1A1A',
                  fontFamily: themeFont,
                  letterSpacing: '0.05em',
                  lineHeight: '1.1',
                  textShadow: 'none',
                  textTransform: 'uppercase',
                }}>
                  {restaurantName}
                </div>
              </div>
            </div>

            {/* Specials Section */}
            {hasRecommendations && (
              <div style={{
                marginBottom: '20px',
                padding: '0 24px',
              }}>
                <button
                  className="nav-button"
                  onClick={() => handleCategoryClick("Today's Specials")}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: specialsBackgroundImage 
                      ? `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${specialsBackgroundImage})`
                      : `linear-gradient(135deg, #FF6B35, #F7931E)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: 'none',
                    borderRadius: '16px',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '700',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 20px rgba(255, 107, 53, 0.3), 0 3px 6px rgba(255, 107, 53, 0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-3px) scale(1.02)';
                    e.target.style.boxShadow = '0 12px 32px rgba(255, 107, 53, 0.4), 0 6px 12px rgba(255, 107, 53, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0) scale(1)';
                    e.target.style.boxShadow = '0 8px 24px rgba(255, 107, 53, 0.3), 0 4px 8px rgba(255, 107, 53, 0.2)';
                  }}
                >
                  <span style={{ fontSize: '18px' }}>✨</span>
                  {specialsTitle}
                </button>
              </div>
            )}

            {/* Browse Menu Section */}
            {/* <div style={{
              marginBottom: '20px',
              padding: '0 24px',
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                marginBottom: '16px',
                textAlign: 'center',
                letterSpacing: '-0.01em',
              }}>
                {browseMenuTitle}
              </div>
            </div> */}

            {/* Navigation Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '0 24px 24px 24px',
            }}>
              {/* Group Categories */}
              {groupCategories.map((groupCategory, index) => (
                groupCategory !== "Recommendations" && (
                <button
                  key={groupCategory}
                  className="nav-button"
                  onClick={() => handleCategoryClick(groupCategory)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    borderRadius: '12px',
                    color: '#1F2937',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    position: 'relative',
                    overflow: 'hidden',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    letterSpacing: '-0.01em',
                  }}
                > 
                  {groupCategory} Menu
                </button>
              )))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

 