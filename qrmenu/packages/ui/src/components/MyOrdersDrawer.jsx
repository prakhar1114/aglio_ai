import { XMarkIcon, UserIcon, StarIcon, PencilSquareIcon, BellIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import { useCartStore, useSessionStore, updateMemberNickname, handleWaiterRequest } from '@qrmenu/core';
import { useState } from 'react';

export function MyOrdersDrawer({ isOpen, onClose, enableCallWaiter }) {
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
  
  // Waiter request functions
  const handleCallWaiter = async () => {
    await handleWaiterRequest('call_waiter', 'Waiter Called', 'Your waiter has been notified and will be with you shortly.');
  };

  const handleAskForBill = async () => {
    await handleWaiterRequest('ask_for_bill', 'Bill Requested', 'Your bill request has been sent to staff.');
  };

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
        <div className="p-4 border-b border-gray-100"
             style={{
               backgroundColor: 'rgba(250, 251, 252, 0.95)',
               backdropFilter: 'blur(8px)',
               WebkitBackdropFilter: 'blur(8px)'
             }}>
          
          {/* Main Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1C1C1E',
                    lineHeight: '1.2'
                  }}>
                {restaurantName || 'Restaurant'}
              </h1>
            </div>
            
            {/* Close Button */}
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

          {/* Secondary Info Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Table Info */}
              {tableNumber !== null && (
                <span className="text-sm text-gray-600"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                  Table {tableNumber}
                </span>
              )}
              
              {/* Separator */}
              {tableNumber !== null && nickname && (
                <span className="text-gray-300">•</span>
              )}
              
              {/* User Info with Sync Status */}
              {nickname && (
                <div className="flex items-center gap-1.5">
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
                        className="text-sm bg-white border border-gray-300 rounded px-2 py-1 w-24"
                        style={{
                          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          fontSize: '13px',
                          borderRadius: '6px'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleNicknameSave();
                          if (e.key === 'Escape') handleNicknameCancel();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleNicknameSave}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        style={{ fontSize: '11px' }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span
                        onClick={handleNicknameEdit}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900 group"
                        style={{
                          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        {nickname}
                        {isHost && (
                          <span className="text-xs text-gray-500 ml-1" style={{ fontSize: '11px' }}>
                            (Host)
                          </span>
                        )}
                        <PencilSquareIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                      </span>
                      
                      {/* Sync Status as part of user context */}
                      <div className="flex items-center gap-1 ml-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          wsStatus === 'connected' ? 'bg-green-500' :
                          wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                          wsStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        <span className={`text-xs ${
                          wsStatus === 'connected' ? 'text-green-600' :
                          wsStatus === 'connecting' ? 'text-yellow-600' :
                          wsStatus === 'error' ? 'text-red-600' : 'text-gray-500'
                        }`}
                              style={{
                                fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                fontSize: '10px'
                              }}>
                          {wsStatus === 'connected' ? 'Synced' :
                           wsStatus === 'connecting' ? 'Syncing...' :
                           wsStatus === 'error' ? 'Error' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Right Side - Logout Only */}
            <div>
              {sessionStore.sessionPid && (
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                  style={{
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </div>

          {/* Members List */}
          {members.length > 1 && (
            <div className="bg-gray-50 rounded-lg p-3"
                 style={{
                   backgroundColor: 'rgba(249, 250, 251, 0.8)',
                   borderRadius: '8px'
                 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600"
                      style={{
                        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                  SESSION MEMBERS ({members.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <div
                    key={member.member_pid}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${
                      member.member_pid === memberPid 
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' 
                        : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                    style={{
                      fontSize: '11px',
                      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      fontWeight: '500',
                      borderRadius: '8px'
                    }}
                  >
                    {member.is_host ? (
                      <StarIcon className="w-3 h-3 text-yellow-500" />
                    ) : (
                      <UserIcon className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="max-w-20 truncate">
                      {member.nickname || 'Guest'}
                      {member.member_pid === memberPid && ' (You)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiter Request Buttons */}
          {sessionStore.sessionPid && enableCallWaiter && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCallWaiter}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px'
                }}
              >
                <BellIcon className="w-4 h-4" />
                Call Waiter
              </button>
              
              <button
                onClick={handleAskForBill}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                style={{
                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px'
                }}
              >
                <ReceiptPercentIcon className="w-4 h-4" />
                Ask for Bill
              </button>
            </div>
          )}
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
                  backgroundColor: '#C72C48',
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900"
                            style={{
                              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1C1C1E'
                            }}>
                          Order #{order.orderNumber}
                        </h3>
                        {/* Status Indicator */}
                        {order.status && (
                          <span 
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'placed' ? 'bg-gray-100 text-gray-700' :
                              order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              order.status === 'failed' ? 'bg-red-100 text-red-700' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                            }`}
                            style={{
                              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                              fontSize: '10px',
                              fontWeight: '600',
                              borderRadius: '12px',
                              letterSpacing: '0.025em'
                            }}
                          >
                            <div 
                              className={`w-1.5 h-1.5 rounded-full ${
                                order.status === 'placed' ? 'bg-gray-500' :
                                order.status === 'confirmed' ? 'bg-green-500' :
                                order.status === 'failed' ? 'bg-red-500' :
                                order.status === 'cancelled' ? 'bg-red-500' :
                                'bg-green-500'
                              }`}
                            />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        )}
                      </div>
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
                           color: '#C72C48'
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
                    {order.items.map((cartItem, index) => {
                      const itemPrice = cartItem.final_price ?? 0;
                      return (
                        <div key={`${order.id}-${cartItem.public_id}-${index}`} 
                             className="flex items-center justify-between py-2"
                             style={{
                               borderTop: index > 0 ? '1px solid #F3F4F6' : 'none',
                               paddingTop: index > 0 ? '8px' : '0'
                             }}>
                          
                          {/* Item Details */}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900"
                                style={{
                                  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#1C1C1E'
                                }}>
                              {cartItem.name}
                            </h4>
                            <p className="text-sm text-gray-500"
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
                          
                          {/* Item Total */}
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
                     color: '#C72C48'
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