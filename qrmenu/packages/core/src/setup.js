import { useSessionStore } from './store/session.js';
import { useCartStore } from './store/cart.js';
import { getBaseApiCandidates, constructImageUrl } from './api/base.js';
import { refreshToken, setupWebSocket } from './connection.js';
import { loadCartSnapshot } from './api/cart.js';

/**
 * ---------------------------------------------------------
 * Session & table-connection helpers (non-WebSocket logic)
 * ---------------------------------------------------------
 *
 * This file is focused on REST-style API calls that establish
 * the table session, load initial data and provide helpers that
 * are **not** tied directly to a live WebSocket connection.
 * All WebSocket–specific logic remains defined in `connection.js`.
 */

/* ------------------------------------------------------------------
 * Low-level API helpers
 * ------------------------------------------------------------------ */

// Create (or join) a table-session for the current browser/device
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
          token,
          device_id: deviceId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session created successfully:', data);
        return { success: true, data };
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    } catch (error) {
      console.log(`Failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

// Validate the daily password required by some restaurants
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
        body: JSON.stringify({ session_pid: sessionPid, word })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Password validated successfully');
        return { success: true, data };
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    } catch (error) {
      console.log(`Password validation failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

/* ------------------------------------------------------------------
 * Public helpers consumed by UI
 * ------------------------------------------------------------------ */

export async function validatePassword(sessionPid, word) {
  return await validateSessionPassword(sessionPid, word);
}

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
          Authorization: `Bearer ${sessionStore.wsToken}`,
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
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    } catch (error) {
      console.log(`Nickname update failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

/* ------------------------------------------------------------------
 * High-level: end-to-end connection bootstrapper
 * ------------------------------------------------------------------ */

export async function setupConnection(location) {
  console.log('Setting up connection...');

  const sessionStore = useSessionStore.getState();
  const cartStore = useCartStore.getState();
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
            message: 'Please scan the QR code to start a new session.'
          });
          return { success: false, reason: 'session_expired' };
        }
      }

      // Setup WebSocket with persisted session
      setupWebSocket(sessionStore.sessionPid, sessionStore.wsToken);

      // Load cart snapshot for persisted session
      try {
        const cartResult = await loadCartSnapshot(
          sessionStore.sessionPid,
          sessionStore.wsToken
        );
        if (cartResult.success) {
          cartStore.loadCartSnapshot(cartResult.data);
        }
      } catch (error) {
        console.error('Failed to load cart snapshot:', error);
      }

      return { success: true, reason: 'persisted_session' };
    }

    // No URL params and no persisted session
    sessionStore.showModal({
      type: 'info',
      title: 'Scan QR Code',
      message:
        'Please scan the QR code at your table to get started. Close this popup to continue browsing'
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

      // Load cart snapshot after session is established
      console.log('Loading cart snapshot...');
      try {
        const cartResult = await loadCartSnapshot(result.data.session_pid, result.data.ws_token);
        if (cartResult.success) {
          cartStore.loadCartSnapshot(cartResult.data);
        }
        console.log('Cart snapshot loaded successfully');
      } catch (cartError) {
        console.error('Failed to load cart snapshot:', cartError);
        // Don't fail the entire connection for cart issues
      }

      return {
        success: true,
        sessionData: result.data
      };
    }
  } catch (error) {
    console.error('Connection setup failed:', error);

    // Set table number to "?" when API call fails
    sessionStore.setTableNumber('?');

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
      actions: [
        {
          label: 'Try Again',
          action: () => window.location.reload(),
          variant: 'primary'
        }
      ]
    });

    return { success: false, reason: 'connection_failed', error: error.message };
  }
} 