import React from 'react';
import { setRestaurantData, QueryProvider } from '@qrmenu/core';
import { MenuPage, ThemeProvider } from '@qrmenu/ui';
import { loadTheme } from '@qrmenu/theme-loader';

export function MenuScreenPreview({ 
  restaurantName, 
  restaurantSlug, 
  enableCallWaiter = false,
  showToWaiter = true,
  message = "Please go to the counter to make the payment and confirm.",
  enablePlaceOrder = false,
  showAskNameModal = false,
  enableNavigationOverlay = true,
  enableImageGalleryFeed = false,
  enableBottombarCategoryDropdown = true,
  onClose
}) {
  const [theme, setTheme] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Set global restaurant data
    console.log('Setting restaurant data:', { restaurantSlug, restaurantName });
    setRestaurantData(restaurantSlug, restaurantName);
    
    // Load theme
    loadTheme()
      .then(loadedTheme => {
        setTheme(loadedTheme);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load theme:', error);
        setLoading(false);
      });
  }, [restaurantSlug, restaurantName]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu preview...</p>
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load theme</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Menu Preview - {restaurantName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* MenuScreen */}
        <div className="flex-1 overflow-hidden">
          <QueryProvider>
            <ThemeProvider theme={theme}>
                          <MenuPage 
              enableCallWaiter={enableCallWaiter}
              showToWaiter={showToWaiter}
              message={message}
              enablePlaceOrder={enablePlaceOrder}
              showAskNameModal={showAskNameModal}
              enableNavigationOverlay={enableNavigationOverlay}
              enableImageGalleryFeed={enableImageGalleryFeed}
              enableBottombarCategoryDropdown={enableBottombarCategoryDropdown}
              
              showAggregatedCategory={true}
              enableBottombarFilters={false}

            />
            </ThemeProvider>
          </QueryProvider>
        </div>
      </div>
    </div>
  );
} 