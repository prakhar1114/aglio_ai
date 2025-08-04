import React, { useEffect, useRef } from 'react';

export function CategorySwitcherDropdown({
  isOpen,
  onClose,
  groupCategories = [],
  hasRecommendations = false,
  currentActiveCategory,
  onCategorySelect,
}) {
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOptionClick = (category) => {
    onCategorySelect(category);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
        }}
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          bottom: '80px', // Above bottom bar
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '280px',
          width: 'calc(100vw - 32px)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 10000,
          padding: '8px',
          animation: 'dropdownSlideUp 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        <style>
          {`
            @keyframes dropdownSlideUp {
              0% {
                opacity: 0;
                transform: translateX(-50%) translateY(10px) scale(0.95);
              }
              100% {
                opacity: 1;
                transform: translateX(-50%) translateY(0) scale(1);
              }
            }
          `}
        </style>

        {/* Trending option */}
        {hasRecommendations && (
          <button
            onClick={() => handleOptionClick('Recommendations')}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: currentActiveCategory === 'Recommendations' 
                ? 'rgba(28, 28, 30, 0.08)' 
                : 'transparent',
              border: 'none',
              borderRadius: '12px',
              color: '#1F2937',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              letterSpacing: '-0.003em',
              marginBottom: '4px',
            }}
            onMouseEnter={(e) => {
              if (currentActiveCategory !== 'Recommendations') {
                e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentActiveCategory !== 'Recommendations') {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '16px' }}>✨</span>
            Trending Menu
          </button>
        )}

        {/* Group categories */}
        {groupCategories.map((groupCategory) => (
          groupCategory !== "Recommendations" && (
            <button
              key={groupCategory}
              onClick={() => handleOptionClick(groupCategory)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: currentActiveCategory === groupCategory 
                  ? 'rgba(28, 28, 30, 0.08)' 
                  : 'transparent',
                border: 'none',
                borderRadius: '12px',
                color: '#1F2937',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                letterSpacing: '-0.003em',
                marginBottom: '4px',
              }}
              onMouseEnter={(e) => {
                if (currentActiveCategory !== groupCategory) {
                  e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentActiveCategory !== groupCategory) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              {groupCategory} Menu
            </button>
          )
        ))}
      </div>
    </>
  );
}