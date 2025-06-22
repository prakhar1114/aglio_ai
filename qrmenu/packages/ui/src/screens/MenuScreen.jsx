import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useCartStore, setupConnection } from '@qrmenu/core';
import { MasonryFeed } from '../components/MasonryFeed.jsx';
import { BottomBar } from '../components/BottomBar.jsx';
import { CartDrawer } from '../components/CartDrawer.jsx';
import { FilterSheet } from '../components/FilterSheet.jsx';
import { AIChatDrawer } from '../components/AIChatDrawer.jsx';
import { UpsellPopup } from '../components/UpsellPopup.jsx';
import { OrderConfirmationSheet } from '../components/OrderConfirmationSheet.jsx';
import { MyOrdersDrawer } from '../components/MyOrdersDrawer.jsx';
import { InformationModal } from '../components/InformationModal.jsx';
import { PreviewScreen } from './PreviewScreen.jsx';

function MenuPage() {
  const location = useLocation();
  
  // UI State Management
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isOrderConfirmationOpen, setIsOrderConfirmationOpen] = useState(false);
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);

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
  const openAIChatDrawer = useCartStore((state) => state.openAIChatDrawer);

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

  const handleCheckout = (cartItems, total) => {
    console.log('Proceeding to checkout:', { cartItems, total });
    
    // Create order and clear cart
    const newOrder = addOrder();
    setLastPlacedOrder(newOrder);
    
    // Close cart and show confirmation
    setIsCartOpen(false);
    setIsOrderConfirmationOpen(true);
  };

  const handleUpsellClose = () => {
    // Upsell popup manages its own visibility
    console.log('Upsell popup closed');
  };

  const handleMyOrdersOpen = () => {
    setIsMyOrdersOpen(true);
  };

  const handleOrderConfirmationClose = () => {
    setIsOrderConfirmationOpen(false);
    setLastPlacedOrder(null);
  };

  const handleViewOrdersFromConfirmation = () => {
    setIsOrderConfirmationOpen(false);
    setIsMyOrdersOpen(true);
  };

  // Preview Screen Handlers
  const handleItemClick = (clickedItem, allCurrentItems) => {
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
  };

  const handlePreviewClose = () => {
    setPreviewStack(prev => {
      const newStack = [...prev];
      newStack.pop(); // Remove the top preview
      return newStack;
    });
  };

  const handleItemChange = (newIndex) => {
    setPreviewStack(prev => {
      const newStack = [...prev];
      const topPreview = newStack[newStack.length - 1];
      if (topPreview) {
        const newItem = topPreview.categoryItems[newIndex];
        topPreview.item = { ...newItem, kind: newItem.kind || 'food' }; // Ensure kind property
        topPreview.currentIndex = newIndex;
        
        console.log('Item changed to:', {
          index: newIndex,
          item: topPreview.item.name,
          kind: topPreview.item.kind
        });
      }
      return newStack;
    });
  };



  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Main Content Area */}
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Main Feed */}
        <main className="flex-1">
          <MasonryFeed 
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
      />

      {/* Drawers and Popups */}
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />

      <FilterSheet
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApplyFilters={handleApplyFilters}
        initialFilters={currentFilters}
      />

      <AIChatDrawer />

      <UpsellPopup
        isCartOpen={hasCartEverOpened}
        onClose={handleUpsellClose}
      />

      <OrderConfirmationSheet
        isOpen={isOrderConfirmationOpen}
        onClose={handleOrderConfirmationClose}
        onViewOrders={handleViewOrdersFromConfirmation}
        placedOrder={lastPlacedOrder}
      />

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
          onClose={handlePreviewClose}
          onItemChange={index === previewStack.length - 1 ? handleItemChange : null}
          onItemClick={index === previewStack.length - 1 ? handleItemClick : null}
          zIndex={50 + index} // Stack them with increasing z-index
          isTopmost={index === previewStack.length - 1}
        />
      ))}

      {/* Global Information Modal */}
      <InformationModal />
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