import React, { useRef } from 'react';
import { MasonryInfiniteGrid } from '@egjs/react-infinitegrid';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';

export function MasonryFeed({ items, loadMore, hasMore, gap = 2 }) {
  const gridRef = useRef(null);

  // Calculate item width for 2 columns with minimal gap
  const getItemWidth = () => {
    if (typeof window !== 'undefined') {
      const containerWidth = window.innerWidth;
      // 2 columns with minimal gap (2px gap on each side = 4px total)
      return Math.floor((containerWidth - gap * 3) / 2);
    }
    return 'calc(50% - 2px)';
  };

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '100%', 
      overflowX: 'hidden',
      boxSizing: 'border-box',
      padding: `0 0`,
      display: 'flex',
      justifyContent: 'center'
    }}>
      <MasonryInfiniteGrid
        ref={gridRef}
        className="masonry-feed"
        gap={gap}
        align="center"
        column={2}
        columnSize={getItemWidth()}
        style={{
          width: '100%',
          maxWidth: '100%'
        }}
        onRequestAppend={() => {
          if (hasMore) {
            loadMore?.();
          }
        }}
      >
        {items
          .filter(item => item && item.id) // Additional safety filter
          .map((item) => (
            <div 
              key={item.id} 
              className="feed-item" 
              data-grid-groupkey={item.id}
              style={{
                width: getItemWidth(),
                boxSizing: 'border-box',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            >
              <FeedItemSwitcher item={item} />
            </div>
          ))}
      </MasonryInfiniteGrid>
    </div>
  );
} 