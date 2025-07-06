import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useCartStore, setupConnection, useChatStore, handleWaiterRequest } from '@qrmenu/core';
import { MasonryFeed } from '../components/MasonryFeed.jsx';
import { BottomBar } from '../components/BottomBar.jsx';
import { CartDrawer } from '../components/CartDrawer.jsx';
import { FilterSheet } from '../components/FilterSheet.jsx';
import { AIChatDrawer } from '../components/AIChatDrawer.jsx';
import { UpsellPopup } from '../components/UpsellPopup.jsx';
import { MyOrdersDrawer } from '../components/MyOrdersDrawer.jsx';
import { InformationModal } from '../components/InformationModal.jsx';
import { ItemCustomisations } from '../components/ItemCustomisations.jsx';
import { NicknamePrompt } from '../components/NicknamePrompt.jsx';
import { PreviewScreen } from './PreviewScreen.jsx';

// Memoised version to avoid unnecessary re-renders when previewStack updates
const MemoisedMasonryFeed = React.memo(MasonryFeed);

function MenuPage() {
  const location = useLocation();
  
  // UI State Management
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);

  // Preview State Management - support for stacking previews
  const [previewStack, setPreviewStack] = useState([]);

  // Cart state for upsell timing
  const [hasCartEverOpened, setHasCartEverOpened] = useState(false);
  
  // Filter state from store
  const currentFilters = useCartStore((state) => state.filters);
  const setFilters = useCartStore((state) => state.setFilters);
  
  // Order state from store
  const addOrder = useCartStore((state) => state.addOrder);
  
  // AI Chat methods from store
  const openAIChatDrawer = useChatStore((state) => state.openDrawer);

  // Setup connection on component mount
  useEffect(() => {
    setupConnection(location);
  }, [location.search]);

  // Track when cart first opens for upsell popup
  useEffect(() => {
    if (isCartOpen && !hasCartEverOpened) {
      setHasCartEverOpened(true);
    }
  }, [isCartOpen, hasCartEverOpened]);

  // Handlers for bottom bar interactions
  const handleFiltersOpen = () => {
    setIsFiltersOpen(true);
  };

  const handleAIChatOpen = () => {
    openAIChatDrawer();
  };

  const handleCartOpen = () => {
    setIsCartOpen(true);
  };

  const handleApplyFilters = (filters) => {
    setFilters(filters);
    console.log('Applied filters:', filters);
    // Filters are passed to MasonryFeed for API calls
  };

  const handleUpsellClose = () => {
    // Upsell popup manages its own visibility
    console.log('Upsell popup closed');
  };

  const handleMyOrdersOpen = () => {
    setIsMyOrdersOpen(true);
  };

  const handleCallWaiterOpen = async () => {
    await handleWaiterRequest('call_waiter', 'Waiter Called', 'Your waiter has been notified and will be with you shortly.');
  };

  // Preview Screen Handlers
  const handleItemClick = useCallback((clickedItem, allCurrentItems) => {
    // Filter items by same category and ensure they have the 'kind' property
    const categoryItems = allCurrentItems
      .filter(item => item.category_brief === clickedItem.category_brief)
      .map(item => ({ ...item, kind: item.kind || 'food' })); // Ensure kind property is set
    
    console.log('Preview categoryItems:', {
      total: categoryItems.length,
      currentItem: clickedItem.name,
      category: clickedItem.category_brief,
      items: categoryItems.map(item => ({ id: item.id, name: item.name, kind: item.kind }))
    });
    
    // Find index of clicked item
    const currentIndex = categoryItems.findIndex(
      item => item.id === clickedItem.id
    );
    
    // Push new preview to stack
    const newPreview = {
      item: clickedItem,
      categoryItems,
      currentIndex,
      id: Date.now() // Unique ID for each preview
    };
    
    setPreviewStack(prev => [...prev, newPreview]);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewStack((prev) => {
      const newStack = [...prev];
      newStack.pop();
      return newStack;
    });
  }, []);

  const handleItemChange = useCallback((newIndex) => {
    setPreviewStack((prev) => {
      const newStack = [...prev];
      const topPreview = newStack[newStack.length - 1];
      if (topPreview) {
        const newItem = topPreview.categoryItems[newIndex];
        topPreview.item = { ...newItem, kind: newItem.kind || 'food' };
        topPreview.currentIndex = newIndex;
      }
      return newStack;
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Main Content Area */}
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Main Feed */}
        <main className="flex-1">
          <MemoisedMasonryFeed 
            filters={currentFilters}
            onItemClick={handleItemClick}
          />
        </main>
      </div>

      {/* Bottom Navigation */}
      <BottomBar 
        onFiltersOpen={handleFiltersOpen}
        onAIChatOpen={handleAIChatOpen}
        onCartOpen={handleCartOpen}
        onMyOrdersOpen={handleMyOrdersOpen}
        onCallWaiterOpen={handleCallWaiterOpen}
      />

      {/* Drawers and Popups */}
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      <FilterSheet
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={currentFilters}
      />

      <AIChatDrawer />

      {/* <UpsellPopup
        isCartOpen={hasCartEverOpened}
        onClose={handleUpsellClose}
      /> */}

      <MyOrdersDrawer
        isOpen={isMyOrdersOpen}
        onClose={() => setIsMyOrdersOpen(false)}
      />

      {/* Preview Screen Stack */}
      {previewStack.map((preview, index) => (
        <PreviewScreen
          key={preview.id}
          isOpen={true}
          item={preview.item}
          categoryItems={preview.categoryItems}
          currentIndex={preview.currentIndex}
          onClose={index === previewStack.length - 1 ? handlePreviewClose : null}
          onItemChange={index === previewStack.length - 1 ? handleItemChange : null}
          onItemClick={index === previewStack.length - 1 ? handleItemClick : null}
          zIndex={50 + index} // Stack them with increasing z-index
          isTopmost={index === previewStack.length - 1}
        />
      ))}

      {/* Global Information Modal */}
      <InformationModal />

      {/* Item Customisations Modal */}
      <ItemCustomisations />

      {/* Nickname Prompt */}
      <NicknamePrompt />
    </div>
  );
}

export function MenuScreen() {
  return (
    <Routes>
      <Route path="/*" element={<MenuPage />} />
    </Routes>
  );
} 