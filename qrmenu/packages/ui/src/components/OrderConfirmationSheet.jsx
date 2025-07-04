import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@qrmenu/core';

export function OrderConfirmationSheet({ isOpen, onClose, onViewOrders, placedOrder }) {
  const orders = useCartStore((state) => state.getOrders());
  
  // Helper function to format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Sheet */}
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
            Order Placed Successfully! 🎉
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Success Message */}
          <div className="text-center p-6 bg-green-50 rounded-xl border border-green-100"
               style={{
                 borderRadius: '12px',
                 backgroundColor: 'rgba(34, 197, 94, 0.05)',
                 border: '1px solid rgba(34, 197, 94, 0.2)'
               }}>
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2"
                style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1C1C1E'
                }}>
              {placedOrder && `Order #${placedOrder.orderNumber} Placed!`}
            </h3>
            <p className="text-gray-600 mb-4"
               style={{
                 fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                 fontSize: '14px',
                 color: '#6B7280',
                 lineHeight: '1.5'
               }}>
              Please show this to your waiter to confirm your order.
            </p>
            {placedOrder && (
              <div className="bg-white p-4 rounded-lg border border-green-200 text-left"
                   style={{
                     borderRadius: '8px',
                     backgroundColor: '#FFFFFF',
                     border: '1px solid rgba(34, 197, 94, 0.3)'
                   }}>
                
                {/* Order Items */}
                <div className="space-y-2 mb-3">
                  {placedOrder.items.map((cartItem, index) => {
                    const itemPrice = cartItem.final_price ?? 0;
                    return (
                      <div key={`${placedOrder.id}-${cartItem.public_id}-${index}`} 
                           className="flex justify-between items-center py-1"
                           style={{
                             borderBottom: index < placedOrder.items.length - 1 ? '1px solid #F3F4F6' : 'none',
                             paddingBottom: index < placedOrder.items.length - 1 ? '8px' : '0'
                           }}>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900"
                             style={{
                               fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                               fontSize: '14px',
                               fontWeight: '600',
                               color: '#1C1C1E'
                             }}>
                            {cartItem.name}
                          </p>
                          <p className="text-sm text-gray-600"
                             style={{
                               fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                               fontSize: '12px',
                               color: '#6B7280'
                             }}>
                            Qty: {cartItem.qty} × ₹{itemPrice.toFixed(2)}
                          </p>
                          {/* Customisations */}
                          {cartItem.selected_variation && (
                            <p className="text-xs text-gray-500" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '11px' }}>
                              {cartItem.selected_variation.group_name}: {cartItem.selected_variation.variation_name}
                            </p>
                          )}

                          {cartItem.selected_addons && cartItem.selected_addons.length > 0 && (
                            <div className="mt-0.5 space-y-0.5">
                              {cartItem.selected_addons.map((addon, idx) => (
                                <p key={idx} className="text-xs text-gray-500" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '11px' }}>
                                  + {addon.name}{addon.quantity > 1 ? ` × ${addon.quantity}` : ''}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 ml-3"
                           style={{
                             fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                             fontSize: '14px',
                             fontWeight: '600',
                             color: '#1C1C1E'
                           }}>
                          ₹{(itemPrice * cartItem.qty).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Order Summary */}
                <div className="border-t pt-3"
                     style={{ borderTop: '2px solid rgba(34, 197, 94, 0.2)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-semibold text-green-700"
                       style={{
                         fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                         fontSize: '16px',
                         fontWeight: '700',
                         color: '#059669'
                       }}>
                      Total: ₹{placedOrder.total.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500"
                     style={{
                       fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                       fontSize: '12px',
                       color: '#6B7280'
                     }}>
                    Placed at {formatTime(placedOrder.timestamp)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Previous Orders (if any) */}
          {orders.length > 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1C1C1E'
                  }}>
                Previous Orders from this Table
              </h3>
              <div className="space-y-2">
                {orders.slice(1, 4).map((order) => ( // Show max 3 previous orders
                  <div key={order.id} 
                       className="bg-gray-50 rounded-lg p-3"
                       style={{
                         borderRadius: '8px',
                         backgroundColor: '#F9FAFB',
                         border: '1px solid #F3F4F6'
                       }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900"
                           style={{
                             fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                             fontSize: '14px',
                             fontWeight: '600',
                             color: '#1C1C1E'
                           }}>
                          Order #{order.orderNumber}
                        </p>
                        <p className="text-sm text-gray-500"
                           style={{
                             fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                             fontSize: '12px',
                             color: '#6B7280'
                           }}>
                          {order.items.length} items • {formatTime(order.timestamp)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900"
                         style={{
                           fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                           fontSize: '14px',
                           fontWeight: '600',
                           color: '#1C1C1E'
                         }}>
                        ₹{order.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {orders.length > 4 && (
                  <p className="text-center text-sm text-gray-500 pt-2"
                     style={{
                       fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                       fontSize: '12px',
                       color: '#6B7280'
                     }}>
                    +{orders.length - 4} more orders
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="border-t bg-gray-50 p-4 space-y-3"
             style={{
               backgroundColor: 'rgba(250, 251, 252, 0.95)',
               backdropFilter: 'blur(8px)',
               WebkitBackdropFilter: 'blur(8px)',
               borderTop: '1px solid #F3F4F6'
             }}>
          
          {/* My Orders Button (if more than one order) */}
          {orders.length > 0 && (
            <button
              onClick={onViewOrders}
              className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200"
              style={{
                backgroundColor: '#F3F4F6',
                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '8px',
                color: '#1C1C1E',
                border: '1px solid #E5E7EB',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              View My Orders ({orders.length})
            </button>
          )}

          {/* Back to Menu Button */}
          <button
            onClick={onClose}
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
            Back to Menu
          </button>
        </div>
      </div>
    </>
  );
} 