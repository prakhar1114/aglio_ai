import Cookies from 'js-cookie';
import uuid from 'react-native-uuid';

export function getOrCreateSessionId() {
  let sid = null;
  if (typeof window !== 'undefined') {
    sid = Cookies.get('sessionId');
    if (!sid) {
      sid = uuid.v4();
      Cookies.set('sessionId', sid, { expires: 30 });
    }
    return sid;
  } else {
    // fallback for native
    return uuid.v4();
  }
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
