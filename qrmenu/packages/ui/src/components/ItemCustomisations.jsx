import React, { useState, useEffect } from 'react';
import { useCartStore, getMenuItem, confirmCustomisation } from '@qrmenu/core';

export function ItemCustomisations() {
  const {
    isCustomisationOpen,
    customisationMode,
    currentActiveItem,
    customisationData,
    updateCustomisationData,
    closeCustomisation
  } = useCartStore();

  const [menuItemDetails, setMenuItemDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load full menu item details when customisation opens
  useEffect(() => {
    if (isCustomisationOpen && currentActiveItem) {
      // console.log('ItemCustomisations: Modal opened with data:', {
      //   mode: customisationMode,
      //   menuItem: currentActiveItem.name,
      //   customisationData
      // });
      
      setLoading(true);
      getMenuItem(currentActiveItem.id)
        .then(details => {
          setMenuItemDetails(details);
          setLoading(false);
        })
        .catch(error => {
          console.error('Failed to load menu item details:', error);
          setLoading(false);
          // Fallback to current menu item data
          setMenuItemDetails(currentActiveItem);
        });
    }
  }, [isCustomisationOpen, customisationData]);

  if (!isCustomisationOpen || !currentActiveItem) {
    return null;
  }

  const handleVariationSelect = (variationId) => {
    updateCustomisationData({ selectedVariationId: variationId });
  };

  const handleAddonToggle = (addonId) => {
    const currentAddons = customisationData.selectedAddons || [];
    const existingAddon = currentAddons.find(addon => addon.addon_group_item_id === addonId);
    
    let newAddons;
    if (existingAddon) {
      // Remove addon
      newAddons = currentAddons.filter(addon => addon.addon_group_item_id !== addonId);
    } else {
      // Add addon with quantity 1
      newAddons = [...currentAddons, { addon_group_item_id: addonId, quantity: 1 }];
    }
    
    updateCustomisationData({ selectedAddons: newAddons });
  };

  const handleAddonQuantityChange = (addonId, quantity) => {
    const currentAddons = customisationData.selectedAddons || [];
    let newAddons;
    
    if (quantity <= 0) {
      // Remove addon if quantity is 0 or less
      newAddons = currentAddons.filter(addon => addon.addon_group_item_id !== addonId);
    } else {
      // Update or add addon
      const existingIndex = currentAddons.findIndex(addon => addon.addon_group_item_id === addonId);
      if (existingIndex >= 0) {
        newAddons = [...currentAddons];
        newAddons[existingIndex] = { addon_group_item_id: addonId, quantity };
      } else {
        newAddons = [...currentAddons, { addon_group_item_id: addonId, quantity }];
      }
    }
    
    updateCustomisationData({ selectedAddons: newAddons });
  };

  const handleQuantityChange = (qty) => {
    updateCustomisationData({ qty: Math.max(1, qty) });
  };

  const handleNoteChange = (note) => {
    updateCustomisationData({ note });
  };

  const isAddonSelected = (addonId) => {
    return customisationData.selectedAddons?.some(addon => addon.addon_group_item_id === addonId) || false;
  };

  const getAddonQuantity = (addonId) => {
    const addon = customisationData.selectedAddons?.find(addon => addon.addon_group_item_id === addonId);
    return addon?.quantity || 0;
  };

  const menuItem = menuItemDetails || currentActiveItem;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
                {customisationMode === 'add' ? 'Customize Item' : 'Edit Item'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                {menuItem.name}
              </p>
            </div>
            <button 
              onClick={closeCustomisation} 
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin border-t-blue-500"></div>
            <p className="mt-3 text-sm text-gray-600" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
              Loading options...
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <div className="px-4 py-4 space-y-6">
              
              {/* Quantity */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                  Quantity
                </h3>
                <div className="flex items-center justify-center">
                  <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200">
                    <button
                      onClick={() => handleQuantityChange(customisationData.qty - 1)}
                      disabled={customisationData.qty <= 1}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    
                    <div className="w-16 h-10 flex items-center justify-center bg-white border-x border-gray-200">
                      <span className="text-lg font-medium text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
                        {customisationData.qty}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleQuantityChange(customisationData.qty + 1)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-200 transition-colors rounded-r-lg"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Variations */}
              {menuItem.variation_groups?.map((variationGroup) => (
                <div key={variationGroup.group_name}>
                  <h3 className="text-sm font-medium text-gray-900 mb-3" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                    {variationGroup.display_name}
                  </h3>
                  <div className="space-y-2">
                    {variationGroup.variations.map((variation) => (
                      <label
                        key={variation.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          customisationData.selectedVariationId === variation.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name={`variation-${variationGroup.group_name}`}
                            checked={customisationData.selectedVariationId === variation.id}
                            onChange={() => handleVariationSelect(variation.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-1"
                          />
                          <span className="ml-3 text-sm text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                            {variation.display_name}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                          ₹{variation.price}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Addons */}
              {menuItem.addon_groups?.map((addonGroup) => (
                <div key={addonGroup.id}>
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                      {addonGroup.display_name}
                    </h3>
                    {(addonGroup.min_selection > 0 || addonGroup.max_selection > 0) && (
                      <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                        {addonGroup.min_selection > 0 && `Select at least ${addonGroup.min_selection}`}
                        {addonGroup.min_selection > 0 && addonGroup.max_selection > addonGroup.min_selection && ', '}
                        {addonGroup.max_selection > addonGroup.min_selection && `up to ${addonGroup.max_selection}`}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {addonGroup.addons.map((addon) => (
                      <div
                        key={addon.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isAddonSelected(addon.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={isAddonSelected(addon.id)}
                            onChange={() => handleAddonToggle(addon.id)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-1"
                          />
                          <div className="ml-3 flex-1">
                            <span className="text-sm text-gray-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                              {addon.display_name}
                            </span>
                            <span className="text-sm font-medium text-gray-900 ml-2" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                              ₹{addon.price}
                            </span>
                          </div>
                        </div>
                        
                        {isAddonSelected(addon.id) && (
                          <div className="flex items-center ml-3">
                            <div className="flex items-center bg-white rounded-md border border-gray-300">
                              <button
                                onClick={() => handleAddonQuantityChange(addon.id, getAddonQuantity(addon.id) - 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              <span className="w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-900 border-x border-gray-300" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                                {getAddonQuantity(addon.id)}
                              </span>
                              <button
                                onClick={() => handleAddonQuantityChange(addon.id, getAddonQuantity(addon.id) + 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                  Special Instructions
                </h3>
                <textarea
                  value={customisationData.note}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Any special requests..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  style={{ 
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                    minHeight: '80px'
                  }}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <button
              onClick={closeCustomisation}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={confirmCustomisation}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
            >
              {customisationMode === 'add' ? 'Add to Cart' : 'Update Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 