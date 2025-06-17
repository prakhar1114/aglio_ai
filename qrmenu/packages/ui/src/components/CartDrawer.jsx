import { useState } from 'react';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@qrmenu/core';

export function CartDrawer({ isOpen, onClose, onCheckout }) {
  const { items, addItem, removeItem, clear } = useCartStore();
  
  const cartItems = Object.values(items);
  const isEmpty = cartItems.length === 0;
  
  const subtotal = cartItems.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const tax = 0; // Set to zero as requested
  const total = subtotal + tax;

  const handleItemIncrease = (item) => {
    addItem(item);
  };

  const handleItemDecrease = (item) => {
    removeItem(item);
  };

  // Helper function to check if URL is a video
  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
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
      <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl animate-slide-up max-h-[85vh] flex flex-col"
           style={{
             boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
           }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100"
             style={{
               backgroundColor: 'rgba(250, 251, 252, 0.95)',
               backdropFilter: 'blur(8px)',
               WebkitBackdropFilter: 'blur(8px)'
             }}>
          <h2 className="text-lg font-semibold text-gray-900"
              style={{
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                color: '#1C1C1E'
              }}>
            Your Cart {!isEmpty && `(${cartItems.length})`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
            style={{
              borderRadius: '8px',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto drawer-scroll">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <div className="text-6xl mb-4" role="img" aria-label="Empty cart">🛒</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: '#1C1C1E'
                  }}>
                Your cart is empty
              </h3>
              <p className="text-gray-500 mb-6"
                 style={{
                   fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                   fontSize: '14px'
                 }}>
                Add some delicious items to get started!
              </p>
              <button 
                onClick={onClose}
                className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-all duration-200"
                style={{
                  backgroundColor: '#E23744',
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontWeight: '600',
                  fontSize: '14px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
                  transform: 'translateY(0)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)';
                }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {cartItems.map(({ item, qty }) => (
                <div key={item.id} 
                     className="bg-white rounded-lg p-3 border border-gray-100"
                     style={{
                       borderRadius: '12px',
                       boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
                       border: '1px solid #F3F4F6',
                       transition: 'all 0.2s ease-in-out'
                     }}>
                  
                  <div className="flex items-start space-x-3">
                    {/* Image/Video/Placeholder */}
                    <div className="flex-shrink-0">
                      {item.image_url ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden"
                             style={{
                               borderRadius: '8px',
                               backgroundColor: '#F3F4F6'
                             }}>
                          {isVideoUrl(item.image_url) ? (
                            <video
                              src={item.image_url}
                              className="w-16 h-16 object-cover"
                              autoPlay
                              loop
                              muted={true}
                              playsInline
                              controls={false}
                              style={{
                                objectFit: 'cover',
                                width: '64px',
                                height: '64px'
                              }}
                            />
                          ) : (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-16 object-cover"
                              loading="lazy"
                              style={{
                                objectFit: 'cover',
                                width: '64px',
                                height: '64px'
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        // No image placeholder with consistent styling
                        <div className="w-16 h-16 rounded-lg flex items-center justify-center"
                             style={{
                               borderRadius: '8px',
                               background: 'linear-gradient(135deg, rgba(250, 251, 252, 0.8) 0%, rgba(247, 249, 252, 0.6) 100%)',
                               backdropFilter: 'blur(8px)',
                               WebkitBackdropFilter: 'blur(8px)',
                               border: '1px solid rgba(229, 231, 235, 0.3)',
                               width: '64px',
                               height: '64px'
                             }}>
                          <div className="text-2xl" role="img" aria-label="Food item">🍽️</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Item Details - Full width layout */}
                    <div className="flex-1 min-w-0">
                      {/* Item Name - Full line */}
                      <h3 className="font-medium text-gray-900 mb-2"
                          style={{
                            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#1C1C1E',
                            lineHeight: '1.3',
                            marginBottom: '8px'
                          }}>
                        {item.name}
                      </h3>
                      
                      {/* Quantity Controls and Price Row */}
                      <div className="flex items-center justify-between">
                        {/* Compact Quantity Stepper */}
                        <div className="flex items-center"
                             style={{
                               display: 'flex',
                               alignItems: 'center',
                               background: '#FFFFFF',
                               borderRadius: '16px',
                               border: '1px solid #E5E7EB',
                               boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
                               overflow: 'hidden',
                               fontSize: '12px'
                             }}>
                          <button
                            onClick={() => handleItemDecrease(item)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: '#1C1C1E',
                              fontWeight: '600',
                              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                              transition: 'all 0.15s ease-in-out'
                            }}
                          >
                            {qty === 1 ? (
                              <TrashIcon className="w-3 h-3 text-red-500" />
                            ) : (
                              '−'
                            )}
                          </button>
                          
                          <span style={{
                            padding: '0 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#1C1C1E',
                            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            minWidth: '20px',
                            textAlign: 'center'
                          }}>
                            {qty}
                          </span>
                          
                          <button
                            onClick={() => handleItemIncrease(item)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: '#1C1C1E',
                              fontWeight: '600',
                              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                              transition: 'all 0.15s ease-in-out'
                            }}
                          >
                            +
                          </button>
                        </div>

                        {/* Item Total Price */}
                        <div className="text-right">
                          <p className="font-semibold"
                             style={{
                               fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                               fontSize: '15px',
                               fontWeight: '700',
                               color: '#E23744'
                             }}>
                            ₹{(item.price * qty).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Clear Cart Button */}
              <button
                onClick={clear}
                className="w-full py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm"
                style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#E23744',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Clear Cart
              </button>
            </div>
          )}
        </div>

        {/* Footer - Order Summary & Checkout */}
        {!isEmpty && (
          <div className="border-t bg-gray-50 p-4 space-y-4"
               style={{
                 backgroundColor: 'rgba(250, 251, 252, 0.95)',
                 backdropFilter: 'blur(8px)',
                 WebkitBackdropFilter: 'blur(8px)',
                 borderTop: '1px solid #F3F4F6'
               }}>
            
            {/* Order Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '14px',
                        color: '#6B7280'
                      }}>
                  Subtotal
                </span>
                <span className="text-gray-900"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1C1C1E'
                      }}>
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '14px',
                        color: '#6B7280'
                      }}>
                  Tax
                </span>
                <span className="text-gray-900"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1C1C1E'
                      }}>
                  ₹{tax.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-200">
                <span style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1C1C1E'
                }}>
                  Total
                </span>
                <span style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#E23744'
                }}>
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => onCheckout?.(cartItems, total)}
              className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-all duration-200"
              style={{
                backgroundColor: '#E23744',
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease-in-out',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)';
              }}
            >
              Ready to Order
            </button>
          </div>
        )}
      </div>
    </>
  );
} 