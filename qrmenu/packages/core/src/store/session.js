import { create } from 'zustand';

// Generate or get device ID from localStorage
const getDeviceId = () => {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
};

// Helper to check if JWT is near expiry
const isTokenNearExpiry = (token, minutes = 15) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    return (exp - now) <= (minutes * 60 * 1000);
  } catch {
    return true;
  }
};

export const useSessionStore = create((set, get) => ({
  // Device ID
  deviceId: getDeviceId(),
  
  // Session state
  sessionPid: null,
  memberPid: null,
  nickname: null,
  isHost: false,
  restaurantName: null,
  tableNumber: null,
  
  // WebSocket state
  wsToken: null,
  wsConnection: null,
  wsStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'error'
  wsRetryCount: 0,
  wsMaxRetries: 5,
  
  // Session members
  members: [], // Array of {member_pid, nickname, is_host}
  
  // Connection status
  connectionStatus: null, // 'open', 'closed', 'disabled', 'error'
  connectionMessage: null,
  
  // Modal state for InformationModal
  modal: {
    isOpen: false,
    type: null, // 'info', 'error', 'warning', 'success'
    title: '',
    message: '',
    actions: [], // Array of {label, action, variant}
  },
  
  // Session management methods
  setSessionData: (data) => set({
    sessionPid: data.session_pid,
    memberPid: data.member_pid,
    nickname: data.nickname,
    isHost: data.is_host,
    restaurantName: data.restaurant_name,
    wsToken: data.ws_token,
    tableNumber: data.table_number,
  }),
  
  updateNickname: (newNickname) => set({ nickname: newNickname }),
  
  setTableNumber: (tableNumber) => set({ tableNumber }),
  
  setConnectionStatus: (status, message = null) => set({
    connectionStatus: status,
    connectionMessage: message,
  }),
  
  // WebSocket methods
  setWsStatus: (status) => set({ wsStatus: status }),
  
  setWsConnection: (connection) => set({ wsConnection: connection }),
  
  setWsToken: (token) => {
    set({ wsToken: token });
    // Store in sessionStorage
    if (token) {
      sessionStorage.setItem('ws_token', token);
    } else {
      sessionStorage.removeItem('ws_token');
    }
  },
  
  incrementRetryCount: () => set((state) => ({ 
    wsRetryCount: state.wsRetryCount + 1 
  })),
  
  resetRetryCount: () => set({ wsRetryCount: 0 }),
  
  // Members management
  updateMembers: (memberData) => set((state) => {
    const existingIndex = state.members.findIndex(
      m => m.member_pid === memberData.member_pid
    );
    
    let newMembers;
    if (existingIndex >= 0) {
      // Update existing member
      newMembers = [...state.members];
      newMembers[existingIndex] = memberData;
    } else {
      // Add new member
      newMembers = [...state.members, memberData];
    }
    
    return { members: newMembers };
  }),
  
  removeMember: (memberPid) => set((state) => ({
    members: state.members.filter(m => m.member_pid !== memberPid)
  })),
  
  clearMembers: () => set({ members: [] }),
  
  // Modal methods
  showModal: (config) => set({
    modal: {
      isOpen: true,
      type: config.type || 'info',
      title: config.title || '',
      message: config.message || '',
      actions: config.actions || [],
    }
  }),
  
  hideModal: () => set({
    modal: {
      isOpen: false,
      type: null,
      title: '',
      message: '',
      actions: [],
    }
  }),
  
  // Utility methods
  isConnected: () => {
    const state = get();
    return state.wsStatus === 'connected' && state.connectionStatus === 'open';
  },
  
  needsTokenRefresh: () => {
    const state = get();
    return state.wsToken && isTokenNearExpiry(state.wsToken, 15);
  },
  
  // Session persistence
  loadPersistedSession: () => {
    const sessionPid = sessionStorage.getItem('session_pid');
    const memberPid = sessionStorage.getItem('member_pid');
    const nickname = sessionStorage.getItem('nickname');
    const isHost = sessionStorage.getItem('is_host') === 'true';
    const restaurantName = sessionStorage.getItem('restaurant_name');
    const wsToken = sessionStorage.getItem('ws_token');
    const tableNumber = sessionStorage.getItem('table_number');
    
    if (sessionPid && memberPid && wsToken) {
      set({
        sessionPid,
        memberPid,
        nickname,
        isHost,
        restaurantName,
        wsToken,
        tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
      });
      return true;
    }
    return false;
  },
  
  persistSession: () => {
    const state = get();
    if (state.sessionPid) {
      sessionStorage.setItem('session_pid', state.sessionPid);
      sessionStorage.setItem('member_pid', state.memberPid);
      sessionStorage.setItem('nickname', state.nickname);
      sessionStorage.setItem('is_host', state.isHost.toString());
      sessionStorage.setItem('restaurant_name', state.restaurantName || '');
      sessionStorage.setItem('table_number', state.tableNumber ? state.tableNumber.toString() : '');
      if (state.wsToken) {
        sessionStorage.setItem('ws_token', state.wsToken);
      }
    }
  },
  
  clearSession: () => {
    // Clear state
    set({
      sessionPid: null,
      memberPid: null,
      nickname: null,
      isHost: false,
      restaurantName: null,
      wsToken: null,
      wsConnection: null,
      wsStatus: 'disconnected',
      wsRetryCount: 0,
      members: [],
      connectionStatus: null,
      connectionMessage: null,
    });
    
    // Clear sessionStorage
    sessionStorage.removeItem('session_pid');
    sessionStorage.removeItem('member_pid');
    sessionStorage.removeItem('nickname');
    sessionStorage.removeItem('is_host');
    sessionStorage.removeItem('restaurant_name');
    sessionStorage.removeItem('table_number');
    sessionStorage.removeItem('ws_token');
  },
})); 