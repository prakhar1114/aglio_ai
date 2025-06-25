# AI Chat Integration Design

## Overview

This document outlines the implementation plan for integrating AI chat functionality with the existing WebSocket infrastructure in the QR Menu system. The chat will use structured blocks (text, carousels, quick replies) and be integrated with cart operations.

## Architecture

### Core Components
- **Frontend**: `AIChatDrawer.jsx` in `/qrmenu/packages/ui/src/components/`
- **Backend**: Enhanced `chat.py` WebSocket endpoint
- **Connection**: Leverage existing `connection.js` WebSocket infrastructure
- **Rendering**: Web-adapted block rendering system based on `blockRenderers.js`

### Key Requirements
- Same WebSocket connection for chat and cart operations
- **Shared group chat** for all table members with "AI Waiter"
- Conversation threading within single session
- Chat history persistence (simple structure)
- Cart integration for adding recommended items
- Block-based AI responses (text, carousels, quick replies, etc.)
- Private mode feature for later implementation based on feedback

## Implementation Phases

### Phase 1: Basic Chat Integration
**Goal**: Get basic text-based chat working with WebSocket

#### Backend Changes:
1. **Modify `connection.js`**:
   - Add chat message types to WebSocket handler
   - Add functions: `sendChatMessage()`, `handleChatResponse()`
   - Update `handleWebSocketMessage()` to handle chat responses

2. **Update WebSocket Message Handling**:
   - Add chat message types to existing session WebSocket
   - Handle `chat_message` and respond with `chat_response`
   - Use existing tenant resolution and authentication
   - Broadcast AI responses to all session members

3. **Session Store Updates**:
   - Add chat-related state: `chatMessages`, `isChatTyping`
   - Add methods: `addChatMessage()`, `setChatTyping()`

#### Frontend Changes:
1. **Update `AIChatDrawer.jsx`**:
   - Remove mock `getAIResponse()` call
   - Use WebSocket connection via `connection.js`
   - Handle only text blocks initially
   - Update UI to show "AI Waiter" branding
   - Display all table members' messages (shared group chat)

#### Testing Criteria:
- [x] Chat drawer opens/closes correctly  
- [x] Text messages sent via WebSocket to all session members
- [x] AI responses with text blocks displayed to everyone
- [x] Chat typing indicators work
- [x] All table members see the same conversation
- [x] No interference with cart operations

#### ✅ Phase 1 Implementation Status:
**Frontend Changes Completed:**
- [x] Created dedicated `chat.js` store with clean API
- [x] Updated `AIChatDrawer.jsx` to use new chat store
- [x] Modified `connection.js` to handle chat WebSocket messages
- [x] Exported `sendChatMessage` function for WebSocket communication
- [x] Updated chat store to use WebSocket instead of mock responses

**Backend Changes Completed:**
- [x] Modified `session_ws.py` to handle `chat_message` type
- [x] Added `handle_chat_message` function with AI integration
- [x] Implemented message broadcasting to all session members
- [x] Integrated with existing AI system (`generate_blocks`)
- [x] Added proper error handling and logging

**Key Features Working:**
- ✅ Shared group chat for all table members
- ✅ Real-time message broadcasting via WebSocket
- ✅ AI responses using existing backend AI system
- ✅ Sender attribution (shows who sent each message)
- ✅ Thread ID support for conversation continuity
- ✅ Clean separation of chat and cart functionality
- ✅ **Optimistic updates** with memory-efficient deduplication
- ✅ **No memory leaks** - only track pending messages
- ✅ **Immutable messages** - no need for status flags
- ✅ **Cross-browser UUID support** with uuid package
- ✅ **Short thread IDs** (6 characters) for performance
- ✅ **Visual feedback** for pending messages (70% opacity)

---

### Phase 2: Block Rendering System
**Goal**: Implement full block rendering for web

#### Backend Changes:
1. **Enhance AI Response**:
   - Ensure all block types are returned properly
   - Add image URL construction for dish cards
   - Test dish_carousal, quick_replies, etc.

#### Frontend Changes:
1. **✅ Created Web Block Components**:
   - ✅ `TextBlock.jsx` - Markdown rendering with basic formatting support
   - ✅ `DishCard.jsx` - Individual dish display with full cart integration and modal preview
   - ✅ `DishCarousel.jsx` - Horizontal scrolling dishes with custom scrollbar styling
   - ✅ `QuickReplies.jsx` - Clickable response chips that disable after use
   - ✅ `BlockRenderer.jsx` - Main block rendering component

