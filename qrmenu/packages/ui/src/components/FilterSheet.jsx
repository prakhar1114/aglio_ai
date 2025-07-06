import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useCategories } from '@qrmenu/core';
import { useCartStore } from '@qrmenu/core';
import React from 'react';

export function FilterSheet({ isOpen, onClose, onApplyFilters, initialFilters = {} }) {
  // Get store filters and setters
  const storeFilters = useCartStore((state) => state.filters);
  const setStoreFilters = useCartStore((state) => state.setFilters);
  const clearStoreFilters = useCartStore((state) => state.clearFilters);
  
  const [filters, setFilters] = useState({
    category: [],
    isVeg: false,
    priceRange: [0, 1000],
    priceEnabled: false,
    ...initialFilters
  });

  // Initialize filters from store when modal opens
  const [hasInitialized, setHasInitialized] = React.useState(false);
  
  if (isOpen && !hasInitialized) {
    setFilters({
      category: [],
      isVeg: false,
      priceRange: [0, 1000],
      priceEnabled: false,
      ...storeFilters
    });
    setHasInitialized(true);
  }
  
  if (!isOpen && hasInitialized) {
    setHasInitialized(false);
  }

  // Fetch categories from API
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useCategories();

  // Process categories data to group by group_category and sum counts
  const categories = React.useMemo(() => {
    if (!categoriesData) return [];
    
    const groupedCategories = {};
    
    categoriesData.forEach(item => {
      const groupCategory = item.group_category;
      if (!groupedCategories[groupCategory]) {
        groupedCategories[groupCategory] = {
          id: groupCategory,
          name: groupCategory,
          count: 0,
          veg_count: 0
        };
      }
      groupedCategories[groupCategory].count += item.total_count;
      groupedCategories[groupCategory].veg_count += item.veg_count;
    });
    
    return Object.values(groupedCategories);
  }, [categoriesData]);

  const handleCategoryToggle = (categoryId) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category.includes(categoryId)
        ? prev.category.filter(id => id !== categoryId)
        : [...prev.category, categoryId]
    }));
  };

  const handlePriceChange = (value) => {
    setFilters(prev => ({
      ...prev,
      priceRange: [0, parseInt(value)] // Only upper bound, lower bound always 0
    }));
  };

  const handleApply = () => {
    // Update store directly
    setStoreFilters(filters);
    onApplyFilters(filters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      category: [],
      isVeg: false,
      priceRange: [0, 1000],
      priceEnabled: false
    };
    
    // Update both local state and store
    setFilters(clearedFilters);
    clearStoreFilters();
    onApplyFilters(clearedFilters);
    onClose();
  };

  // Use store-based filter count for consistency
  const getFilterCount = useCartStore((state) => state.getFilterCount);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => {
          // Reset local state to store state when closing without applying
          setFilters({
            category: [],
            isVeg: false,
            priceRange: [0, 1000],
            priceEnabled: false,
            ...storeFilters
          });
          onClose();
        }}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl animate-slide-up max-h-[80vh] flex flex-col">
        <style>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #ef4444;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #ef4444;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
        `}</style>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {getFilterCount() > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {getFilterCount()}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              // Reset local state to store state when closing without applying
              setFilters({
                category: [],
                isVeg: false,
                priceRange: [0, 1000],
                priceEnabled: false,
                ...storeFilters
              });
              onClose();
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Categories */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categoriesLoading ? (
                <div className="text-sm text-gray-500">Loading categories...</div>
              ) : categoriesError ? (
                <div className="text-sm text-red-500">Error loading categories</div>
              ) : categories.length === 0 ? (
                <div className="text-sm text-gray-500">No categories available</div>
              ) : (
                categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryToggle(category.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 transform active:scale-95 shadow-sm ${
                      filters.category.includes(category.id)
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name} ({filters.isVeg ? category.veg_count : category.count})
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Dietary Preferences */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Dietary Preferences</h3>
            <button
              onClick={() => setFilters(prev => ({ ...prev, isVeg: !prev.isVeg }))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.isVeg
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Veg Only
            </button>
          </div>

          {/* Price Range */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.priceEnabled}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceEnabled: e.target.checked }))}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <h3 className="font-medium text-gray-900">Max Price</h3>
              </label>
              {filters.priceEnabled && (
                <span className="text-sm font-medium text-gray-700">₹{filters.priceRange[1]}</span>
              )}
            </div>
            {filters.priceEnabled && (
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={filters.priceRange[1]}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${((filters.priceRange[1] - 200) / (2000 - 200)) * 100}%, #e5e7eb ${((filters.priceRange[1] - 200) / (2000 - 200)) * 100}%, #e5e7eb 100%)`
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={handleClear}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:scale-95 active:bg-gray-100 transition-all duration-150 ease-in-out"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-2.5 px-4 bg-[#C72C48] text-white rounded-lg hover:bg-[#A9253D] transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 