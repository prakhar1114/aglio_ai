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
    if (font) return `'${font}', serif`;
    return "'Playfair Display', 'Georgia', serif";
  };

  const themeFont = getThemeFont();

  const {
    title = 'Navigation Menu',
    specialsTitle = "Trending Items",
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

  // Determine if Recommendations exist
  const hasRecommendations = Object.keys(categoryIndexMap).some(catKey => catKey === 'Recommendations');

  const handleCategoryClick = (groupCategory) => {
    const setFilters = useCartStore.getState()?.setFilters;
    if (setFilters) {
      if (groupCategory === "Today's Specials") {
        setFilters({ category: ['Recommendations'] });
      } else {
        setFilters({ category: [groupCategory] });
      }
    }
    onClose?.();
  };

  return (
    <>
      <style>
        {`
          @keyframes sheetEnter {
            0% { opacity: 0; transform: translateY(12px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .nav-sheet-enter { animation: sheetEnter .35s ease-out; }
          .nav-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.08); }
          .nav-card:active { transform: translateY(0); }
        `}
      </style>

      {/* Full-screen premium surface */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #F7F8FC 0%, #F1F3F6 100%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid rgba(17,24,39,0.08)',
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="#111827" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content */}
        <div className="nav-sheet-enter" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* Hero */}
          <div style={{ position: 'relative', width: '100%', height: '34vh', minHeight: 180, maxHeight: 280, overflow: 'hidden' }}>
            {coverImage ? (
              <img
                src={coverImage}
                alt="Cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${rotate}deg)` }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${brandColor}, #ff9a8d)` }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.45))' }} />

            {/* Centered logo bubble */}
            {showLogo && logoUrl && (
              <div style={{ position: 'absolute', left: '50%', bottom: -42, transform: 'translateX(-50%)', zIndex: 3 }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 40px rgba(0,0,0,0.16)', border: '3px solid #FFF', overflow: 'hidden' }}>
                  <img src={logoUrl} alt={restaurantName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{ padding: '56px 20px 8px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#1A1A1A', fontFamily: themeFont, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {restaurantName}
            </div>
          </div>

          {/* Specials CTA */}
          {hasRecommendations && (
            <div style={{ padding: '0 20px 12px 20px' }}>
              <button
                onClick={() => handleCategoryClick("Today's Specials")}
                className="nav-card"
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 18,
                  padding: '16px 18px',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  background: specialsBackgroundImage
                    ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url(${specialsBackgroundImage})`
                    : `linear-gradient(135deg, #FF6B35, #F7931E)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow: '0 12px 30px rgba(255, 107, 53, 0.35)'
                }}
              >
                <span style={{ fontSize: 18, marginRight: 6 }}>✨</span>
                {specialsTitle}
              </button>
            </div>
          )}

          {/* Category grid */}
          <div style={{ padding: '4px 20px 24px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '8px 0 12px 2px', letterSpacing: '.02em' }}>
              {browseMenuTitle}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {groupCategories.filter(gc => gc !== 'Recommendations').map((groupCategory) => (
                <button
                  key={groupCategory}
                  className="nav-card"
                  onClick={() => handleCategoryClick(groupCategory)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: 64,
                    padding: '12px',
                    borderRadius: 14,
                    border: '1px solid rgba(17,24,39,0.08)',
                    background: 'rgba(255,255,255,0.9)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.06)'
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2937', letterSpacing: '-0.01em' }}>{groupCategory} Menu</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

 