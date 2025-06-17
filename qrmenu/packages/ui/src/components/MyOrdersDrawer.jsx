import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@qrmenu/core';

export function MyOrdersDrawer({ isOpen, onClose }) {
  const orders = useCartStore((state) => state.getOrders());
  const totalBill = useCartStore((state) => state.getTotalBill());
  
  // Helper function to format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper function to format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to check if URL is a video
  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  const isEmpty = orders.length === 0;

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
            My Orders {!isEmpty && `(${orders.length})`}
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
              <div className="text-6xl mb-4" role="img" aria-label="No orders">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: '#1C1C1E'
                  }}>
                No orders yet
              </h3>
              <p className="text-gray-500 mb-6"
                 style={{
                   fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                   fontSize: '14px'
                 }}>
                Start ordering to see your order history!
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
            <div className="p-4 space-y-4">
              {orders.map((order) => (
                <div key={order.id} 
                     className="bg-white rounded-lg p-4 border border-gray-100"
                     style={{
                       borderRadius: '12px',
                       boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
                       border: '1px solid #F3F4F6',
                       transition: 'all 0.2s ease-in-out'
                     }}>
                  
                  {/* Order Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900"
                          style={{
                            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#1C1C1E'
                          }}>
                        Order #{order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-500"
                         style={{
                           fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                           fontSize: '12px',
                           color: '#6B7280'
                         }}>
                        {formatDate(order.timestamp)} • {formatTime(order.timestamp)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600"
                         style={{
                           fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                           fontSize: '18px',
                           fontWeight: '700',
                           color: '#E23744'
                         }}>
                        ₹{order.total.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500"
                         style={{
                           fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                           fontSize: '12px',
                           color: '#6B7280'
                         }}>
                        {order.items.length} items
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2">
                    {order.items.map(({ item, qty }, index) => (
                      <div key={`${order.id}-${item.id}-${index}`} 
                           className="flex items-center space-x-3 py-2"
                           style={{
                             borderTop: index > 0 ? '1px solid #F3F4F6' : 'none',
                             paddingTop: index > 0 ? '8px' : '0'
                           }}>
                        
                        {/* Item Image/Video/Placeholder */}
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
                                   background: 'linear-gradient(135deg, rgba(250, 251, 252, 0.8) 0%, rgba(247, 249, 252, 0.6) 100%)',
                                   backdropFilter: 'blur(8px)',
                                   WebkitBackdropFilter: 'blur(8px)',
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
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 truncate"
                                  style={{
                                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1C1C1E'
                                  }}>
                                {item.name}
                              </h4>
                              <p className="text-sm text-gray-500"
                                 style={{
                                   fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                   fontSize: '12px',
                                   color: '#6B7280'
                                 }}>
                                Qty: {qty}
                              </p>
                            </div>
                            <p className="font-semibold text-gray-900 ml-2"
                               style={{
                                 fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                 fontSize: '14px',
                                 fontWeight: '600',
                                 color: '#1C1C1E'
                               }}>
                              ₹{(item.price * qty).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Total Bill */}
        {!isEmpty && (
          <div className="border-t bg-gray-50 p-4"
               style={{
                 backgroundColor: 'rgba(250, 251, 252, 0.95)',
                 backdropFilter: 'blur(8px)',
                 WebkitBackdropFilter: 'blur(8px)',
                 borderTop: '1px solid #F3F4F6'
               }}>
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900"
                    style={{
                      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1C1C1E'
                    }}>
                  Total Bill
                </h3>
                <p className="text-sm text-gray-500"
                   style={{
                     fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                     fontSize: '12px',
                     color: '#6B7280'
                   }}>
                  {orders.length} orders placed
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-600"
                   style={{
                     fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                     fontSize: '24px',
                     fontWeight: '800',
                     color: '#E23744'
                   }}>
                  ₹{totalBill.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 