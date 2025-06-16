import React, { useRef, useState, useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useMenu, useCategories } from '@qrmenu/core';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';
import { CategoryDropdown } from './CategoryDropdown.jsx';

export function MasonryFeed({ filters = {}, gap = 2 }) {
  // Refs for virtuoso
  const virtuosoRef = useRef(null);

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Track current visible category for the floating pill
  const [currentVisibleCategory, setCurrentVisibleCategory] = useState(null);
  
  // Fetch data
  const { data: categoriesRes } = useCategories();
  const dropdownCategories = Array.isArray(categoriesRes)
    ? Array.from(new Set(categoriesRes.map((c) => (c.category_brief ?? c).trim())))
    : categoriesRes?.categories?.map((c)=> (typeof c === 'string' ? c.trim(): c)) ?? [];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useMenu(filters);

  // Transform and group data
  const { groupedData, groupCounts, categoryIndexMap, categories } = useMemo(() => {
    const fetchedItems = data ? data.pages.flatMap((p) => p.items) : [];
    const transformedItems = fetchedItems
      .filter(item => item && item.id)
      .map(item => ({
        ...item,
        kind: 'food',
      }));

    // Group items by category_brief
    const grouped = {};
    const categories = [];
    const categoryIndexMap = {};

    transformedItems.forEach(item => {
      const category = (item.category_brief || 'Other').trim();
      if (!grouped[category]) {
        grouped[category] = [];
        categories.push(category);
        categoryIndexMap[category] = categories.length - 1;
      }
      grouped[category].push(item);
    });

    // Convert to arrays for GroupedVirtuoso - render each group as a complete masonry grid
    const groupedData = categories.map(cat => [grouped[cat]]); // Wrap each group in an array
    const groupCounts = groupedData.map(() => 1); // Each group renders as 1 item (the complete grid)

    return { groupedData, groupCounts, categoryIndexMap, categories };
  }, [data]);



  // Fallback: Set first category as visible when categories are available and no category is set
  React.useEffect(() => {
    if (categories.length > 0 && !currentVisibleCategory) {
      setCurrentVisibleCategory(categories[0]);
    }
  }, [categories, currentVisibleCategory]);

  // Calculate responsive column count based on viewport width
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
  React.useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle range changes to track visible category
  const handleRangeChanged = React.useCallback((range) => {
    if (range && categories.length > 0) {
      // Get the first visible group index (topmost visible category)
      const visibleGroupIndex = range.startIndex;
      const visibleCategory = categories[visibleGroupIndex];
      
      // Only update if category changed to prevent unnecessary re-renders
      if (visibleCategory && visibleCategory !== currentVisibleCategory) {
        setCurrentVisibleCategory(visibleCategory);
      }
    }
  }, [categories, currentVisibleCategory]);

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
    <>
      {/* Category dropdown */}
      <CategoryDropdown
        isOpen={isDropdownOpen}
        categories={dropdownCategories}
        onSelect={(category) => {
          const categoryIndex = categoryIndexMap[category];
          if (categoryIndex !== undefined && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({
              index: categoryIndex,
              behavior: 'smooth',
              align: 'start'
            });
          }
          setIsDropdownOpen(false);
        }}
        onClose={() => setIsDropdownOpen(false)}
      />

      {/* Virtualized feed container */}
      <div
        style={{
          width: '100%',
          maxWidth: '428px',
          margin: '0 auto',
          height: '100vh', // Full height for virtualization
          boxSizing: 'border-box',
          padding: '1px', // Minimal padding
          overflow: 'hidden', // Ensure no horizontal scroll
        }}
      >
        <GroupedVirtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          groupCounts={groupCounts}
          rangeChanged={handleRangeChanged}
          components={{
            List: React.forwardRef((props, ref) => (
              <div 
                ref={ref} 
                {...props}
                style={{
                  ...props.style,
                  display: 'block',
                  width: '100%',
                }}
              />
            )),
          }}
          groupContent={(index) => {
            const category = categories[index];
            
            return (
              <div
                className="sticky-category-header"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 100, // Higher than ItemCard buttons (z-index: 10)
                  height: '1px', // Minimal height to avoid zero-sized element error
                  margin: '0',
                  padding: '0',
                  overflow: 'visible', // Allow button to overflow outside the 1px container
                }}
              >
                <button
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="bg-white/40 backdrop-blur-lg px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2 hover:bg-white/75 transition-all duration-200 border border-gray-200/20"
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    zIndex: 100,
                  }}
                >
                  <span className="text-gray-800">{category}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            );
          }}
          itemContent={(index, groupIndex) => {
            const groupItems = groupedData[groupIndex][0]; // Get all items in this group
            const category = (groupItems[0]?.category_brief || '').trim();
            
            return (
              <div
                className="masonry-container"
                data-category={category}
                style={{
                  // Use CSS columns for true masonry layout like Pinterest
                  columnCount: columnCount,
                  columnGap: `0px`, // Fixed 0px gap between columns
                  width: '100%',
                  padding: `0px`, // No padding
                  margin: '0', // No margin
                  lineHeight: '1', // Remove line height spacing
                }}
              >
                {groupItems.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className="feed-item"
                    data-category={category}
                    style={{
                      borderRadius: '0px',
                      overflow: 'hidden',
                      breakInside: 'avoid', // Prevents items from breaking across columns
                      margin: '0', // Remove all margins
                      padding: '0', // Remove all padding
                      display: 'inline-block',
                      width: '100%',
                      verticalAlign: 'top', // Align to top to prevent text baseline spacing
                    }}
                  >
                    <FeedItemSwitcher item={item} />
                  </div>
                ))}
              </div>
            );
          }}
          endReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          overscan={200}
        />
        
        {/* Loading indicator for infinite scroll */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
          </div>
        )}
      </div>
    </>
  );
} 