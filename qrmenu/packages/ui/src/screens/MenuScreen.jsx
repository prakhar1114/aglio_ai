import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useCartStore } from '@qrmenu/core';
import { MasonryFeed } from '../components/MasonryFeed.jsx';
import { BottomBar } from '../components/BottomBar.jsx';
import { CartDrawer } from '../components/CartDrawer.jsx';
import { FilterSheet } from '../components/FilterSheet.jsx';
import { AIChatDrawer } from '../components/AIChatDrawer.jsx';
import { UpsellPopup } from '../components/UpsellPopup.jsx';

function MenuPage() {
  // UI State Management
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Cart state for upsell timing
  const [hasCartEverOpened, setHasCartEverOpened] = useState(false);
  const totalCount = useCartStore((state) => state.totalCount());
  
  // Filter state from store
  const currentFilters = useCartStore((state) => state.filters);
  const setFilters = useCartStore((state) => state.setFilters);

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
    setIsAIChatOpen(true);
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
    // TODO: Implement checkout flow
    setIsCartOpen(false);
  };

  const handleUpsellClose = () => {
    // Upsell popup manages its own visibility
    console.log('Upsell popup closed');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Main Content Area */}
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Main Feed */}
        <main className="flex-1">
          <MasonryFeed 
            filters={currentFilters}
          />
        </main>
      </div>

      {/* Bottom Navigation */}
      <BottomBar 
        onFiltersOpen={handleFiltersOpen}
        onAIChatOpen={handleAIChatOpen}
        onCartOpen={handleCartOpen}
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

      <AIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
      />

      <UpsellPopup
        isCartOpen={hasCartEverOpened}
        onClose={handleUpsellClose}
      />
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