2. **✅ Updated `AIChatDrawer.jsx`**:
   - ✅ Replaced simple text rendering with `BlockRenderer`
   - ✅ Handle different message types (user text vs AI blocks)
   - ✅ Styled blocks appropriately for chat interface

3. **✅ Backend Integration**:
   - ✅ Updated `enrich_blocks()` to accept `tenant_id` for proper image URLs
   - ✅ Modified `session_ws.py` to pass restaurant slug
   - ✅ All UI components use `constructImageUrl()` from core package

4. **✅ Styling Complete**:
   - ✅ Responsive design for mobile/desktop
   - ✅ Consistent with existing UI theme
   - ✅ Proper spacing between blocks with 12px gaps

#### Testing Criteria:
- [x] All block types render correctly
- [x] Dish cards display with proper images/info and cart integration
- [x] Quick replies are clickable and send messages
- [x] Carousels scroll horizontally with smooth interaction
- [x] Mobile responsive design works with proper touch support

---

### Phase 3: Cart Integration
**Goal**: Enable adding items to cart from chat recommendations

#### Backend Changes:
1. **Enhance Dish Data**:
   - Ensure dish blocks include all necessary cart data
   - Add proper `menu_item_id` mapping
   - Include price, options, etc.

#### Frontend Changes:
1. **Update `DishCard.jsx`**:
   - Add "Add to Cart" button
   - Integrate with existing `addItemToCart()` from `connection.js`
   - Handle quantity selection
   - Show success feedback

2. **Quick Action Integration**:
   - Quick replies can trigger cart actions
   - Handle responses like "Add Recommended Items"

3. **Cart Status in Chat**:
   - Show mini cart summary in chat header
   - Indicate when items are added successfully

#### Testing Criteria:
- [ ] Items can be added to cart from chat
- [ ] Cart updates reflect in main cart drawer
- [ ] Quantity selection works
- [ ] Success feedback is shown
- [ ] No conflicts with direct cart operations

---

### Phase 4: Chat History & Threading
**Goal**: Persist chat history and implement proper conversation threading

#### Backend Changes:
1. **Simple Chat Storage**:
   - Create `chat_messages` table with fields:
     - `session_id`, `sender_name`, `message_type` (user/ai), `content`, `timestamp`
   - Or use JSON file storage for simplicity initially
   
2. **Chat History Endpoint**:
   - `GET /chat/history?sessionId=x`
   - Returns all messages in session (shared for all members)

3. **Threading Logic**:
   - Pass conversation history to AI system
   - Maintain context within session

#### Frontend Changes:
1. **History Loading**:
   - Load chat history when drawer opens
   - Show loading state while fetching
   - Merge with new messages seamlessly

2. **Message Persistence**:
   - Store messages in session store
   - Maintain scroll position
   - Handle page refresh gracefully

#### Testing Criteria:
- [ ] Chat history loads on drawer open
- [ ] Messages persist through page refresh
- [ ] Conversation context maintained
- [ ] All users in same session see the same shared chat
- [ ] Message sender attribution works correctly
- [ ] Performance acceptable with long conversations

---

### Phase 5: Advanced Features
**Goal**: Polish and advanced functionality

#### Backend Changes:
1. **Enhanced AI Context**:
   - Include current cart state in AI prompts
   - Add user preferences/dietary restrictions
   - Implement better recommendation logic

2. **Message Types**:
   - System messages (item added to cart, etc.)
   - Rich media support
   - Message status indicators

#### Frontend Changes:
1. **UX Improvements**:
   - Message reactions/feedback
   - Smart quick replies based on context
   - Voice input support
   - Better error handling

2. **Integration Features**:
   - Share cart items in chat
   - Chat-based order modifications
   - Group chat coordination (future)

3. **Performance**:
   - Message virtualization for long chats
   - Lazy loading of images
   - Optimized re-renders

#### Testing Criteria:
- [ ] AI provides contextual recommendations
- [ ] Smooth UX with quick responses
- [ ] Error states handled gracefully
- [ ] Performance good with long conversations
- [ ] All features work seamlessly together

---

## Technical Decisions

