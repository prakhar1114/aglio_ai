import Cookies from 'js-cookie';
import uuid from 'react-native-uuid';

export function getSessionId() {
  let sid = null;
  if (typeof window !== 'undefined') {
    sid = Cookies.get('sessionId');
  } 
  return sid;
}

export function createSession() {
  const sid = uuid.v4();
  setSessionIdCookie(sid);
  return sid;
}


export function setSessionIdCookie(id) {
  if (typeof window !== 'undefined') {
    Cookies.set('sessionId', id, { expires: 30 });
  }
}

export function getFiltersCookie() {
  if (typeof window !== 'undefined') {
    const raw = Cookies.get('filters');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
  }
  return {};
}

export function setFiltersCookie(filters) {
  if (typeof window !== 'undefined') {
    Cookies.set('filters', JSON.stringify(filters), { expires: 30 });
  }
}

// set user details cookie
export function setUserCookie(user) {
  if (typeof window !== 'undefined') {
    Cookies.set('user', JSON.stringify(user), { expires: 30 });
  }
}

export function getUserCookie() {
  if (typeof window !== 'undefined') {
    const raw = Cookies.get('user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null
}

/**
 * Clear all cookies (sessionId, filters, user)
 */
export function clearCookies() {
  if (typeof window !== 'undefined') {
    Cookies.remove('sessionId');
    Cookies.remove('filters');
    Cookies.remove('user');
  }
}