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
      const containerWidth = Math.min(window.innerWidth - 8, 396); // Account for minimal padding (4px * 2)
      // Dynamic columns based on width for optimal item sizes
      if (containerWidth < 250) return 1;
      if (containerWidth < 350) return 2;
      return Math.min(Math.floor(containerWidth / 180), 3); // Max 3 columns, min 180px per column
    }
    return 2;
  };

  // State to track column count and trigger re-renders on resize
  const [columnCount, setColumnCount] = useState(getColumnCount());

  // Update column count on window resize
  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
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
        maxWidth: '428px',
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