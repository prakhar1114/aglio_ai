import React, { useRef } from 'react';
import { MasonryInfiniteGrid } from '@egjs/react-infinitegrid';
import { useMenu } from '@qrmenu/core';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';

export function MasonryFeed({ filters = {}, gap = 2 }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useMenu(filters);

  // Transform API data to add missing 'kind' property and filter out any undefined items
  const fetchedItems = data ? data.pages.flatMap((p) => p.items) : [];
  const transformedItems = fetchedItems
    .filter(item => item && item.id) // Filter out undefined/null items
    .map(item => ({
      ...item,
      kind: 'food', // Add the required 'kind' property for FeedItemSwitcher
    }));

  const allItems = transformedItems;
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-gray-500">Error: {error.message}</p>
        <p className="text-gray-400 text-sm mt-2">API: {import.meta.env.VITE_API_BASE || 'http://localhost:8005'}</p>
      </div>
    );
  }

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
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      >
        {allItems
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
      
      {/* Loading indicator for infinite scroll */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
        </div>
      )}
    </div>
  );
} 