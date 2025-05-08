import useStore from '../store';

// Use the environment variable for the backend URL
const baseURL = process.env.EXPO_PUBLIC_API;
console.log('Connecting to WebSocket at:', baseURL);

/**
 * Initialize WebSocket if sessionId exists, closing old socket first.
 */
export function initializeSocket() {
  const { sessionId, threadId, addMessage, setSocket } = useStore.getState();
  if (!sessionId) return null;
  const old = useStore.getState().socket;
  if (old) {
    old.close();
  }
  const scheme = baseURL.startsWith('https') ? 'wss' : 'ws';
  const host = baseURL.replace(/^https?:\/\//, '');
  const socket = new WebSocket(`${scheme}://${host}/chat?sessionId=${sessionId}&threadId=${threadId}&username=${useStore.getState().user?.name}`);

  socket.onopen = () => console.log('WebSocket connected');
  socket.onclose = () => console.log('WebSocket disconnected');
  socket.onerror = (err) => console.error('WebSocket error:', err);

  socket.addEventListener('message', (event) => {
    console.log('Received message from server:', event.data);
    let data;
    try { data = JSON.parse(event.data); } catch { data = event.data; }
    let msg;
    if (data.blocks) {
      msg = {
        _id: Math.round(Math.random() * 1000000),
        blocks: data.blocks,
        createdAt: new Date(),
        user: { _id: 'assistant', name: 'Aglio AI', avatar: 'https://cdn.aglio.app/avatar.png' },
      };
    } else if (data.message) {
      msg = {
        _id: Math.round(Math.random() * 1000000),
        text: data.message,
        createdAt: new Date(),
        user: { _id: 'assistant', name: 'Aglio AI', avatar: 'https://cdn.aglio.app/avatar.png' },
      };
    }
    if (msg) addMessage(msg);
  });

  setSocket(socket);
  return socket;
}

/**
 * Send a message over the initialized WebSocket.
 */
export function askAglio(payload) {
  const { socket, sessionId, cart, filters, threadId } = useStore.getState();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket is not connected');
    return;
  }
  const fullPayload = { sessionId, threadId, cart, filters, ...payload };
  console.log('Sending message', fullPayload);
  // cart, filters, text: MUST be present
  if (!fullPayload.cart || !fullPayload.filters || !fullPayload.text) {
    console.warn('Missing required fields');
    return;
  }
  socket.send(JSON.stringify(fullPayload));
}

export function sendMessage(msg) {
  useStore.getState().addMessage(msg);
  const { socket, sessionId, cart, filters, threadId } = useStore.getState();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket is not connected');
    return;
  }
  const fullMsg = { sessionId, threadId, cart, filters, ...msg };
  console.log('Sending message', fullMsg);
  socket.send(JSON.stringify(fullMsg));
}