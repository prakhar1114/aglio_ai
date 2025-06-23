import { useSessionStore } from './store/session.js';
import { useCartStore } from './store/cart.js';
import { getBaseApiCandidates, constructImageUrl } from './api/base.js';

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
  
  if ('item' in data && 'image_url' in data.item) {
    data.item.image_url = constructImageUrl(data.item.image_url);
  }

  switch (data.type) {
    case 'member_join':
      console.log('Member joined:', data.member);
      sessionStore.updateMembers(data.member);
      break;
      
    case 'cart_update':
      console.log('Cart update received:', data);
      cartStore.applyCartUpdate(data);
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
 * Cart mutation helpers
 */
export function sendCartMutation(mutation) {
  const wsConnection = useSessionStore.getState().wsConnection;
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(mutation));
  } else {
    console.error('WebSocket not connected');
  }
}

export function addItemToCart(menuItem, qty = 1, note = '') {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  // Check if password validation is required
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Generate temporary ID for optimistic update
  const tmpId = crypto.randomUUID();
  
  // Apply optimistic update
  cartStore.addItemOptimistic(menuItem, qty, note, tmpId);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'create',
    tmpId,
    menu_item_id: menuItem.id, // Use dish.id which corresponds to menu_item.public_id
    qty,
    note
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
    version: version || 1, // Provide default version if not available
    qty: 0, // Backend requires qty field even for delete operations
    note: '' // Include note field for consistency
  };
  
  console.log('Sending delete mutation:', mutation);
  sendCartMutation(mutation);
}