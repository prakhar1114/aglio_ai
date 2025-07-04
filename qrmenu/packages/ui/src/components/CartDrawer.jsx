import { useState, useEffect } from 'react';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, updateCartItem, deleteCartItem, replaceCartItem, getMenuItem, placeOrder } from '@qrmenu/core';
import { OptimizedMedia } from './OptimizedMedia.jsx';
import { OrderConfirmationSheet } from './OrderConfirmationSheet.jsx';

export function CartDrawer({ isOpen, onClose }) {
  const { items, getTotalAmount, getItemsByMember, canEditItem, hasCustomizationsAvailable, cartLocked, orderProcessingStatus, lockedByMember, isCartEditable, pendingOrderId, unlockCart } = useCartStore();
  const { memberPid, isHost, sessionValidated, members } = useSessionStore();
  const showModal = useSessionStore((state) => state.showModal);
  
  // Track which items have customizations available
  const [itemsWithCustomizations, setItemsWithCustomizations] = useState(new Set());
  
  // Order confirmation state (moved from MenuScreen)
  const [isOrderConfirmationOpen, setIsOrderConfirmationOpen] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  
  const isEmpty = items.length === 0;
  
  // Check for customizations availability when cart opens or items change
  useEffect(() => {
    if (!isOpen || isEmpty) return;
    
    const checkCustomizations = async () => {
      const uniqueMenuItemPids = [...new Set(items.map(item => item.menu_item_pid))];
      const customizationsPromises = uniqueMenuItemPids.map(async (menuItemPid) => {
        const hasCustomizations = await hasCustomizationsAvailable(menuItemPid);
        return { menuItemPid, hasCustomizations };
      });
      
      const results = await Promise.all(customizationsPromises);
      const newItemsWithCustomizations = new Set();
      
      results.forEach(({ menuItemPid, hasCustomizations }) => {
        if (hasCustomizations) {
          newItemsWithCustomizations.add(menuItemPid);
        }
      });
      
      setItemsWithCustomizations(newItemsWithCustomizations);
    };
    
    checkCustomizations();
  }, [isOpen, items, isEmpty]);
  
  // Function to play success sound
  const playSuccessSound = () => {
    try {
      // Create a simple success sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Success sound: quick rising tone
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play success sound:', error);
    }
  };
  
  // Handle order processing status changes (moved from MenuScreen)
  useEffect(() => {
    if (orderProcessingStatus === 'confirmed' && pendingOrderId) {
      // Get the latest order from cart store (it should have been added by handleOrderSuccess)
      const orders = useCartStore.getState().getOrders();
      const confirmedOrder = orders.find(order => order.id === pendingOrderId);
      
      if (confirmedOrder) {
        // Play success sound
        playSuccessSound();
        
        // Show success modal
        showModal({
          type: 'success',
          title: 'Order Placed!',
          message: 'Your order has been successfully placed. You can continue ordering more items or track your orders.',
          actions: [
            {
              label: 'Continue Ordering',
              variant: 'success',
            }
          ]
        });
        
        // // Set the order for confirmation sheet
        // setLastPlacedOrder(confirmedOrder);
        // setIsOrderConfirmationOpen(true);
        onClose();
        // Reset order processing status after showing confirmation
      }
    } else if (orderProcessingStatus === 'failed') {
      // Show error modal for failed orders
      showModal({
        type: 'error',
        title: 'Order Failed',
        message: 'There was an issue processing your order. Please try again.',
        actions: [
          {
            label: 'Retry',
            variant: 'danger',
          }
        ]
      });
    }
  }, [orderProcessingStatus, pendingOrderId, unlockCart, showModal]);
  
  const subtotal = getTotalAmount();
  const tax = 0; // Set to zero as requested
  const total = subtotal + tax;
  
  // Group items by member
  const itemsByMember = getItemsByMember();

  // Handle checkout - moved from MenuScreen
  const handleCheckout = (specialInstructions = '') => {
    console.log('Placing order via websocket:', { items, total });
    
    // Use websocket to place order instead of local creation
    placeOrder(specialInstructions);
    
    // Don't show confirmation yet - wait for websocket response
  };
  
  // Order confirmation handlers (moved from MenuScreen)
  const handleOrderConfirmationClose = () => {
    setIsOrderConfirmationOpen(false);
    setLastPlacedOrder(null);
  };

  const handleViewOrdersFromConfirmation = () => {
    setIsOrderConfirmationOpen(false);
    // You might want to emit an event or call a prop to open MyOrdersDrawer from parent
    // For now, just close the confirmation
  };

  const handleQtyChange = (item, newQty) => {
    if (!isCartEditable()) {
      console.warn('Cannot edit cart: order is being processed');
      return;
    }
    if (!canEditItem(item, memberPid, isHost)) {
      // Show error toast - you could integrate with a toast system here
      console.warn('You can only edit your own items');
      return;
    }
    updateCartItem(item.public_id, newQty, item.note, item.version);
  };

  const handleDelete = (item) => {
    if (!isCartEditable()) {
      console.warn('Cannot delete item: order is being processed');
      return;
    }
    if (!canEditItem(item, memberPid, isHost)) {
      console.warn('You can only delete your own items');
      return;
    }
    deleteCartItem(item.public_id, item.version);
  };

  const handleIncrease = (item) => {
    handleQtyChange(item, item.qty + 1);
  };

  const handleDecrease = (item) => {
    if (item.qty === 1) {
      handleDelete(item);
    } else {
      handleQtyChange(item, item.qty - 1);
    }
  };

  const handleEdit = async (item) => {
    if (!isCartEditable()) {
      console.warn('Cannot edit item: order is being processed');
      return;
    }
    if (!canEditItem(item, memberPid, isHost)) {
      console.warn('You can only edit your own items');
      return;
    }
    try {
      const menuItem = await getMenuItem(item.menu_item_pid);
      replaceCartItem(item.public_id, menuItem, item.qty, item.note || '', item.version);
    } catch (error) {
      console.error('Failed to open customisation modal:', error);
    }
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
            Shared Cart {!isEmpty && `(${items.length} items)`}
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
                Your shared cart is empty
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
              {/* Cart Items - Grouped by Member */}
              {Object.entries(itemsByMember).map(([member_pid, memberItems]) => {
                if (memberItems.length === 0) return null;
                
                const member = members.find(m => m.member_pid === member_pid);
                const canEdit = member_pid === memberPid || isHost;
                
                return (
                  <div key={member_pid} 
                       className="border border-gray-200 rounded-xl p-3"
                       style={{
                         borderColor: '#E5E7EB',
                         borderRadius: '16px',
                         backgroundColor: '#FAFBFC',
                         opacity: canEdit ? 1 : 0.90
                       }}>
                    
                    {/* Compact Member Label */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100"
                         style={{
                           borderBottomColor: 'rgba(229, 231, 235, 0.5)'
                         }}>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-900"
                              style={{
                                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1C1C1E'
                              }}>
                          {member?.nickname || 'Unknown Member'}
                        </span>
                        {member?.is_host && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#2563EB',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                                }}>
                            HOST
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500"
                            style={{
                              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                              fontSize: '11px'
                            }}>
                        {memberItems.length} item{memberItems.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {/* Member's Items */}
                    <div className="space-y-2">
                      {memberItems.map(item => (
                        <div key={item.public_id} 
                             className="bg-white rounded-lg p-3"
                             style={{
                               borderRadius: '12px',
                               boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                               border: '1px solid rgba(243, 244, 246, 0.8)',
                               transition: 'all 0.2s ease-in-out'
                             }}>
                          
                          <div className="flex items-center space-x-3">
                            {/* Compact Image */}
                            <div className="flex-shrink-0">
                              {item.image_url || item.cloudflare_image_id || item.cloudflare_video_id ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden"
                                     style={{
                                       borderRadius: '8px',
                                       backgroundColor: '#F3F4F6'
                                     }}>
                                  <OptimizedMedia
                                    imageUrl={item.image_url}
                                    cloudflareImageId={item.cloudflare_image_id}
                                    cloudflareVideoId={item.cloudflare_video_id}
                                    alt={item.name}
                                    containerWidth={48}
                                    containerHeight={48}
                                    enableHoverVideo={false} // Disable hover for thumbnails
                                    showThumbnailFirst={true}
                                    className="w-12 h-12 object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                                     style={{
                                       borderRadius: '8px',
                                       backgroundColor: '#F9FAFB',
                                       border: '1px solid rgba(229, 231, 235, 0.3)',
                                       width: '48px',
                                       height: '48px'
                                     }}>
                                  <div className="text-lg" role="img" aria-label="Food item">🍽️</div>
                                </div>
                              )}
                            </div>
                            
                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              {/* Item Name and Price in one line */}
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-medium text-gray-900 truncate flex-1"
                                    style={{
                                      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      color: '#1C1C1E',
                                      lineHeight: '1.3'
                                    }}>
                                  {item.name}
                                </h3>
                                <p className="font-semibold text-red-500 ml-2"
                                   style={{
                                     fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                     fontSize: '14px',
                                     fontWeight: '700',
                                     color: '#E23744'
                                   }}>
                                   {(() => {
                                     const unit = item.final_price ?? item.price ?? item.base_price ?? 0;
                                     return `₹${(unit * item.qty).toFixed(2)}`;
                                   })()}
                                </p>
                              </div>
                              
                              {/* Note */}
                              {item.note && (
                                <p className="text-xs text-gray-500 mb-2 truncate"
                                   style={{
                                     fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
                                     fontSize: '11px',
                                     fontStyle: 'italic'
                                   }}>
                                   {item.note}
                                 </p>
                               )}
                              
                              {/* Quantity Controls and Edit Button */}
                              <div className="flex items-center justify-between">
                                {canEdit ? (
                                  <div className={`flex items-center bg-gray-50 rounded-full border ${!isCartEditable() ? 'opacity-50' : ''}`}
                                       style={{
                                         borderRadius: '20px',
                                         border: '1px solid #E5E7EB',
                                         backgroundColor: '#F9FAFB'
                                       }}>
                                    <button
                                      onClick={() => handleDecrease(item)}
                                      disabled={!isCartEditable()}
                                      className={`p-1.5 rounded-full transition-colors ${isCartEditable() ? 'hover:bg-gray-100' : 'cursor-not-allowed'}`}
                                      style={{
                                        borderRadius: '16px',
                                        width: '28px',
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {item.qty === 1 ? (
                                        <TrashIcon className="w-3 h-3 text-red-500" />
                                      ) : (
                                        <MinusIcon className="w-3 h-3 text-gray-600" />
                                      )}
                                    </button>
                                    
                                    <span className="px-2 text-sm font-medium text-gray-900"
                                          style={{
                                            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            minWidth: '24px',
                                            textAlign: 'center'
                                          }}>
                                      {item.qty}
                                    </span>
                                    
                                    <button
                                      onClick={() => handleIncrease(item)}
                                      disabled={!isCartEditable()}
                                      className={`p-1.5 rounded-full transition-colors ${isCartEditable() ? 'hover:bg-gray-100' : 'cursor-not-allowed'}`}
                                      style={{
                                        borderRadius: '16px',
                                        width: '28px',
                                        height: '28px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <PlusIcon className="w-3 h-3 text-gray-600" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full"
                                        style={{
                                          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
                                          fontSize: '11px',
                                          borderRadius: '16px',
                                          backgroundColor: '#F3F4F6'
                                        }}>
                                    Qty: {item.qty}
                                  </span>
                                )}
                                
                                {/* Edit Button - Bottom Right */}
                                {( itemsWithCustomizations.has(item.menu_item_pid)) && canEditItem(item, memberPid, isHost) && (
                                  <button
                                    onClick={() => handleEdit(item)}
                                    disabled={!isCartEditable()}
                                    className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                                      isCartEditable() 
                                        ? 'text-blue-600 hover:bg-blue-50' 
                                        : 'text-gray-400 cursor-not-allowed'
                                    }`}
                                    style={{
                                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      borderRadius: '6px'
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Order Summary & Checkout */}
        {!isEmpty && (
          <div className="border-t bg-gray-50 p-4 space-y-3"
               style={{
                 backgroundColor: 'rgba(250, 251, 252, 0.95)',
                 backdropFilter: 'blur(8px)',
                 WebkitBackdropFilter: 'blur(8px)',
                 borderTop: '1px solid #F3F4F6'
               }}>
            
            {/* Order Summary */}
            <div className="space-y-1 text-sm">
              {/*
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
              */}
              
              <div className="flex justify-between font-semibold text-lg pt-1 border-t border-gray-200">
                <span style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1C1C1E'
                }}>
                  Total
                </span>
                <span style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#E23744'
                }}>
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            {cartLocked && lockedByMember && lockedByMember !== memberPid ? (
              // Show locked by other member state
              <div className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-medium text-center"
                   style={{
                     backgroundColor: '#D1D5DB',
                     fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                     fontSize: '16px',
                     fontWeight: '600',
                     borderRadius: '12px',
                     color: '#6B7280'
                   }}>
                {(() => {
                  const lockingMember = members.find(m => m.member_pid === lockedByMember);
                  return `Order Submitted by ${lockingMember?.nickname || 'Another Member'}`;
                })()}
              </div>
            ) : (
            <button
              onClick={() => handleCheckout()}
                disabled={orderProcessingStatus === 'processing'}
                className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
                  orderProcessingStatus === 'processing'
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : orderProcessingStatus === 'failed'
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              style={{
                  backgroundColor: orderProcessingStatus === 'processing' 
                    ? '#9CA3AF' 
                    : orderProcessingStatus === 'failed'
                    ? '#F97316'
                    : '#E23744',
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                  boxShadow: orderProcessingStatus === 'processing' 
                    ? 'none' 
                    : '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease-in-out',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                  if (orderProcessingStatus !== 'processing') {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
                  }
              }}
              onMouseLeave={(e) => {
                  if (orderProcessingStatus !== 'processing') {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)';
                  }
              }}
            >
                {orderProcessingStatus === 'processing' 
                  ? 'Pending Confirmation...' 
                  : orderProcessingStatus === 'failed'
                  ? 'Retry Order'
                  : 'Place Order'}
            </button>
            )}
          </div>
        )}
      </div>
      
      {/* Order Confirmation Sheet */}
      <OrderConfirmationSheet
        isOpen={isOrderConfirmationOpen}
        onClose={handleOrderConfirmationClose}
        onViewOrders={handleViewOrdersFromConfirmation}
        placedOrder={lastPlacedOrder}
      />
    </>
  );
} 