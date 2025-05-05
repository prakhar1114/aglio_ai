import api from './api';

/**
 * Sends feedback for a menu item interaction (shortlist or skip)
 * @param {Object} params - Feedback params
 * @param {string} params.session_id - Session ID
 * @param {number|string} params.item_id - Menu item ID
 * @param {string} params.action - 'shortlist' or 'skip'
 * @returns {Promise<any>} API response
 */
export async function sendFeedback({ session_id, item_id, action }) {
  return api.post('/feedback', { session_id, item_id, action });
}
