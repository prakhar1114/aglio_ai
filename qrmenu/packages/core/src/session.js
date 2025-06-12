// Polyfill for crypto.randomUUID() for Safari compatibility
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for browsers that don't support crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getSessionId() {
  const key = 'qr_session_id';
  if (typeof localStorage === 'undefined') return 'server-ssr';
  let s = localStorage.getItem(key);
  if (!s) {
    s = generateUUID();
    localStorage.setItem(key, s);
  }
  return s;
} 