import React from 'react';

export function CategoryDropdown({ isOpen, categories = [], onSelect, onClose, showAggregatedCategory = false, groupCategoryMap = {}, categoryItemCounts = {}, selectedTags = [] }) {
  if (!isOpen) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Helper function to group categories by their group_category
  const getGroupedCategories = () => {
    if (!showAggregatedCategory) return null;
    
    const grouped = {};
    categories.forEach(cat => {
      // Skip categories with zero items
      if (categoryItemCounts[cat] === 0) return;
      
      const groupCat = groupCategoryMap[cat] || 'Other';
      if (!grouped[groupCat]) {
        grouped[groupCat] = [];
      }
      grouped[groupCat].push(cat);
    });
    
    return grouped;
  };

  const groupedCategories = getGroupedCategories();

  return (
    <div
      className="fixed inset-0 z-[9998]"
      onClick={handleBackgroundClick}
    >
      <div 
        style={{
          position: 'absolute',
          top: '60px', // Below the sticky header
          left: '12px',
          right: '12px',
          maxWidth: '400px',
          margin: '0 auto',
          background: '#FFFFFF', // theme colors.surface - clean white like cards
          borderRadius: '12px', // Apple-style rounded corners
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)', // Apple-style shadow
          border: '1px solid rgba(0, 0, 0, 0.08)', // Subtle border
          maxHeight: '60vh',
          overflow: 'hidden',
          zIndex: 9999,
          backdropFilter: 'blur(20px)', // Apple-style backdrop blur
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            fontSize: '15px',
            fontWeight: '600',
            color: '#1C1C1E', // theme colors.text.primary
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            background: 'rgba(248, 248, 248, 0.8)', // Apple-style subtle background
            letterSpacing: '-0.01em'
          }}
        >
          Categories
        </div>
        
        {/* Scrollable list */}
        <div style={{ 
          maxHeight: 'calc(60vh - 60px)', 
          overflowY: 'auto',
          padding: '8px'
        }}>
          {showAggregatedCategory && groupedCategories ? (
            // Show categories grouped by group_category with labels
            Object.entries(groupedCategories).map(([groupCat, subCategories]) => (
              <div key={groupCat}>
                {/* Group Category Label */}
                <div
                  style={{
                    padding: '12px 16px 8px 16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#86868B', // Apple's secondary text color
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: 'transparent',
                    margin: '0'
                  }}
                >
                  {groupCat}
                </div>
                
                {/* Sub Categories */}
                {subCategories.map((cat, index) => (
                  <div key={cat}>
                    <div
                      style={{
                        padding: '12px 16px',
                        fontSize: '15px',
                        fontWeight: '400', // Apple's regular weight
                        color: '#1C1C1E', // Apple's primary text color
                        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        cursor: 'pointer',
                        borderRadius: '8px', // Apple-style rounded corners
                        margin: '2px 4px',
                        transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Apple's easing
                        lineHeight: '1.4',
                        position: 'relative',
                        backgroundColor: 'transparent',
                        border: '1px solid transparent'
                      }}
                      onClick={() => onSelect?.(cat)}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'rgba(0, 122, 255, 0.08)'; // Apple's blue tint
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                        e.target.style.border = '1px solid rgba(0, 122, 255, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                        e.target.style.border = '1px solid transparent';
                      }}
                      onMouseDown={(e) => {
                        e.target.style.transform = 'translateY(0px)';
                        e.target.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.12)';
                      }}
                      onMouseUp={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                      }}
                    >
                      {cat}
                    </div>
                    {/* Light separation line - only show if not the last item */}
                    {index < subCategories.length - 1 && (
                      <div
                        style={{
                          height: '1px',
                          backgroundColor: 'rgba(0, 0, 0, 0.06)',
                          margin: '0 20px',
                          borderRadius: '0.5px'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))
          ) : (
            // Show only sub-categories (original behavior)
            categories.filter(cat => categoryItemCounts[cat] > 0).map((cat, index) => (
              <div key={cat}>
                <div
                  style={{
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: '400', // Apple's regular weight
                    color: '#1C1C1E', // Apple's primary text color
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    cursor: 'pointer',
                    borderRadius: '8px', // Apple-style rounded corners
                    margin: '2px 4px',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Apple's easing
                    lineHeight: '1.4',
                    position: 'relative',
                    backgroundColor: 'transparent',
                    border: '1px solid transparent'
                  }}
                  onClick={() => onSelect?.(cat)}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'rgba(0, 122, 255, 0.08)'; // Apple's blue tint
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                    e.target.style.border = '1px solid rgba(0, 122, 255, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                    e.target.style.border = '1px solid transparent';
                  }}
                  onMouseDown={(e) => {
                    e.target.style.transform = 'translateY(0px)';
                    e.target.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.12)';
                  }}
                  onMouseUp={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
                  }}
                >
                  {cat}
                </div>
                {/* Light separation line - only show if not the last item */}
                {index < categories.filter(cat => categoryItemCounts[cat] > 0).length - 1 && (
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: 'rgba(0, 0, 0, 0.06)',
                      margin: '0 20px',
                      borderRadius: '0.5px'
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 

export function CategoryDropdownButton({
  setIsDropdownOpen, 
  currentVisibleCategory, 
  isDropdownOpen,
  // NEW PROPS:
  showAggregatedCategory = false,
  currentVisibleGroupCategory = null,
  setIsGroupDropdownOpen = null,
  isGroupDropdownOpen = false
}) {
  // Conditional rendering based on showAggregatedCategory
  if (showAggregatedCategory && currentVisibleGroupCategory) {
    return (
      <div
        style={{
          position: 'relative',
          zIndex: 40, // Higher than any other element
          pointerEvents: 'auto',
        }}
      >
        <style>
          {`
            @keyframes subtle-background-pulse {
              0%, 100% {
                background: rgba(255, 255, 255, 0.95);
              }
              50% {
                background: rgba(255, 255, 255, 0.85);
              }
            }
            
            .category-dropdown-button {
              animation: subtle-background-pulse 4s ease-in-out infinite;
            }
            
            .category-dropdown-button:hover {
              animation-play-state: paused;
            }
          `}
        </style>
        {/* Single unified pill with both group and sub category */}
        <button
          className="category-dropdown-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen((prev) => !prev); // Only open CategoryDropdown
          }}
          style={{
            backdropFilter: 'blur(20px)', // Apple-style backdrop blur
            WebkitBackdropFilter: 'blur(20px)',
            padding: '8px 14px', // Slightly more padding for better touch target
            borderRadius: '10px', // Apple-style rounded corners
            border: '1px solid rgba(255, 255, 255, 0.3)', // Subtle border
            fontSize: '14px',
            fontWeight: '500', // Apple's medium weight
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Apple's easing
            lineHeight: '1.4',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', // Subtle shadow
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '-0.01em',
            fill: "transparent"
          }}
        >
          <span style={{ 
            color: '#1C1C1E', // Apple's primary text color
            fontWeight: '500',
            letterSpacing: '-0.01em'
          }}>
            {currentVisibleCategory === "Recommendations" ? currentVisibleCategory : currentVisibleGroupCategory + " / " + currentVisibleCategory}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            stroke="#86868B"
            style={{
              transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            {/* A classic down‐pointing triangle */}
            <path d="M6 9l6 6 6-6z" />
          </svg>
        </button>
      </div>
    );
  } else {
    // Existing single category display
    return (
      <div
        style={{
          position: 'relative',
          zIndex: 40, // Higher than any other element
          pointerEvents: 'auto',
        }}
      >
        <style>
          {`
            @keyframes subtle-background-pulse {
              0%, 100% {
                background: rgba(255, 255, 255, 0.95);
              }
              50% {
                background: rgba(255, 255, 255, 0.85);
              }
            }
            
            .category-dropdown-button {
              animation: subtle-background-pulse 4s ease-in-out infinite;
            }
            
            .category-dropdown-button:hover {
              animation-play-state: paused;
            }
          `}
        </style>
        <button
          className="category-dropdown-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen((prev) => !prev);
          }}
          style={{
            backdropFilter: 'blur(20px)', // Apple-style backdrop blur
            WebkitBackdropFilter: 'blur(20px)',
            padding: '8px 14px', // Slightly more padding for better touch target
            borderRadius: '10px', // Apple-style rounded corners
            border: '1px solid rgba(255, 255, 255, 0.3)', // Subtle border
            fontSize: '14px',
            fontWeight: '500', // Apple's medium weight
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Apple's easing
            lineHeight: '1.4',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', // Subtle shadow
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '-0.01em'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.98)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
          }}
          onMouseDown={(e) => {
            e.target.style.transform = 'translateY(0px)';
            e.target.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.12)';
          }}
          onMouseUp={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
          }}
        >
          <span style={{ 
            color: '#1C1C1E', // Apple's primary text color
            fontWeight: '500',
            letterSpacing: '-0.01em'
          }}>
            {currentVisibleCategory}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#86868B"
            style={{
              transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            {/* A classic down‐pointing triangle */}
            <path d="M6 9l6 6 6-6z" />
          </svg>
        </button>
      </div>
    );
  }
}
