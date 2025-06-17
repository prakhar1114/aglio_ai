import React from 'react';

export function CategoryDropdown({ isOpen, categories = [], onSelect, onClose }) {
  if (!isOpen) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

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
          borderRadius: '8px', // theme radius.md - matches cards
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)', // theme shadows.lg - same as cards
          border: '1px solid #E5E7EB', // theme colors.border.light - consistent borders
          maxHeight: '60vh',
          overflow: 'hidden',
          zIndex: 9999
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F3F4F6',
            fontSize: '14px',
            fontWeight: '600',
            color: '#1C1C1E', // theme colors.text.primary
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            background: '#FAFBFC' // theme colors.surfaceElevated
          }}
        >
          Categories
        </div>
        
        {/* Scrollable list */}
        <div style={{ 
          maxHeight: 'calc(60vh - 50px)', 
          overflowY: 'auto',
          padding: '4px'
        }}>
          {categories.map((cat, index) => (
            <div
              key={cat}
              style={{
                padding: '12px 16px', // theme spacing md + lg
                fontSize: '14px', // theme typography.sizes.sm
                fontWeight: '500', // theme typography.weights.medium
                color: '#1C1C1E', // theme colors.text.primary
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                cursor: 'pointer',
                borderRadius: '6px', // theme radius.sm
                margin: '2px',
                transition: 'all 0.15s ease-in-out',
                lineHeight: '1.4'
              }}
              onClick={() => onSelect?.(cat)}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#F7F9FC'; // theme colors.background
                e.target.style.transform = 'translateX(2px)'; // Subtle Apple-like slide
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.transform = 'translateX(0)';
              }}
            >
              {cat}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 