### WebSocket Message Types
```javascript
// User sends chat message
{
  type: 'chat_message',
  sender_name: 'string', // Display name of table member
  message: 'string',
  thread_id: 'string'
}

// AI response broadcast to all session members
{
  type: 'chat_response', 
  sender_name: 'AI Waiter',
  blocks: [...],
  thread_id: 'string'
}

// User message broadcast to other session members
{
  type: 'chat_user_message',
  sender_name: 'string',
  message: 'string', 
  thread_id: 'string'
}
```

### Block Structure (Web Adaptation)
- **Text Block**: Use `react-markdown` for rich text
- **Dish Card**: Compact card with image, title, price, add button
- **Carousel**: Horizontal scrolling container with touch/mouse support
- **Quick Replies**: Chip-style buttons that trigger new messages

### Chat History Storage (Phase 4)
```sql
-- Simple table structure  
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR,
  sender_name VARCHAR, -- Display name or 'AI Waiter'
  message_type VARCHAR, -- 'user' or 'ai'
  content JSONB, -- text for user, blocks for AI
  created_at TIMESTAMP,
  thread_id VARCHAR
);
```

### User Identification
- Use existing session member system
- Display names from session store
- Shared chat visible to all table members
- Private mode feature planned for future release

## Implementation Priority

1. **Start with Phase 1** - Basic functionality first
2. **Test thoroughly** - Each phase should be fully tested before moving on
3. **User feedback** - Test with real users between phases
4. **Performance monitoring** - Ensure no degradation of existing features

## Success Metrics

- Chat response time < 2 seconds
- Zero conflicts with cart operations  
- Message delivery success rate > 99%
- User engagement with AI recommendations
- Cart conversion rate from chat recommendations

---

## 📋 Phase 1 Implementation Notes

### Message Flow Architecture
```
User sends message → Chat Store (Optimistic) → WebSocket → Backend Handler → AI System → WebSocket Broadcast → All Session Members
```

### Optimistic Update Flow
```
1. User types message → Generate unique messageId
2. Add to messages + add messageId to optimisticMessageIds Set
3. Render with opacity: 70% if ID in optimisticMessageIds
4. Send via WebSocket with messageId
5. Server broadcasts back with same messageId
6. Remove messageId from optimisticMessageIds Set (confirmed)
7. Message renders with full opacity
```

### Clean Architecture Benefits
- **No memory leaks**: Only track small set of pending messages
- **No message mutation**: Messages stay immutable 
- **Efficient lookups**: O(1) optimistic check via Set.has()
- **Auto-cleanup**: optimisticMessageIds Set stays small
- **Cross-browser**: UUID fallback for older browsers

### Key Implementation Details

**Frontend (qrmenu/packages/core):**
- `store/chat.js` - Dedicated chat state management with optimistic Set
- `connection.js` - WebSocket message handling and `sendChatMessage()`
- `AIChatDrawer.jsx` - Updated to use new store with sender attribution

**New Clean Implementation:**
```javascript
// Only track pending messages - no memory leaks!
state = {
  messages: [...],
  optimisticMessageIds: new Set(['abc123']) // Small, auto-clearing
}

// Send message
sendMessage() {
  const messageId = generateShortId();
  addMessage({id: messageId, ...});
  optimisticMessageIds.add(messageId); // Mark as pending
  sendWebSocket(messageId);
}

// Server confirms
handleConfirmation(messageId) {
  optimisticMessageIds.delete(messageId); // Clear pending
}

// Render
<div className={isMessageOptimistic(id) ? 'opacity-70' : ''}>
```

**Backend (backend/urls/):**
- `session_ws.py` - Enhanced WebSocket handler with chat support
- Uses existing AI system from `recommender/ai.py`
- Broadcasts messages to all session members via `connection_manager`

### Testing the Implementation

1. **Open multiple browser tabs** with same session URL
2. **Send chat messages** from different tabs 
3. **Verify all tabs see messages** in real-time
4. **Check AI responses** appear for all users
5. **Confirm sender attribution** shows correct names

### Ready for Phase 2

Phase 1 provides the foundation for:
- ✅ Real-time shared group chat
- ✅ WebSocket-based AI integration  
- ✅ Clean architecture separation
- ✅ Thread support for conversation continuity

**Next:** Phase 2 will add rich block rendering (carousels, quick replies, dish cards)
