import { XMarkIcon, UserIcon, StarIcon, ArrowLeftOnRectangleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, updateMemberNickname } from '@qrmenu/core';
import { useState } from 'react';

export function MyOrdersDrawer({ isOpen, onClose }) {
  const orders = useCartStore((state) => state.getOrders());
  const totalBill = useCartStore((state) => state.getTotalBill());
  
  // Session store data
  const sessionStore = useSessionStore();
  const members = sessionStore.members;
  const wsStatus = sessionStore.wsStatus;
  const connectionStatus = sessionStore.connectionStatus;
  const isHost = sessionStore.isHost;
  const nickname = sessionStore.nickname;
  const memberPid = sessionStore.memberPid;
  const restaurantName = sessionStore.restaurantName;
  const tableNumber = sessionStore.tableNumber;
  
  // Local state for nickname editing
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(nickname || '');

  // Nickname editing handlers
  const handleNicknameEdit = () => {
    setNewNickname(nickname || '');
    setEditingNickname(true);
  };

  const handleNicknameSave = async () => {
    if (newNickname.trim() && newNickname !== nickname) {
      try {
        await updateMemberNickname(memberPid, newNickname.trim());
        setEditingNickname(false);
      } catch (error) {
        console.error('Failed to update nickname:', error);
        sessionStore.showModal({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update nickname. Please try again.',
        });
      }
    } else {
      setEditingNickname(false);
    }
  };

  const handleNicknameCancel = () => {
    setNewNickname(nickname || '');
    setEditingNickname(false);
  };

  // Logout handler
  const handleLogout = () => {
    // Clear session data
    sessionStore.clearSession();
    
    // Redirect to menu page without table parameters
    window.location.href = '/menu';
  };

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
          <div className="flex-1">
            {/* First line: Restaurant name, table number, restaurant status, and order count */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: '#1C1C1E'
                  }}>
                {restaurantName || 'Restaurant'}
              </h2>
              
              {/* Table Number - always show if available */}
              {tableNumber !== null && (
                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                  Table {tableNumber}
                </span>
              )}
              
              {/* Restaurant Status */}
              {connectionStatus && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  connectionStatus === 'open' ? 'text-green-700 bg-green-100' :
                  connectionStatus === 'closed' ? 'text-yellow-700 bg-yellow-100' :
                  connectionStatus === 'disabled' ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'
                }`}>
                  {connectionStatus === 'open' ? 'Open' :
                   connectionStatus === 'closed' ? 'Closed' :
                   connectionStatus === 'disabled' ? 'Disabled' : 'Unknown'}
                </span>
              )}
              
              {/* Order count */}
              {!isEmpty && (
                <span className="text-sm text-gray-500 font-medium">
                  {orders.length} order{orders.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            {/* Second line: Member info and connection status */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Member Info */}
              {nickname && (
                <div className="flex items-center gap-1">
                  {isHost ? (
                    <StarIcon className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-gray-400" />
                  )}
                  {editingNickname ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        className="text-sm bg-white border border-gray-300 rounded px-2 py-1 max-w-24"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleNicknameSave();
                          if (e.key === 'Escape') handleNicknameCancel();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleNicknameSave}
                        className="text-xs text-green-600 hover:text-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleNicknameCancel}
                        className="text-xs text-gray-500 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={handleNicknameEdit}
                      className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900 group"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      }}
                    >
                      {nickname} {isHost && '(Host)'}
                      <PencilSquareIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                    </span>
                  )}
                </div>
              )}
              
              {/* Connection Status - clarified as sync status */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected' ? 'bg-green-500' :
                  wsStatus === 'connecting' ? 'bg-yellow-500' :
                  wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <span className="text-xs text-gray-600">
                  {wsStatus === 'connected' ? 'Synced' :
                   wsStatus === 'connecting' ? 'Syncing' :
                   wsStatus === 'error' ? 'Sync Error' : 'Offline'}
                </span>
              </div>
              
              {/* Session Members - more compact */}
              {members.length > 1 && (
                <span className="text-xs text-gray-500">
                  {members.length} members
                </span>
              )}
            </div>
            
            {/* Member List - show when there are multiple members */}
            {members.length > 1 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-1">
                  {members.map((member) => (
                    <div
                      key={member.member_pid}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        member.member_pid === memberPid 
                          ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      style={{
                        fontSize: '11px',
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      }}
                    >
                      {member.is_host ? (
                        <StarIcon className="w-3 h-3 text-yellow-500" />
                      ) : (
                        <UserIcon className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="max-w-16 truncate">
                        {member.nickname || 'Guest'}
                        {member.member_pid === memberPid && ' (You)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Logout Button - only show if there's a session */}
            {sessionStore.sessionPid && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '12px',
                  fontWeight: '500'
                }}
                title="Logout and leave table session"
              >
                <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                <span>Logout</span>
              </button>
            )}
            
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