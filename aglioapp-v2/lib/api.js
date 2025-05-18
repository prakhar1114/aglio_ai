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

export const generateImageUrl = (path) => {
    if (path) return `${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
    return null;
}

/**
 * Fetch featured dishes and add them to the messages
 */
export const fetchFeaturedDishes = async () => {
  try {
    const response = await api.get('/featured');
    if (response.data && response.data.blocks) {
      // const msg = {
      //   _id: Math.round(Math.random() * 1000000),
      //   blocks: response.data.blocks,
      //   createdAt: new Date(),
      //   user: { _id: 'assistant', name: 'Aglio AI', avatar: 'https://cdn.aglio.app/avatar.png' },
      // };
      // useStore.getState().addMessage(msg);
      return response.data;
    }
  } catch (error) {
    console.error('Error fetching featured dishes:', error);
  }
};

/**
 * Fetch previous orders and add them to the messages
 */
export const fetchPreviousOrders = async () => {
  try {
    const response = await api.get('/prev_orders');
    if (response.data && response.data.blocks) {
      // const msg = {
      //   _id: Math.round(Math.random() * 1000000),
      //   blocks: response.data.blocks,
      //   createdAt: new Date(),
      //   user: { _id: 'assistant', name: 'Aglio AI', avatar: 'https://cdn.aglio.app/avatar.png' },
      // };
      // useStore.getState().addMessage(msg);
      return response.data;
    }
  } catch (error) {
    console.error('Error fetching previous orders:', error);
  }
};

/**
 * Add a Browse Menu button to navigate to the Menu screen
 */
export const addBrowseMenuButton = async () => {
  try {
    const msg = {
      _id: Math.round(Math.random() * 1000000),
      blocks: [
        {
          type: 'button_group',
          title: 'Quick Actions',
          options: [
            { text: 'Browse Menu', path: 'Menu' }
          ]
        }
      ],
      createdAt: new Date(),
      user: { _id: 'assistant', name: 'Aglio AI', avatar: 'https://cdn.aglio.app/avatar.png' },
    };
    useStore.getState().addMessage(msg);
  } catch (error) {
    console.error('Error adding browse menu button:', error);
  }
};

/**
 * Fetch upsell recommendations based on cart and filters from the store
 * @returns {Promise<Object>} - The upsell recommendations response
 */
export const fetchUpsellRecommendations = async () => {
  try {
    // Get sessionId, cart, and filters from the store
    const cart = useStore.getState().cart;
    const filters = useStore.getState().filters;
    
    // Extract specific filter properties that the backend expects as query params
    const { veg } = filters || {};
    
    // Simplify cart to only include item_ids and quantities
    const simplifiedCart = cart.map(item => ({
      id: item.id,
      qty: item.qty || 1
    }));
    
    const response = await api.get('/upsell', {
      params: {
        cart: JSON.stringify(simplifiedCart),
        is_veg: veg
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching upsell recommendations:', error);
    return { error: 'Failed to fetch upsell recommendations' };
  }
};