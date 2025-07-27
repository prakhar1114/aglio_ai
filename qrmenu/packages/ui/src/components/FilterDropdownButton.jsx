import React from 'react';

export function FilterDropdownButton({
  setIsFilterDropdownOpen,
  isFilterDropdownOpen,
  selectedTags = [],
  onRemoveTag,
  availableTagsCount = 0
}) {
  // Convert tag format for display
  const formatTagForDisplay = (tag) => {
    return tag.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

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
          
          .filter-dropdown-button {
            animation: subtle-background-pulse 4s ease-in-out infinite;
          }
          
          .filter-dropdown-button:hover {
            animation-play-state: paused;
          }

          .selected-tag-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: rgba(0, 122, 255, 0.1);
            border: 1px solid rgba(0, 122, 255, 0.2);
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            color: #007AFF;
            margin: 2px;
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }

          .selected-tag-pill:hover {
            background: rgba(0, 122, 255, 0.15);
            transform: translateY(-1px);
          }

          .selected-tag-pill .remove-btn {
            background: none;
            border: none;
            color: #007AFF;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            padding: 0;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }

          .selected-tag-pill .remove-btn:hover {
            background: rgba(0, 122, 255, 0.2);
            color: #0056CC;
          }
        `}
      </style>

      {/* Show selected tags as pills */}
      {selectedTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '8px',
            maxWidth: '300px',
            justifyContent: 'flex-end',
            position: 'absolute',
            bottom: '100%',
            right: '0'
          }}
        >
          {selectedTags.map((tag) => (
            <span key={tag} className="selected-tag-pill">
              {formatTagForDisplay(tag)}
              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTag?.(tag);
                }}
                title={`Remove ${formatTagForDisplay(tag)} filter`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter button */}
      <button
        className="filter-dropdown-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsFilterDropdownOpen((prev) => !prev);
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
          letterSpacing: '-0.01em',
          marginLeft: 'auto', // Push to the right,
          fill: "transparent"
        }}
      >
        <span style={{ 
          color: '#1C1C1E', // Apple's primary text color
          fontWeight: '500',
          letterSpacing: '-0.01em'
        }}>
          {selectedTags.length > 0 ? `${selectedTags.length} filter${selectedTags.length !== 1 ? 's' : ''}` : 'Filters'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="transparent"
          stroke="#86868B"
          style={{
            transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          {/* Filter icon */}
          <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
    </div>
  );
} 