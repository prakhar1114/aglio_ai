import React from 'react';

export function FilterDropdown({ isOpen, tags = [], selectedTags = [], onTagToggle, onClose }) {
  if (!isOpen) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Convert tag format for display
  const formatTagForDisplay = (tag) => {
    return tag.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div
      className="fixed inset-0 z-[9998]"
      onClick={handleBackgroundClick}
      style={{ pointerEvents: 'auto' }}
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
          Filters
        </div>
        
        {/* Scrollable list */}
        <div style={{ 
          maxHeight: 'calc(60vh - 60px)', 
          overflowY: 'auto',
          padding: '8px'
        }}>
          {tags.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: '#86868B',
                fontSize: '14px',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              No filters available
            </div>
          ) : (
            tags.map((tag, index) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <div key={tag}>
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
                      backgroundColor: isSelected ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
                      border: isSelected ? '1px solid rgba(0, 122, 255, 0.2)' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onClick={() => onTagToggle?.(tag)}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: isSelected ? 'none' : '2px solid rgba(0, 0, 0, 0.2)',
                        backgroundColor: isSelected ? '#007AFF' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      }}
                    >
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                      )}
                    </div>
                    
                    {/* Tag name */}
                    <span style={{ flex: 1 }}>
                      {formatTagForDisplay(tag)}
                    </span>
                  </div>
                  
                  {/* Light separation line - only show if not the last item */}
                  {index < tags.length - 1 && (
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
} 