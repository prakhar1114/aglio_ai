import { useSessionStore } from '../store/session.js';
import { getBaseApiCandidates } from '../api/base.js';

/**
 * API calls for session management
 */
async function createTableSession(tablePid, token, deviceId) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/table_session`;
      console.log(`Creating table session at: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          table_pid: tablePid,
          token: token,
          device_id: deviceId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session created successfully:', data);
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

async function refreshToken(wsToken) {
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

async function validateSessionPassword(sessionPid, word) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/session/validate_pass`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_pid: sessionPid,
          word: word
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Password validated successfully');
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Password validation failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

/**
 * WebSocket connection management
 */
function setupWebSocket(sessionPid, wsToken) {
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
  
  switch (data.type) {
    case 'member_join':
      console.log('Member joined:', data.member);
      sessionStore.updateMembers(data.member);
      break;
      
    case 'error':
      console.error('WebSocket error event:', data);
      sessionStore.showModal({
        type: 'error',
        title: 'Connection Error',
        message: data.detail || 'An error occurred with the connection',
      });
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
 * Main setup function - called from MenuScreen
 */
export async function setupConnection(location) {
  console.log('Setting up connection...');
  
  const sessionStore = useSessionStore.getState();
  const searchParams = new URLSearchParams(location.search);
  
  // Parse URL parameters
  const tablePid = searchParams.get('t');
  const token = searchParams.get('token');
  
  if (!tablePid || !token) {
    console.log('Missing URL parameters - checking for persisted session');
    
    // Try to load persisted session
    const hasPersistedSession = sessionStore.loadPersistedSession();
    if (hasPersistedSession) {
      console.log('Restored persisted session');
      
      // Check if token needs refresh
      if (sessionStore.needsTokenRefresh()) {
        try {
          const result = await refreshToken(sessionStore.wsToken);
          if (result.success) {
            sessionStore.setWsToken(result.data.ws_token);
          }
        } catch (error) {
          console.error('Token refresh failed on startup:', error);
          sessionStore.clearSession();
          sessionStore.showModal({
            type: 'error',
            title: 'Session Expired',
            message: 'Please scan the QR code to start a new session.',
          });
          return { success: false, reason: 'session_expired' };
        }
      }
      
      // Setup WebSocket with persisted session
      setupWebSocket(sessionStore.sessionPid, sessionStore.wsToken);
      return { success: true, reason: 'persisted_session' };
    }
    
    // No URL params and no persisted session
    sessionStore.showModal({
      type: 'info',
      title: 'Scan QR Code',
      message: 'Please scan the QR code at your table to get started. Close this popup to continue browsing',
    });
    return { success: false, reason: 'no_session_data' };
  }
  
  try {
    // Create table session
    console.log('Creating table session...');
    const result = await createTableSession(tablePid, token, sessionStore.deviceId);
    
    if (result.success) {
      // Store session data
      sessionStore.setSessionData(result.data);
      sessionStore.persistSession();
      sessionStore.setConnectionStatus('open');
      
      // Set table number from API response
      if (result.data.table_number) {
        sessionStore.setTableNumber(result.data.table_number);
      }
      
      console.log('Session created, setting up WebSocket...');
      
      // Setup WebSocket connection
      sessionStore.setWsStatus('connecting');
      setupWebSocket(result.data.session_pid, result.data.ws_token);
      
      return { 
        success: true, 
        sessionData: result.data 
      };
    }
    
  } catch (error) {
    console.error('Connection setup failed:', error);
    
    // Set table number to "?" when API call fails
    sessionStore.setTableNumber("?");
    
    // Parse error response for specific handling
    let errorType = 'error';
    let title = 'Connection Error';
    let message = 'Failed to connect to table session.';
    
    if (error.message.includes('table_not_found')) {
      title = 'Table Not Found';
      message = 'The QR code appears to be invalid. Please try scanning again.';
    } else if (error.message.includes('bad_token')) {
      title = 'Invalid QR Code';
      message = 'The QR code is invalid or has expired. Please scan a fresh code.';
    } else if (error.message.includes('restaurant_closed')) {
      errorType = 'warning';
      title = 'Restaurant Closed';
      message = 'The restaurant is currently closed. Please check back during operating hours.';
      sessionStore.setConnectionStatus('closed', message);
    } else if (error.message.includes('table_disabled')) {
      errorType = 'warning';
      title = 'Table Unavailable';
      message = 'This table is currently disabled. Please contact staff for assistance.';
      sessionStore.setConnectionStatus('disabled', message);
    }
    
    sessionStore.showModal({
      type: errorType,
      title,
      message,
      actions: [{
        label: 'Try Again',
        action: () => window.location.reload(),
        variant: 'primary'
      }]
    });
    
    return { success: false, reason: 'connection_failed', error: error.message };
  }
}

/**
 * Utility function to validate session password
 */
export async function validatePassword(sessionPid, word) {
  return await validateSessionPassword(sessionPid, word);
}

/**
 * Utility function to update member nickname
 */
export async function updateMemberNickname(memberPid, nickname) {
  const sessionStore = useSessionStore.getState();
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/member/${memberPid}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${sessionStore.wsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nickname })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Nickname updated successfully');
        sessionStore.updateNickname(nickname);
        sessionStore.persistSession();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Nickname update failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
} 