import { useState } from 'react';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@qrmenu/core';

export function CartDrawer({ isOpen, onClose, onCheckout }) {
  const { items, addItem, removeItem, clear } = useCartStore();
  
  const cartItems = Object.values(items);
  const isEmpty = cartItems.length === 0;
  
  const subtotal = cartItems.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  const handleItemIncrease = (item) => {
    addItem(item);
  };

  const handleItemDecrease = (item) => {
    removeItem(item);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl animate-slide-up max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Cart {!isEmpty && `(${cartItems.length})`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-500 mb-4">Add some delicious items to get started!</p>
              <button 
                onClick={onClose}
                className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {cartItems.map(({ item, qty }) => (
                <div key={item.id} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                  <img
                    src={item.image_url || '/placeholder.png'}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleItemDecrease(item)}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      {qty === 1 ? (
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      ) : (
                        <MinusIcon className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    
                    <span className="w-8 text-center font-medium">{qty}</span>
                    
                    <button
                      onClick={() => handleItemIncrease(item)}
                      className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${(item.price * qty).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Clear Cart Button */}
              <button
                onClick={clear}
                className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
              >
                Clear Cart
              </button>
            </div>
          )}
        </div>

        {/* Footer - Order Summary & Checkout */}
        {!isEmpty && (
          <div className="border-t bg-gray-50 p-4 space-y-3">
            {/* Order Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-900">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => onCheckout?.(cartItems, total)}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
} 