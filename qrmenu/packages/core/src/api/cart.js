import { getBaseApiCandidates, constructImageUrl } from './base.js';

export async function loadCartSnapshot(sessionPid, wsToken) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/cart_snapshot?session_pid=${sessionPid}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${wsToken}`
        }
      });
      
      if (response.ok) {
        const snapshot = await response.json();
        snapshot.items = snapshot.items.map((item) => ({
          ...item,
          image_url: constructImageUrl(item.image_url)
        }));
        console.log('Cart snapshot loaded:', snapshot);
        return { success: true, data: snapshot };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Cart snapshot failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

export async function submitOrder(items, payMethod, cartHash, sessionPid, wsToken) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const orderItems = items.map(item => ({
        public_id: item.public_id,
        qty: item.qty
      }));
      
      const url = `${baseUrl}/orders`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wsToken}`
        },
        body: JSON.stringify({
          session_pid: sessionPid,
          items: orderItems,
          pay_method: payMethod,
          cart_hash: cartHash
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Order submitted successfully:', result);
        return { success: true, data: result };
      } else {
        const error = await response.json();
        if (error.code === 'cart_mismatch') {
          return { success: false, cartMismatch: true, cartSnapshot: error.cart_snapshot };
        }
        throw new Error(error.detail);
      }
    } catch (error) {
      console.log(`Order submission failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
} 