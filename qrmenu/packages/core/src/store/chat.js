import { create } from 'zustand';
import { getAIResponse } from '../utils/aiResponses.js';
import { generateShortId } from '../utils/general.js';
import { useSessionStore } from './session.js';


export const useChatStore = create((set, get) => ({
  // Chat messages for the shared group chat
  messages: [
    {
      id: generateShortId(),
      type: 'ai',
      sender: 'AI Waiter',
      content: "👋 Welcome! I'm your AI Waiter. How can I help you with your order today?",
      timestamp: Date.now()
    },
    {
      id: generateShortId(),
      type: 'ai',
      sender: 'AI Waiter',
      blocks: [
        {
          type: 'quick_replies',
          options: [
            "Most Popular",
            "Chef's Recommendations",
            "A Combo Meal"
          ]
        }
      ],
    }
  ],
  
  // Track only optimistic (pending) message IDs - this stays small and gets cleared
  optimisticMessageIds: new Set(),
  
  // UI states
  isDrawerOpen: false,
  isTyping: false,
  
  // Notification flag for unread inbound messages (not persisted)
  hasUnreadMessages: false,
  
  // Thread context for conversation continuity
  threadId: null,
  
  // Message management
  addMessage: (message) => {
    set((state) => {
      const messageId = message.id || generateShortId();
      
      // Check if message already exists (prevent duplicates)
      const existingMessageIndex = state.messages.findIndex(msg => msg.id === messageId);
      if (existingMessageIndex !== -1) {
        // Message already exists, ignore duplicate
        return state;
      }
      
      const newMessage = {
        ...message,
        id: messageId,
        timestamp: message.timestamp || Date.now()
      };
      
      return {
        messages: [...state.messages, newMessage]
      };
    });
  },
  
  addUserMessage: (content, senderName, messageId) => {
    const message = {
      id: messageId,
      type: 'user',
      sender: senderName,
      content
    };
    get().addMessage(message);
    return message;
  },
  
  
  // Typing indicators
  setTyping: (isTyping) => set({ isTyping }),
  
  // Drawer controls
  openDrawer: () => set({ isDrawerOpen: true, hasUnreadMessages: false }),
  closeDrawer: () => set({ isDrawerOpen: false, hasUnreadMessages: false }),
  
  // Thread management
  setThreadId: (threadId) => set({ threadId }),
  generateThreadId: () => {
    const newThreadId = generateShortId();
    set({ threadId: newThreadId });
    return newThreadId;
  },
  
  // Send message via WebSocket (Phase 1 implementation)
  sendMessage: async (content, senderName, extraContext = null) => {
    const threadId = get().threadId || get().generateThreadId();
    
    // Generate unique message ID for optimistic update
    const messageId = generateShortId();
    
    // Add user message immediately (optimistic update)
    const userMessage = get().addUserMessage(content, senderName, messageId);
    
    // Mark this message as optimistic (pending confirmation)
    set((state) => ({
      optimisticMessageIds: new Set([...state.optimisticMessageIds, messageId])
    }));
    
    // Show typing indicator
    get().setTyping(true);
    
    // Import here to avoid circular dependency
    const { sendChatMessage } = await import('../connection.js');
    
    // Send message via WebSocket with message ID
    sendChatMessage(content, senderName, threadId, messageId, extraContext);
    
    return userMessage;
  },
  
  // Quick action to send message and open drawer
  sendMessageAndOpenDrawer: (content, senderName, extraContext = null) => {
    get().openDrawer();
    return get().sendMessage(content, senderName, extraContext);
  },
  
  // Clear chat history
  clearMessages: () => {
    set({ 
      messages: [
        {
          id: generateShortId(),
          type: 'ai',
          sender: 'AI Waiter',
          content: "👋 Welcome! I'm your AI Waiter. How can I help you with your order today?",
          timestamp: Date.now()
        }
      ],
      optimisticMessageIds: new Set(),
      threadId: null
    });
  },
  
  // Get conversation context for AI (useful for Phase 4)
  getConversationContext: () => {
    const messages = get().messages;
    return messages.slice(-10); // Last 10 messages for context
  },
  
  // Message utilities
  getMessageCount: () => get().messages.length,
  getLastMessage: () => {
    const messages = get().messages;
    return messages[messages.length - 1];
  },
  
  // Helper to check if a message is optimistic (pending)
  isMessageOptimistic: (messageId) => {
    return get().optimisticMessageIds.has(messageId);
  },
  
  // WebSocket integration methods (Phase 1 implementation)
  handleWebSocketMessage: (data) => {
    const sessionNickname = useSessionStore.getState().nickname;
    switch (data.type) {
      case 'chat_user_message':
        // User message confirmed by server - remove from optimistic set
        console.log('Adding user message from broadcast:', data);
        
        set((state) => {
          const newOptimisticIds = new Set(state.optimisticMessageIds);
          newOptimisticIds.delete(data.message_id);
          return { optimisticMessageIds: newOptimisticIds };
        });
        
        get().addMessage({
          id: data.message_id,
          type: 'user',
          sender: data.sender_name,
          content: data.message,
          thread_id: data.thread_id
        });
        // Mark unread if drawer closed & message from another user
        if (!get().isDrawerOpen && data.sender_name !== sessionNickname) {
          set({ hasUnreadMessages: true });
        }
        break;
        
      case 'chat_response':
        // AI response received
        console.log('Adding AI response:', data);
        get().addMessage({
          id: data.message_id,
          type: 'ai',
          sender: 'AI Waiter',
          blocks: data.blocks,
          thread_id: data.thread_id
        });
        get().setTyping(false);
        // Mark unread if drawer closed
        if (!get().isDrawerOpen) {
          set({ hasUnreadMessages: true });
        }
        break;
        
      default:
        console.log('Unknown chat message type:', data.type);
    }
  }
})); 