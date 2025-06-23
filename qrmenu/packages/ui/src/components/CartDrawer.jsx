import { useState } from 'react';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, updateCartItem, deleteCartItem } from '@qrmenu/core';

export function CartDrawer({ isOpen, onClose, onCheckout }) {
  const { items, members, getTotalAmount, getItemsByMember, canEditItem } = useCartStore();
  const { memberPid, isHost, sessionValidated } = useSessionStore();
  
  const isEmpty = items.length === 0;
  const subtotal = getTotalAmount();
  const tax = 0; // Set to zero as requested
  const total = subtotal + tax;
  
  // Group items by member
  const itemsByMember = getItemsByMember();

  const handleQtyChange = (item, newQty) => {
    if (!canEditItem(item, memberPid, isHost)) {
      // Show error toast - you could integrate with a toast system here
      console.warn('You can only edit your own items');
      return;
    }
    updateCartItem(item.public_id, newQty, item.note, item.version);
  };

  const handleDelete = (item) => {
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
                              {item.image_url ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden"
                                     style={{
                                       borderRadius: '8px',
                                       backgroundColor: '#F3F4F6'
                                     }}>
                                  {isVideoUrl(item.image_url) ? (
                                    <video
                                      src={item.image_url}
                                      className="w-12 h-12 object-cover"
                                      autoPlay
                                      loop
                                      muted={true}
                                      playsInline
                                      controls={false}
                                      style={{
                                        objectFit: 'cover',
                                        width: '48px',
                                        height: '48px'
                                      }}
                                    />
                                  ) : (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="w-12 h-12 object-cover"
                                      loading="lazy"
                                      style={{
                                        objectFit: 'cover',
                                        width: '48px',
                                        height: '48px'
                                      }}
                                    />
                                  )}
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
                                  ₹{(item.price * item.qty).toFixed(2)}
                                </p>
                              </div>
                              
                              {/* Note if present */}
                              {item.note && (
                                <p className="text-xs text-gray-500 mb-2 truncate"
                                   style={{
                                     fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                     fontSize: '11px',
                                     fontStyle: 'italic'
                                   }}>
                                  {item.note}
                                </p>
                              )}
                              
                              {/* Quantity Controls */}
                              <div className="flex items-center">
                                {canEdit ? (
                                  <div className="flex items-center bg-gray-50 rounded-lg"
                                       style={{
                                         borderRadius: '12px',
                                         border: '1px solid #E5E7EB'
                                       }}>
                                    <button
                                      onClick={() => handleDecrease(item)}
                                      className="p-1.5 hover:bg-gray-100 rounded-l-lg transition-colors"
                                      style={{
                                        borderTopLeftRadius: '12px',
                                        borderBottomLeftRadius: '12px'
                                      }}
                                    >
                                      {item.qty === 1 ? (
                                        <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                                      ) : (
                                        <MinusIcon className="w-3.5 h-3.5 text-gray-600" />
                                      )}
                                    </button>
                                    
                                    <span className="px-3 py-1.5 text-sm font-semibold text-gray-900 bg-white border-x border-gray-200"
                                          style={{
                                            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            minWidth: '32px',
                                            textAlign: 'center'
                                          }}>
                                      {item.qty}
                                    </span>
                                    
                                    <button
                                      onClick={() => handleIncrease(item)}
                                      className="p-1.5 hover:bg-gray-100 rounded-r-lg transition-colors"
                                      style={{
                                        borderTopRightRadius: '12px',
                                        borderBottomRightRadius: '12px'
                                      }}
                                    >
                                      <PlusIcon className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg"
                                        style={{
                                          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                          fontSize: '11px',
                                          borderRadius: '8px'
                                        }}>
                                    Qty: {item.qty}
                                  </span>
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
            <button
              onClick={() => onCheckout?.(items, total)}
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