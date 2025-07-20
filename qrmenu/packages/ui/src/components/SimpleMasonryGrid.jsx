import React, { useState, useEffect } from 'react';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';

export function SimpleMasonryGrid({ 
  items = [], 
  onItemClick,
  title,
  className = '' 
}) {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

  // Update column count and card width on window resize – only trigger
  // state updates when the computed values actually change to avoid
  // unnecessary renders (performance tweak B).
  useEffect(() => {
    const handleResize = () => {
      const nextCols = getColumnCount();
      const nextWidth = getCardWidth();

      // Only update if different – avoids a redundant render pass.
      setColumnCount((prev) => (prev === nextCols ? prev : nextCols));
      setCardWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Process items: sort and apply column span logic
  const processedItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    
    // Sort: media items first, no-media items last
    const sortedItems = [...items].sort((a, b) => {
      const aHasMedia = a.image_url !== null;
      const bHasMedia = b.image_url !== null;
      
      if (aHasMedia && !bHasMedia) return -1; // a comes first
      if (!aHasMedia && bHasMedia) return 1;  // b comes first
      return 0; // maintain relative order
    });

    // Apply column span logic for 2-column grid
    const mediaItems = sortedItems.filter(item => item.image_url !== null);
    const noMediaItems = sortedItems.filter(item => item.image_url === null);
    const mediaCount = mediaItems.length;
    
    // Reset any existing columnSpan
    sortedItems.forEach(item => {
      delete item.columnSpan;
    });

    if (mediaCount > 0) {
      if (mediaCount % 2 === 0) {
        // Even number of media items: all media normal span, all no-media full width
        noMediaItems.forEach(item => {
          item.columnSpan = 'all';
        });
      } else {
        // Odd number of media items: last media item + all no-media get full width
        if (mediaItems.length > 0) {
          mediaItems[mediaItems.length - 1].columnSpan = 'all';
        }
        noMediaItems.forEach(item => {
          item.columnSpan = 'all';
        });
      }
    } else {
      // No media items: all items get full width
      sortedItems.forEach(item => {
        item.columnSpan = 'all';
      });
    }

    return sortedItems;
  }, [items]);

  if (!processedItems || processedItems.length === 0) {
    console.log('SimpleMasonryGrid: No items to render, returning null');
    return null;
  }

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
      
      <div style={{ width: '100%', backgroundColor: '#D8D8DD', padding: '4px 0px 4px 0px' }}>
        {/* Regular masonry grid for normal-span items */}
        {processedItems.filter(item => item.columnSpan !== 'all').length > 0 && (
          <div
            className="masonry-container"
            style={{
              // Use CSS columns for true masonry layout like Pinterest
              columnCount: columnCount,
              // columnFill: 'auto', // Fill columns sequentially instead of balancing
              columnGap: '4px', // theme spacing.xs - minimal gap for Apple-like breathing
              width: '100%',
              padding: '0px 4px', // Minimal padding - just enough to prevent edge collision
              margin: '0 0 4px 0',
              lineHeight: '1',
              backgroundColor: '#D8D8DD', // theme colors.background
              borderRadius: '8px', // theme radius.md for gentle container feel
            }}
          >
            {processedItems.filter(item => item.columnSpan !== 'all').map((item) => (
              <div
                key={item.id}
                className="feed-item"
                style={{
                  borderRadius: '0px',
                  overflow: 'hidden',
                  breakInside: 'avoid', // Prevents items from breaking across columns
                  margin: '0 0 4px 0', // theme spacing.xs bottom margin for subtle item separation
                  padding: '0',
                  display: isMobile ? 'inline-block' : 'block',
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
                  context_namespace={`simple-masonry-grid`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Full-width items outside the masonry grid */}
        {processedItems.filter(item => item.columnSpan === 'all').map((item) => (
          <div
            key={item.id}
            className="full-width-item"
            style={{
              width: '100%',
              padding: '0px 4px', // Same as masonry container
              backgroundColor: '#D8D8DD',
              borderRadius: '8px',
              margin: '0 0 4px 0', // Same margin as masonry items
            }}
          >
            <FeedItemSwitcher 
              item={item} 
              containerWidth={Math.min((window.innerWidth || 400) - 16, 800)} // Full width minus padding, max 800px
              onItemClick={() => {
                console.log('SimpleMasonryGrid item clicked:', item.name);
                onItemClick?.(item);
              }}
              context_namespace={`simple-masonry-grid`}
            />
          </div>
        ))}
      </div>
    </div>
  );
} 