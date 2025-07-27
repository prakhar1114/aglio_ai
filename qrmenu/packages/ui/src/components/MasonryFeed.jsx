import React, { useRef, useState, useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useMenu } from '@qrmenu/core';
import { FeedItemSwitcher } from './FeedItemSwitcher.jsx';
import { CategoryDropdown, CategoryDropdownButton } from './CategoryDropdown.jsx';
import { FilterDropdown } from './FilterDropdown.jsx';
import { FilterDropdownButton } from './FilterDropdownButton.jsx';

export function MasonryFeed({ filters = {}, gap = 2, onItemClick, showAggregatedCategory=false }) {
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  // Refs for virtuoso
  const virtuosoRef = useRef(null);

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Filter dropdown state
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Track current visible category for the floating pill
  const [currentVisibleCategory, setCurrentVisibleCategory] = useState(null);
  
  // NEW: Track current visible group category for aggregated view
  const [currentVisibleGroupCategory, setCurrentVisibleGroupCategory] = useState(null);
  

  
  // Fetch data - now using client-side filtering
  const {
    data,
    isLoading,
    error
  } = useMenu(filters);

  // Transform and group data
  const { groupedData, groupCounts, categoryIndexMap, categories, dropdownCategories, hasAnyItems, groupCategoryMap, availableTags, categoryItemCounts } = useMemo(() => {
    const fetchedItems = data ? data.items : []; // Changed from data.pages.flatMap since we no longer use pagination
    
    // Filter items by selected tags
    const filteredItems = selectedTags.length > 0 
      ? fetchedItems.filter(item => {
          if (!item.tags || !Array.isArray(item.tags)) return false;
          return selectedTags.some(tag => item.tags.includes(tag));
        })
      : fetchedItems;
    
    const transformedItems = filteredItems
      .filter(item => item && item.id)
      .map(item => ({
        ...item,
        kind: 'food',
      }));

    // Extract unique categories for dropdown from filtered items (not all fetched items)
    const allCategories = new Set();
    filteredItems.forEach(item => {
      if (item && item.category_brief) {
        allCategories.add(item.category_brief.trim());
      }
    });
    const dropdownCategories = Array.from(allCategories);

    // Extract unique tags from all fetched items
    const tagSet = new Set();
    fetchedItems.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => tagSet.add(tag));
      }
    });
    const availableTags = Array.from(tagSet);

    // NEW: Extract group categories and create mappings from filtered items
    const groupCategoryMap = {};
    filteredItems.forEach(item => {
      if (item && item.group_category && item.category_brief) {
        groupCategoryMap[item.category_brief.trim()] = item.group_category.trim();
      }
    });

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

    // Calculate item counts per category for filtering
    const categoryItemCounts = {};
    categories.forEach(category => {
      categoryItemCounts[category] = grouped[category] ? grouped[category].length : 0;
    });

    // Sort items within each category and apply column span logic
    Object.keys(grouped).forEach(category => {
      const items = grouped[category];
      
      // Sort: media items first, no-media items last
      items.sort((a, b) => {
        const aHasMedia = a.image_url !== null;
        const bHasMedia = b.image_url !== null;
        
        if (aHasMedia && !bHasMedia) return -1; // a comes first
        if (!aHasMedia && bHasMedia) return 1;  // b comes first
        return 0; // maintain relative order
      });

      // Apply column span logic for 2-column grid
      const mediaItems = items.filter(item => item.image_url !== null);
      const noMediaItems = items.filter(item => item.image_url === null);
      const mediaCount = mediaItems.length;
      
      // Reset any existing columnSpan
      items.forEach(item => {
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
        // No media items in category: all items get full width
        items.forEach(item => {
          item.columnSpan = 'all';
        });
      }
    });

    // Convert to arrays for GroupedVirtuoso - render each group as a complete masonry grid
    const groupedData = categories.map(cat => [grouped[cat]]); // Wrap each group in an array
    const groupCounts = groupedData.map(() => 1); // Each group renders as 1 item (the complete grid)

    const hasAnyItems = transformedItems.length > 0;

    return { groupedData, groupCounts, categoryIndexMap, categories, dropdownCategories, hasAnyItems, groupCategoryMap, availableTags, categoryItemCounts };
  }, [data, selectedTags]);





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
        // NEW: Set group category
        const groupCategory = groupCategoryMap[visibleCategory];
        setCurrentVisibleGroupCategory(groupCategory || null);
      }
    }
  }, [categories, groupCategoryMap]);

  // Filter handlers
  const handleTagToggle = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // Memoize the GroupedVirtuoso component to prevent rerendering when dropdown states change
  const memoizedVirtuoso = React.useMemo(() => (
    <GroupedVirtuoso
      ref={virtuosoRef}
      style={{ height: '100%' }}
      groupCounts={groupCounts}
      rangeChanged={handleRangeChanged}
      overscan={200}
      components={{
        List: React.forwardRef((props, ref) => (
          <div 
            ref={ref} 
            {...props}
            style={{
              ...props.style,
              display: 'block',
              width: '100%',
              overscrollBehavior: 'none', // Disable bounce/overscroll
            }}
          />
        )),
        Footer: () => (
          <div style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: '#6B7280',
            fontSize: '16px',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontWeight: '500',
            letterSpacing: '-0.01em',
            backgroundColor: 'transparent'
          }}>
            You have reached the end
          </div>
        ),
      }}
      groupContent={(index) => {
        const category = categories[index];
        
        return (
          <div
            className="category-label"
            style={{
              position: 'relative',
              zIndex: 10,
              height: '20px',
              margin: '8px 0 4px 8px',
              padding: '0',
              overflow: 'visible',
            }}
          >
            <span
              style={{
                color: '#374151', // Darker text color for more prominence
                fontSize: '14px', // Bigger font size
                fontWeight: '600', // Bolder weight for more prominence
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                opacity: 0.9, // Higher opacity for more prominence
              }}
            >
              {category}
            </span>
          </div>
        );
      }}
      itemContent={(index, groupIndex) => {
        const groupItems = groupedData[groupIndex][0]; // Get all items in this group
        const category = (groupItems[0]?.category_brief || '').trim();
        
        // Apple-like subtle alternating backgrounds for visual differentiation
        const getBackgroundForCategory = (index) => {
          const backgrounds = [
            // '#F7F9FC', // theme colors.background
            // 'rgba(226, 55, 68, 0.02)', // theme colors.primarySubtle (very subtle Zomato red tint)
            // 'rgba(250, 251, 252, 1)', // theme colors.surfaceElevated
            'transparent',
          ];
          return backgrounds[index % backgrounds.length];
        };
        
        return (
          <div style={{ width: '100%' }}>
            {/* Regular masonry grid for normal-span items */}
            {groupItems.filter(item => item.columnSpan !== 'all').length > 0 && (
              <div
                className="masonry-container"
                data-category={category}
                style={{
                  // Use CSS columns for true masonry layout like Pinterest
                  columnCount: columnCount,
                  columnGap: `4px`, // theme spacing.xs - minimal gap for Apple-like breathing
                  width: '100%',
                  padding: `0px 4px`, // Minimal padding - just enough to prevent edge collision
                  margin: '0 0 4px 0',
                  lineHeight: '1',
                  backgroundColor: getBackgroundForCategory(groupIndex), // Subtle alternating backgrounds
                  borderRadius: '8px', // theme radius.md for gentle container feel
                }}
              >
                {groupItems.filter(item => item.columnSpan !== 'all').map((item, itemIndex) => (
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
                      display: isMobile ? 'inline-block' : 'block',
                      width: '100%',
                      verticalAlign: 'top', // Align to top to prevent text baseline spacing
                      // Create explicit stacking context for full-width items to isolate video z-index
                      position: 'relative',
                      zIndex: 0, // Lower than category header (zIndex: 100)
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
                      context_namespace={`masonry-feed`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Full-width items outside the masonry grid */}
            {groupItems.filter(item => item.columnSpan === 'all').map((item, itemIndex) => (
              <div
                key={item.id}
                className="full-width-item"
                data-category={category}
                style={{
                  width: '100%',
                  padding: '0px 4px', // Same as masonry container
                  backgroundColor: getBackgroundForCategory(groupIndex),
                  borderRadius: '8px',
                  // border: groupIndex % 3 === 1 ? '1px solid rgba(226, 55, 68, 0.08)' : 'none',
                  margin: '0 0 4px 0', // Same margin as masonry items
                  // Create explicit stacking context for full-width items to isolate video z-index
                  position: 'relative',
                  zIndex: 0, // Lower than category header (zIndex: 100)
                }}
              >
                <FeedItemSwitcher 
                  item={item} 
                  containerWidth={Math.min((window.innerWidth || 400) - 16, 800)} // Full width minus padding, max 800px
                  onItemClick={() => {
                    const allCurrentItems = data ? data.items : [];
                    onItemClick?.(item, allCurrentItems);
                  }}
                  preload={true}
                  autoplay={true}
                  muted={true}
                  context_namespace={`masonry-feed`}
                />
              </div>
            ))}
          </div>
        );
      }}
      endReached={() => {
        // No longer need infinite scroll since we fetch full menu
      }}
    />
  ), [groupCounts, categories, groupedData, columnCount, cardWidth, isMobile, data]);

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
  if (!isLoading && !hasAnyItems && (hasActiveFilters || selectedTags.length > 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="text-4xl mb-4">🍽️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {selectedTags.length > 0 ? 'No Items Match Selected Filters' : 'No Items Found'}
        </h3>
        <p className="text-gray-500 mb-4">
          {selectedTags.length > 0 
            ? 'Try adjusting your filter selections to see more options.'
            : 'We couldn\'t find any items matching your current filters.'
          }
        </p>
        {selectedTags.length > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Fixed category header - always on top */}
      <div style={{ display: 'flex', gap: '8px', position: 'fixed', top: '4px', left: '6px', zIndex: 40, alignItems: 'flex-start' }}>
        {currentVisibleCategory && (
          <CategoryDropdownButton
            setIsDropdownOpen={setIsDropdownOpen}
            currentVisibleCategory={currentVisibleCategory}
            isDropdownOpen={isDropdownOpen}
            // NEW PROPS:
            showAggregatedCategory={showAggregatedCategory}
            currentVisibleGroupCategory={currentVisibleGroupCategory}
          />
        )}
        
        {/* Filter button */}
        {availableTags.length > 0 && (  
        <FilterDropdownButton
          setIsFilterDropdownOpen={setIsFilterDropdownOpen}
          isFilterDropdownOpen={isFilterDropdownOpen}
          selectedTags={selectedTags}
          onRemoveTag={handleRemoveTag}
          availableTagsCount={availableTags.length}
        />)}
      </div>

      {/* Category dropdown */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9998 }}>
        <CategoryDropdown
          isOpen={isDropdownOpen}
          categories={dropdownCategories}
          showAggregatedCategory={showAggregatedCategory}
          groupCategoryMap={groupCategoryMap}
          categoryItemCounts={categoryItemCounts}
          selectedTags={selectedTags}
          onSelect={(category) => {
            // Handle category selection
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
      </div>

      {/* Filter dropdown */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9998 }}>
        <FilterDropdown
          isOpen={isFilterDropdownOpen}
          tags={availableTags}
          selectedTags={selectedTags}
          onTagToggle={handleTagToggle}
          onClose={() => setIsFilterDropdownOpen(false)}
        />
      </div>

      {/* Virtualized feed container */}
      <div
        style={{
          width: '100%',
          margin: '0 auto',
          height: 'calc(100vh - 50px)', // Account for bottom navigation bar
          boxSizing: 'border-box',
          padding: '1px', // Minimal padding
          overflow: 'hidden', // Ensure no horizontal scroll
          backgroundColor: '#D8D8DD',
        }}
      >
                {memoizedVirtuoso}
        
        {/* Menu items are now loaded completely at once */}
      </div>
    </>
  );
} 