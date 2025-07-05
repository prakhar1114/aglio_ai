import React, { useRef, useState, useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useMenu } from '@qrmenu/core';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';
import { CategoryDropdown, CategoryDropdownButton } from './CategoryDropdown.jsx';

export function MasonryFeed({ filters = {}, gap = 2, onItemClick }) {
  // Refs for virtuoso
  const virtuosoRef = useRef(null);

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Track current visible category for the floating pill
  const [currentVisibleCategory, setCurrentVisibleCategory] = useState(null);
  
  // Fetch data - now using client-side filtering
  const {
    data,
    isLoading,
    error
  } = useMenu(filters);

  // Transform and group data
  const { groupedData, groupCounts, categoryIndexMap, categories, dropdownCategories, hasAnyItems } = useMemo(() => {
    const fetchedItems = data ? data.items : []; // Changed from data.pages.flatMap since we no longer use pagination
    const transformedItems = fetchedItems
      .filter(item => item && item.id)
      .map(item => ({
        ...item,
        kind: 'food',
      }));

    // Extract unique categories for dropdown from all fetched items
    const allCategories = new Set();
    fetchedItems.forEach(item => {
      if (item && item.category_brief) {
        allCategories.add(item.category_brief.trim());
      }
    });
    const dropdownCategories = Array.from(allCategories);

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

    const hasAnyItems = transformedItems.length > 0;

    return { groupedData, groupCounts, categoryIndexMap, categories, dropdownCategories, hasAnyItems };
  }, [data]);





  // Calculate responsive column count based on viewport width
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
    return 180; // Fallback
  };

  // State to track column count and card width, trigger re-renders on resize
  const [columnCount, setColumnCount] = useState(getColumnCount());
  const [cardWidth, setCardWidth] = useState(getCardWidth());
  // console.log("cardWidth", cardWidth)
  // console.log("columnCount", columnCount)

  // Update column count and card width on window resize
  React.useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
      setCardWidth(getCardWidth());
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
      
      // React's setState only triggers re-render if value actually changes
      if (visibleCategory) {
        setCurrentVisibleCategory(visibleCategory);
      }
    }
  }, [categories]);

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

  // Check for filters applied (any active filter)
  const hasActiveFilters = Object.values(filters).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== '';
  });

  // Show no items found message when there are no items and filters are applied
  if (!isLoading && !hasAnyItems && hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="text-4xl mb-4">🍽️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
        <p className="text-gray-500 mb-4">
          We couldn't find any items matching your current filters.
        </p>
        <p className="text-sm text-gray-400">
          Try relaxing your filters to see more options.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Fixed category header - always on top */}
      {currentVisibleCategory && (
        <CategoryDropdownButton
          setIsDropdownOpen={setIsDropdownOpen}
          currentVisibleCategory={currentVisibleCategory}
          isDropdownOpen={isDropdownOpen}
        />
      )}

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
                  position: 'relative', // Regular section header, not sticky
                  zIndex: 100, // Higher than ItemCard buttons (z-index: 10)
                  height: '1px', // Minimal height to avoid zero-sized element error
                  margin: '0',
                  padding: '0',
                  overflow: 'visible', // Allow button to overflow outside the 1px container
                }}
              >
                <button
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '6px',
                    zIndex: 100,
                    background: 'rgba(255, 255, 255, 0.92)', // Subtle transparency as requested
                    backdropFilter: 'blur(8px)', // Light blur for premium feel
                    WebkitBackdropFilter: 'blur(8px)',
                    padding: '6px 10px', // Reduced footprint: smaller padding
                    borderRadius: '6px', // Smaller border radius to match reduced size
                    border: '1px solid rgba(229, 231, 235, 0.6)', // More transparent border
                    fontSize: '14px', // Same font size as requested
                    fontWeight: '600', // theme typography.weights.semibold
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    display: 'flex', // Show as section header for visual separation
                    alignItems: 'center',
                    gap: '4px', // Reduced gap for smaller footprint
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    lineHeight: '1.4',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.98)';
                    e.target.style.transform = 'translateY(-0.5px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.92)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ 
                    color: '#1C1C1E', // Same black as dish names (theme colors.text.primary)
                    fontWeight: '600',
                    letterSpacing: '-0.01em'
                  }}>
                    {category}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12" // Smaller icon for reduced footprint
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280" // theme colors.text.secondary
                    strokeWidth="2.5" // Slightly bolder for smaller size
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: 'transform 0.15s ease-in-out',
                      transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            );
          }}
          itemContent={(index, groupIndex) => {
            const groupItems = groupedData[groupIndex][0]; // Get all items in this group
            const category = (groupItems[0]?.category_brief || '').trim();
            
            // Apple-like subtle alternating backgrounds for visual differentiation
            const getBackgroundForCategory = (index) => {
              const backgrounds = [
                '#F7F9FC', // theme colors.background
                'rgba(226, 55, 68, 0.02)', // theme colors.primarySubtle (very subtle Zomato red tint)
                'rgba(250, 251, 252, 1)', // theme colors.surfaceElevated
              ];
              return backgrounds[index % backgrounds.length];
            };
            
            return (
              <div
                className="masonry-container"
                data-category={category}
                style={{
                  // Use CSS columns for true masonry layout like Pinterest
                  columnCount: columnCount,
                  columnGap: `4px`, // theme spacing.xs - minimal gap for Apple-like breathing
                  width: '100%',
                  padding: `2px 4px`, // Minimal padding - just enough to prevent edge collision
                  margin: '0',
                  lineHeight: '1',
                  backgroundColor: getBackgroundForCategory(groupIndex), // Subtle alternating backgrounds
                  borderRadius: '8px', // theme radius.md for gentle container feel
                  marginBottom: '4px', // theme spacing.xs for category separation
                  border: groupIndex % 3 === 1 ? '1px solid rgba(226, 55, 68, 0.08)' : 'none', // Subtle Zomato red accent for alternate sections
                }}
              >
                {groupItems.map((item, itemIndex) => {
                  // Determine if this item should be featured (span all columns)
                  // You can customize this logic based on your needs:
                  const isFeatured = false; // Every 5th item, or add your own logic
                  
                  return (
                    <div
                      key={item.id}
                      className="feed-item"
                      data-category={category}
                      style={{
                        borderRadius: '0px',
                        overflow: 'hidden',
                        breakInside: 'avoid', // Prevents items from breaking across columns
                        margin: '0 0 4px 0', // theme spacing.xs bottom margin for subtle item separation
                        padding: '0',
                        display: 'inline-block',
                        width: '100%',
                        verticalAlign: 'top', // Align to top to prevent text baseline spacing
                        columnSpan: isFeatured ? 'all' : 'none', // Span all columns for featured items
                      }}
                    >
                      <FeedItemSwitcher 
                        item={item} 
                        containerWidth={cardWidth}
                        onItemClick={() => {
                          const allCurrentItems = data ? data.items : [];
                          onItemClick?.(item, allCurrentItems);
                        }}
                        preload={true}
                        autoplay={true}
                        muted={true}
                      />
                    </div>
                  );
                })}
              </div>
            );
          }}
          endReached={() => {
            // No longer need infinite scroll since we fetch full menu
          }}
          overscan={200}
        />
        
        {/* Menu items are now loaded completely at once */}
      </div>
    </>
  );
} 