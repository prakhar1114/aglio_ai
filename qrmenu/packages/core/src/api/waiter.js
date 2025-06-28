import { getBaseApiCandidates } from './base.js';
import { useSessionStore } from '../store/session.js';

/**
 * Call waiter or ask for bill
 */
export async function sendWaiterRequest(requestType) {
  const sessionStore = useSessionStore.getState();
  const wsToken = sessionStore.wsToken;
  
  if (!wsToken) {
    throw new Error('Not authenticated');
  }

  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/waiter_request`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wsToken}`
        },
        body: JSON.stringify({
          request_type: requestType
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Waiter request sent successfully:', data);
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`Waiter request failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

/**
 * Call waiter helper function
 */
export async function callWaiter() {
  return sendWaiterRequest('call_waiter');
}

/**
 * Ask for bill helper function
 */
export async function askForBill() {
  return sendWaiterRequest('ask_for_bill');
}

/**
 * Handle waiter request with UI feedback
 */
export async function handleWaiterRequest(requestType, successTitle, successMessage) {
  const sessionStore = useSessionStore.getState();
  
  try {
    const result = await sendWaiterRequest(requestType);
    
    sessionStore.showModal({
      type: 'success',
      title: successTitle,
      message: result.data.message || successMessage,
    });
    
    return result;
  } catch (error) {
    console.error(`Failed to ${requestType.replace('_', ' ')}:`, error);
    
    // Use the actual backend error message (already extracted in sendWaiterRequest)
    const errorMessage = error.message || 'Please try again.';
    
    sessionStore.showModal({
      type: 'error',
      title: 'Request Failed',
      message: errorMessage,
    });
    
    throw error;
  }
} 