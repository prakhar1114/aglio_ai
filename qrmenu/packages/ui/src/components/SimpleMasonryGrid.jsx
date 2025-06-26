import React, { useState, useEffect } from 'react';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';

export function SimpleMasonryGrid({ 
  items = [], 
  onItemClick,
  title,
  className = '' 
}) {
  // Debug logging
  console.log('SimpleMasonryGrid render:', {
    itemsLength: items?.length || 0,
    title,
    className,
    items: items?.map(item => ({ id: item.id, name: item.name })) || []
  });

  // Calculate responsive column count based on viewport width (same as MasonryFeed)
  const getColumnCount = () => {
    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth - 8; // Account for minimal padding (4px * 2)
      // Dynamic columns - each column should be ~180-200px wide, max 396px per card
      if (viewportWidth < 250) return 1;
      if (viewportWidth < 450) return 2;
      if (viewportWidth < 650) return 3;
      return Math.min(Math.floor(viewportWidth / 200), 4); // Max 4 columns, ~200px per column
    }
    return 2;
  };

  // Calculate optimal card width (max 396px per card)
  const getCardWidth = () => {
    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth - 8;
      const columnCount = getColumnCount();
      const gapWidth = (columnCount - 1) * 4; // 4px gap between columns
      const paddingWidth = 2 * 4; // 4px padding on each side
      const availableWidth = viewportWidth - gapWidth - paddingWidth;
      const calculatedWidth = Math.floor(availableWidth / columnCount);
      
      // Ensure each card is maximum 396px
      return Math.min(calculatedWidth, 396);
    }
    console.log("SimpleMasonryGrid: No window, returning 180");
    return 180; // Fallback
  };

  // State to track column count and card width, trigger re-renders on resize
  const [columnCount, setColumnCount] = useState(getColumnCount());
  const [cardWidth, setCardWidth] = useState(getCardWidth());

  // Update column count and card width on window resize
  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
      setCardWidth(getCardWidth());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!items || items.length === 0) {
    console.log('SimpleMasonryGrid: No items to render, returning null');
    return null;
  }

  console.log('SimpleMasonryGrid: Rendering grid with', items.length, 'items and', columnCount, 'columns');

  return (
    <div 
      className={className}
      style={{
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        padding: '1px', // Minimal padding like MasonryFeed
      }}
    >
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 mb-3" style={{ padding: '0 4px' }}>
          {title}
        </h2>
      )}
      
      <div
        className="masonry-container"
        style={{
          // Use CSS columns for true masonry layout like Pinterest (same as MasonryFeed)
          columnCount: columnCount,
          columnGap: '4px', // theme spacing.xs - minimal gap for Apple-like breathing
          width: '100%',
          padding: '2px 4px', // Minimal padding - just enough to prevent edge collision
          margin: '0',
          lineHeight: '1',
          backgroundColor: '#F7F9FC', // theme colors.background (same as MasonryFeed)
          borderRadius: '8px', // theme radius.md for gentle container feel
          marginBottom: '4px', // theme spacing.xs for category separation
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="feed-item"
            style={{
              borderRadius: '0px',
              overflow: 'hidden',
              breakInside: 'avoid', // Prevents items from breaking across columns
              margin: '0 0 4px 0', // theme spacing.xs bottom margin for subtle item separation
              padding: '0',
              display: 'inline-block',
              width: '100%',
              verticalAlign: 'top', // Align to top to prevent text baseline spacing
            }}
          >
            <FeedItemSwitcher 
              item={item} 
              containerWidth={cardWidth}
              onItemClick={() => {
                console.log('SimpleMasonryGrid item clicked:', item.name);
                onItemClick?.(item);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
} 