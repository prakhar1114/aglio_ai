import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

export function FilterSheet({ isOpen, onClose, onApplyFilters, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    category: [],
    isVeg: false,
    priceRange: [0, 50],
    ...initialFilters
  });

  // Mock categories - in real app this would come from API
  const categories = [
    { id: 'pizza', name: 'Pizza', count: 12 },
    { id: 'burger', name: 'Burgers', count: 8 },
    { id: 'pasta', name: 'Pasta', count: 6 },
    { id: 'salad', name: 'Salads', count: 4 },
    { id: 'dessert', name: 'Desserts', count: 10 },
    { id: 'beverage', name: 'Beverages', count: 15 }
  ];

  const handleCategoryToggle = (categoryId) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category.includes(categoryId)
        ? prev.category.filter(id => id !== categoryId)
        : [...prev.category, categoryId]
    }));
  };

  const handlePriceChange = (value, index) => {
    setFilters(prev => ({
      ...prev,
      priceRange: prev.priceRange.map((price, i) => i === index ? parseInt(value) : price)
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters({
      category: [],
      isVeg: false,
      priceRange: [0, 50]
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.category.length > 0) count++;
    if (filters.isVeg) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 50) count++;
    return count;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl animate-slide-up max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {getActiveFiltersCount() > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {getActiveFiltersCount()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Categories */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryToggle(category.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    filters.category.includes(category.id)
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{category.name}</span>
                    {filters.category.includes(category.id) && (
                      <CheckIcon className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{category.count} items</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Preferences */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Dietary Preferences</h3>
            <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={filters.isVeg}
                onChange={(e) => setFilters(prev => ({ ...prev, isVeg: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <div>
                <span className="font-medium text-gray-900">Vegetarian Only</span>
                <p className="text-sm text-gray-500">Show only vegetarian items</p>
              </div>
            </label>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Price Range</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Min Price</label>
                  <input
                    type="number"
                    min="0"
                    max="49"
                    value={filters.priceRange[0]}
                    onChange={(e) => handlePriceChange(e.target.value, 0)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Max Price</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={filters.priceRange[1]}
                    onChange={(e) => handlePriceChange(e.target.value, 1)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 text-center">
                ${filters.priceRange[0]} - ${filters.priceRange[1]}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={handleClear}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 py-3 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 