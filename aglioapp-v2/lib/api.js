import axios from 'axios';
import useStore from '../store';

const baseURL = process.env.EXPO_PUBLIC_API || 'http://localhost:8000';
export { baseURL };
console.log('Base URL:', baseURL);

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const sessionId = useStore.getState().sessionId;
  if (sessionId) {
    config.headers['x-session-id'] = sessionId;
  }
  return config;
});

export default api;
