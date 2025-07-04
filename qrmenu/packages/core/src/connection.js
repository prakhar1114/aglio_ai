import { useSessionStore } from './store/session.js';
import { useCartStore } from './store/cart.js';
import { useChatStore } from './store/chat.js';
import { getBaseApiCandidates, constructImageUrl } from './api/base.js';
import { generateShortId } from './utils/general.js';

/**
 * WebSocket and real-time connection management
 */

export async function refreshToken(wsToken) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/session/token_refresh`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wsToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Token refreshed successfully');
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Token refresh failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

/**
 * WebSocket connection management
 */
export function setupWebSocket(sessionPid, wsToken) {
  const sessionStore = useSessionStore.getState();
  const wsBaseUrl = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';
  const wsUrl = `${wsBaseUrl}/ws/session?sid=${sessionPid}&token=${wsToken}`;
  
  console.log('Connecting to WebSocket:', wsUrl);
  
  // Create WebSocket connection with token in URL
  // Since standard WebSocket doesn't support custom headers, we pass token via query param
  // The backend will need to be updated to handle token from query params as well
  const ws = new WebSocket(wsUrl);
  
  // Store the token for potential reconnection
  ws._authToken = wsToken;

  ws.onopen = () => {
    console.log('WebSocket connected');
    sessionStore.setWsStatus('connected');
    sessionStore.resetRetryCount();
    
    // Send ping to establish connection
    ws.send('ping');
  };

  ws.onmessage = (event) => {
    try {
      if (event.data === 'pong') {
        console.log('Received pong from server');
        return;
      }

      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);
    sessionStore.setWsStatus('disconnected');
    sessionStore.setWsConnection(null);
    
    handleWebSocketClose(event, sessionPid, wsToken);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    sessionStore.setWsStatus('error');
  };

  sessionStore.setWsConnection(ws);
  return ws;
}

function handleWebSocketMessage(data) {
  const sessionStore = useSessionStore.getState();
  const cartStore = useCartStore.getState();
  const chatStore = useChatStore.getState();
  


  switch (data.type) {
    case 'member_join':
      console.log('Member joined:', data.member);
      sessionStore.updateMembers(data.member);
      break;
      
    case 'cart_update':
      console.log('Cart update received:', data);
      cartStore.applyCartUpdate(data);
      break;
      
    // Chat message types
    case 'chat_user_message':
      console.log('Chat user message received:', data);
      chatStore.handleWebSocketMessage(data);
      break;
      
    case 'chat_response':
      console.log('Chat AI response received:', data);
      chatStore.handleWebSocketMessage(data);
      break;
      
    // Order processing messages
    case 'cart_locked':
      console.log('Cart locked by member:', data);
      cartStore.lockCart({
        orderId: data.order_id,
        lockedByMember: data.locked_by_member
      });
      break;
      
    case 'order_confirmed':
      console.log('Order confirmed:', data);
      if (data.order) {
        cartStore.handleOrderSuccess(data.order);
      } else {
        // Fallback if only id is sent
        cartStore.handleOrderSuccess({ id: data.order_id });
      }
      // Don't add to orders here - let the backend send order details separately
      break;
      
    case 'order_failed':
      console.log('Order failed:', data);
      cartStore.handleOrderFailure(data.error || 'Order processing failed');
      break;
      
    case 'table_closed':
      console.log('Table closed by admin:', data.message);
      window.location.href = '/menu';
      // // Show modal first
      // sessionStore.showModal({
      //   type: 'warning',
      //   title: 'Table Closed',
      //   message: data.message || 'Table Closed, Please rescan the QR code or Ask Staff for help',
      //   actions: [{
      //     label: 'OK',
      //     action: () => {
      //       // Clear session and redirect
      //       sessionStore.clearSession();
      //       // window.location.href = '/menu';
      //     },
      //     variant: 'primary'
      //   }]
      // });
      break;
      
    case 'error':
      // Handle cart-specific errors
      if (data.code === 'pass_required') {
        cartStore.setPasswordRequired(true);
        cartStore.queueMutation(data.original);
      } else if (data.code === 'version_conflict') {
        cartStore.handleCartError(data);
      } else {
        // Handle other errors as before
        console.error('WebSocket error event:', data);
        sessionStore.showModal({
          type: 'error',
          title: 'Connection Error',
          message: data.detail || 'An error occurred with the connection',
        });
      }
      break;
      
    default:
      console.log('Unknown WebSocket message type:', data.type);
  }
}

function handleWebSocketClose(event, sessionPid, wsToken) {
  const sessionStore = useSessionStore.getState();
  
  switch (event.code) {
    case 4003: // Auth failed
      console.log('WebSocket auth failed, attempting token refresh');
      attemptTokenRefreshAndReconnect(sessionPid);
      break;
      
    case 4008: // Connection limit exceeded
      sessionStore.showModal({
        type: 'warning',
        title: 'Too Many Connections',
        message: 'Too many devices are connected to this table session. Please close other tabs and refresh.',
        actions: [{
          label: 'Refresh Page',
          action: () => window.location.reload(),
          variant: 'primary'
        }]
      });
      break;
      
    default:
      // Normal disconnection or network error - attempt reconnect
      if (sessionStore.wsRetryCount < sessionStore.wsMaxRetries) {
        const delay = Math.min(1000 * Math.pow(2, sessionStore.wsRetryCount), 10000);
        console.log(`Reconnecting WebSocket in ${delay}ms (attempt ${sessionStore.wsRetryCount + 1})`);
        
        setTimeout(() => {
          sessionStore.incrementRetryCount();
          setupWebSocket(sessionPid, wsToken);
        }, delay);
      } else {
        sessionStore.showModal({
          type: 'error',
          title: 'Connection Lost',
          message: 'Unable to maintain connection to the table session. Please refresh the page.',
          actions: [{
            label: 'Refresh Page',
            action: () => window.location.reload(),
            variant: 'primary'
          }]
        });
      }
  }
}

async function attemptTokenRefreshAndReconnect(sessionPid) {
  const sessionStore = useSessionStore.getState();
  
  try {
    const result = await refreshToken(sessionStore.wsToken);
    if (result.success) {
      sessionStore.setWsToken(result.data.ws_token);
      setupWebSocket(sessionPid, result.data.ws_token);
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    sessionStore.showModal({
      type: 'error',
      title: 'Session Expired',
      message: 'Your session has expired. Please scan the QR code again.',
      actions: [{
        label: 'Reload Page',
        action: () => window.location.reload(),
        variant: 'primary'
      }]
    });
  }
}

/**
 * WebSocket message helpers
 */
export function sendCartMutation(mutation) {
  const wsConnection = useSessionStore.getState().wsConnection;
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(mutation));
  } else {
    console.error('WebSocket not connected');
  }
}

export function sendChatMessage(message, senderName, threadId, messageId) {
  const wsConnection = useSessionStore.getState().wsConnection;
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const chatMessage = {
      type: 'chat_message',
      sender_name: senderName,
      message: message,
      thread_id: threadId,
      message_id: messageId
    };
    
    console.log('Sending chat message:', chatMessage);
    wsConnection.send(JSON.stringify(chatMessage));
  } else {
    console.error('WebSocket not connected - cannot send chat message');
  }
}

// Order placement functions
export function placeOrder(specialInstructions = '') {
  const wsConnection = useSessionStore.getState().wsConnection;
  const cartStore = useCartStore.getState();
  
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected - cannot place order');
    cartStore.handleOrderFailure('Connection lost');
    return;
  }
  
  // Check if cart is empty
  if (cartStore.items.length === 0) {
    console.error('Cannot place order: cart is empty');
    cartStore.handleOrderFailure('Cart is empty');
    return;
  }
  
  // Lock cart immediately
  cartStore.lockCart();
  
  const orderMessage = {
    type: 'place_order',
    special_instructions: specialInstructions,
    total: cartStore.getTotalAmount()
  };
  
  console.log('Sending order placement message:', orderMessage);
  wsConnection.send(JSON.stringify(orderMessage));
}

export function addItemToCart(menuItem, qty = 1, note = '') {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  // Check if password validation is required
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  const hasVariations = menuItem.variation_groups && menuItem.variation_groups.length > 0;
  const hasAddons = menuItem.addon_groups && menuItem.addon_groups.length > 0;

  if (hasVariations || hasAddons) {
    // Defer to customisation modal
    cartStore.openCustomisation('add', menuItem, { qty, note });
    return;
  }

  // Direct add without customisations
  const tmpId = generateShortId();

  cartStore.addItemOptimistic(menuItem, qty, note, tmpId, null, []);

  const mutation = {
    op: 'create',
    tmpId,
    menu_item_id: menuItem.id,
    qty,
    note,
    selected_item_variation_id: null,
    selected_addons: [],
  };

  sendCartMutation(mutation);
}

export function updateCartItem(public_id, qty, note, version) {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Apply optimistic update
  cartStore.updateItemOptimistic(public_id, qty, note, version);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'update',
    public_id,
    qty,
    note,
    version
  };

  sendCartMutation(mutation);
}

export function replaceCartItem(public_id, menuItem, qty, note, version) {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  const hasVariations = menuItem.variation_groups && menuItem.variation_groups.length > 0;
  const hasAddons = menuItem.addon_groups && menuItem.addon_groups.length > 0;

  if (hasVariations || hasAddons) {
    // Need to open modal with existing selections
    const cartItem = useCartStore.getState().items.find((ci) => ci.public_id === public_id);
    if (!cartItem) {
      console.error('Cart item not found for replaceCartItem');
      return;
    }
    
    // console.log('Cart item found for replaceCartItem:', cartItem);

    // Derive selected variation id from either new-style or snapshot-style keys
    const selectedVariationId = cartItem.selected_variation_id || cartItem.selected_variation?.item_variation_id || null;

    // Derive selected addons request array
    let selectedAddonsRequest = [];
    if (cartItem.selected_addons_request && cartItem.selected_addons_request.length > 0) {
      selectedAddonsRequest = cartItem.selected_addons_request;
    } else if (cartItem.selected_addons && cartItem.selected_addons.length > 0) {
      // Map snapshot-style addon objects -> request objects
      selectedAddonsRequest = cartItem.selected_addons.map((addon) => ({
        addon_group_item_id: addon.addon_group_item_id || addon.id, // fallback for legacy key
        quantity: addon.quantity || 1,
      }));
    }

    cartStore.openCustomisation('replace', menuItem, {
      qty: cartItem.qty,
      note: cartItem.note || '',
      cartItemId: public_id,
      version: cartItem.version,
      selectedVariationId,
      selectedAddons: selectedAddonsRequest,
    });
    return;
  }

  // Simple replace without customisations
  cartStore.replaceItemOptimistic(public_id, menuItem, qty, note, version, null, []);

  const mutation = {
    op: 'replace',
    public_id,
    menu_item_id: menuItem.id,
    qty,
    note,
    version,
    selected_item_variation_id: null,
    selected_addons: [],
  };

  sendCartMutation(mutation);
}

export function deleteCartItem(public_id, version) {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Add debugging
  console.log('Deleting cart item:', { public_id, version });
  
  // Validate parameters
  if (!public_id) {
    console.error('Cannot delete cart item: public_id is required');
    return;
  }
  
  // Apply optimistic update
  cartStore.deleteItemOptimistic(public_id, version);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'delete',
    public_id,
    version: version || 1,
    qty: 0,
    note: '',
    selected_item_variation_id: null,
    selected_addons: [],
  };
  
  console.log('Sending delete mutation:', mutation);
  sendCartMutation(mutation);
}

export function confirmCustomisation() {
  const cartStore = useCartStore.getState();
  const { customisationMode, currentActiveItem, customisationData } = cartStore;
  
  if (!customisationMode || !currentActiveItem) return;

  const { qty, note, selectedVariationId, selectedAddons, cartItemId, version } = customisationData;

  if (customisationMode === 'add') {
    // Use the existing addItemToCart function with customisation data
    const tmpId = generateShortId();
    
    // Apply optimistic update
    cartStore.addItemOptimistic(currentActiveItem, qty, note, tmpId, selectedVariationId, selectedAddons);

    const mutation = {
      op: 'create',
      tmpId,
      menu_item_id: currentActiveItem.id,
      qty,
      note,
      selected_item_variation_id: selectedVariationId,
      selected_addons: selectedAddons,
    };

    sendCartMutation(mutation);
  } else if (customisationMode === 'replace') {
    if (!cartItemId) {
      console.error('No cart item id for replace operation');
      return;
    }
    
    // Apply optimistic update
    cartStore.replaceItemOptimistic(cartItemId, currentActiveItem, qty, note, version, selectedVariationId, selectedAddons);

    const mutation = {
      op: 'replace',
      public_id: cartItemId,
      menu_item_id: currentActiveItem.id,
      qty,
      note,
      version,
      selected_item_variation_id: selectedVariationId,
      selected_addons: selectedAddons,
    };

    sendCartMutation(mutation);
  }

  // Close modal after confirm
  cartStore.closeCustomisation();
}