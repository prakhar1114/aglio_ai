import React, { useState, useEffect } from 'react';
import { useCartStore, getMenuItem, confirmCustomisation, constructImageUrl, getActiveAddonGroups } from '@qrmenu/core';

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
      setLoading(true);
      getMenuItem(currentActiveItem.id)
        .then(details => {
          setMenuItemDetails(details);
          setLoading(false);
        })
        .catch(error => {
          console.error('Failed to load menu item details:', error);
          setLoading(false);
          setMenuItemDetails(currentActiveItem);
        });
    }
  }, [isCustomisationOpen, customisationData]);

  const menuItem = menuItemDetails || currentActiveItem;

  // Compute pricing (hooks need consistent order, so declare before any early return)
  const selectedVariation = React.useMemo(() => {
    if (!menuItem || !customisationData.selectedVariationId) return null;
    let found = null; 
    menuItem.variation_groups?.forEach(vg => {
      const v = vg.variations.find(varn => varn.id === customisationData.selectedVariationId);
      if (v) found = v;
    });
    return found;
  }, [menuItem, customisationData.selectedVariationId]);

  const addonsPrice = React.useMemo(() => {
    if (!menuItem || !customisationData.selectedAddons) return 0;
    const activeGroups = getActiveAddonGroups(menuItem, customisationData.selectedVariationId);
    let total = 0;
    customisationData.selectedAddons.forEach(sel => {
      activeGroups.forEach(group => {
        const addon = group.addons.find(a => a.id === sel.addon_group_item_id);
        if (addon) {
          total += addon.price * (sel.quantity || 1);
        }
      });
    });
    return total;
  }, [menuItem, customisationData.selectedAddons, customisationData.selectedVariationId]);

  const unitPrice = (selectedVariation?.price || menuItem?.base_price || 0) + addonsPrice;
  const totalPrice = unitPrice * (customisationData.qty || 1);

  if (!isCustomisationOpen || !currentActiveItem) {
    return null;
  }

  const handleVariationSelect = (variationId) => {
    // When the user switches variation, drop any previously selected addons that
    // don’t belong to the addon groups enabled for the new variation.
    const activeGroupsAfterSwitch = getActiveAddonGroups(menuItem, variationId);
    const allowedAddonIds = activeGroupsAfterSwitch.flatMap((g) => g.addons.map((a) => a.id));

    const cleansedAddons = (customisationData.selectedAddons || []).filter((addon) =>
      allowedAddonIds.includes(addon.addon_group_item_id)
    );

    updateCustomisationData({
      selectedVariationId: variationId,
      selectedAddons: cleansedAddons,
    });
  };

  const handleAddonToggle = (addonId) => {
    // First, keep only addons that belong to the current active addon groups
    const activeGroups = getActiveAddonGroups(menuItem, customisationData.selectedVariationId);
    const allowedAddonIds = activeGroups.flatMap((g) => g.addons.map((a) => a.id));

    const currentAddons = (customisationData.selectedAddons || []).filter((addon) =>
      allowedAddonIds.includes(addon.addon_group_item_id)
    );

    const existingAddon = currentAddons.find(
      (addon) => addon.addon_group_item_id === addonId
    );

    let newAddons;
    if (existingAddon) {
      newAddons = currentAddons.filter(
        (addon) => addon.addon_group_item_id !== addonId
      );
    } else {
      newAddons = [...currentAddons, { addon_group_item_id: addonId, quantity: 1 }];
    }

    updateCustomisationData({ selectedAddons: newAddons });
  };

  const handleAddonQuantityChange = (addonId, quantity) => {
    const currentAddons = customisationData.selectedAddons || [];
    let newAddons;
    
    if (quantity <= 0) {
      newAddons = currentAddons.filter(addon => addon.addon_group_item_id !== addonId);
    } else {
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

  // Get item image URL
  const getItemImageUrl = () => {
    if (!menuItem) return null;
    if (menuItem.cloudflare_image_id) {
      return constructImageUrl(menuItem.cloudflare_image_id, 'w=800,h=600,fit=cover,q=85');
    }
    return menuItem.image_url || null;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end z-50">
      <div className="bg-white w-full overflow-hidden shadow-2xl flex flex-col" style={{ 
        borderRadius: '20px 20px 0 0',
        maxHeight: 'min(85vh, calc(100vh - 80px))'
      }}>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-gray-200 rounded-full animate-spin border-t-red-500"></div>
            <p className="mt-3 text-gray-600 font-medium text-sm">Loading options...</p>
          </div>
        ) : (
          <>
            {/* Compact Header */}
            <div className="bg-white border-b border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-4">
                  <h1 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                    {menuItem.name}
                  </h1>
                  {menuItem.description && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {menuItem.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={closeCustomisation}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-gray-200 active:scale-95 flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Inline Price and Quantity */}
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-gray-50 rounded-full px-3 py-1.5">
                  {unitPrice !== menuItem.base_price ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 line-through">₹{menuItem.base_price}</span>
                      <span className="text-sm font-bold text-gray-900">₹{unitPrice}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-gray-900">₹{menuItem.base_price}</span>
                  )}
                </div>
                
                {/* Inline Quantity Selector */}
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700 mr-3">Qty:</span>
                  <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                    <button
                      onClick={() => handleQuantityChange(customisationData.qty - 1)}
                      disabled={customisationData.qty <= 1}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                    >
                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <div className="w-10 h-8 flex items-center justify-center border-x border-gray-200 bg-white">
                      <span className="text-sm font-bold text-gray-900">{customisationData.qty}</span>
                    </div>
                    <button
                      onClick={() => handleQuantityChange(customisationData.qty + 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors rounded-r-lg"
                    >
                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Content Sections */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              
              {/* Variations - Compact Cards */}
              {menuItem.variation_groups?.map((variationGroup) => (
                <div key={variationGroup.group_name} className="bg-gray-50 rounded-xl p-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    {variationGroup.display_name}
                  </h3>
                  <div className="space-y-2">
                    {variationGroup.variations.map((variation) => (
                      <label
                        key={variation.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                          customisationData.selectedVariationId === variation.id
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-white border border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name={`variation-${variationGroup.group_name}`}
                            checked={customisationData.selectedVariationId === variation.id}
                            onChange={() => handleVariationSelect(variation.id)}
                            className="w-4 h-4 mr-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium">
                            {variation.display_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold">
                          ₹{variation.price}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Addons - Compact with Inline Controls (variation override aware) */}
              {getActiveAddonGroups(menuItem, customisationData.selectedVariationId)?.map((addonGroup) => (
                <div key={addonGroup.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {addonGroup.display_name}
                    </h3>
                    {(addonGroup.min_selection > 0 || addonGroup.max_selection > 0) && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {addonGroup.min_selection > 0 && `Min ${addonGroup.min_selection}`}
                        {addonGroup.min_selection > 0 && addonGroup.max_selection > addonGroup.min_selection && ', '}
                        {addonGroup.max_selection > addonGroup.min_selection && `Max ${addonGroup.max_selection}`}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {addonGroup.addons.map((addon) => (
                      <div
                        key={addon.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 ${
                          isAddonSelected(addon.id)
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center flex-1">
                          <input
                            type="checkbox"
                            checked={isAddonSelected(addon.id)}
                            onChange={() => handleAddonToggle(addon.id)}
                            className="w-4 h-4 mr-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">
                                {addon.display_name}
                              </span>
                              <span className="text-sm font-bold ml-2">
                                ₹{addon.price}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Inline Quantity Controls */}
                        {isAddonSelected(addon.id) && (
                          <div className="flex items-center ml-3">
                            <div className="flex items-center bg-white/20 rounded-md">
                              <button
                                onClick={() => handleAddonQuantityChange(addon.id, getAddonQuantity(addon.id) - 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/20 transition-colors rounded-l-md"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                              <span className="w-6 h-6 flex items-center justify-center text-xs font-bold">
                                {getAddonQuantity(addon.id)}
                              </span>
                              <button
                                onClick={() => handleAddonQuantityChange(addon.id, getAddonQuantity(addon.id) + 1)}
                                className="w-6 h-6 flex items-center justify-center hover:bg-white/20 transition-colors rounded-r-md"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              {/* Compact Notes */}
              <div className="bg-gray-50 rounded-xl p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Special Instructions
                </h3>
                <textarea
                  value={customisationData.note}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Any special requests..."
                  className="w-full p-2.5 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  rows={2}
                />
              </div>
            </div>

            {/* Compact Footer */}
            <div className="bg-white border-t border-gray-100 p-4">
              {/* Inline Price Summary */}
              <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">
                  ₹{unitPrice} × {customisationData.qty}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  ₹{totalPrice}
                </span>
              </div>
              
              {/* Compact Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={closeCustomisation}
                  className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200 active:scale-95 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCustomisation}
                  disabled={loading}
                  className="flex-2 py-2.5 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-lg text-sm"
                  style={{ minWidth: '60%' }}
                >
                  {customisationMode === 'add' ? 'Add to Cart' : 'Update Item'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 