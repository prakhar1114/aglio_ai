# Frontend Tasks - Auto Ordering System

## Phase 1: Foundation & Table Session Management

### Task 1.1: Update BottomBar Navigation
- **File**: `qrmenu/packages/ui/src/components/BottomBar.jsx`
- **Goal**: Rename "My Orders" to "My Table" and show table session info
- **Changes**:
  - Change button text from "My Orders" to "My Table"
  - Update `onMyOrdersOpen` prop to `onMyTableOpen`
  - Show table number badge when session is active
- **Dependencies**: None
- **Estimate**: 2 hours

### Task 1.2: Create Table Session Store
- **File**: `qrmenu/packages/core/src/store/tableSession.js`
- **Goal**: Manage table session state and WebSocket connection
- **Features**:
  - Store sessionId, table number, restaurant name
  - Track session state (active, closed, expired)
  - Manage members list and their nicknames
  - Handle WebSocket connection lifecycle
- **Dependencies**: None
- **Estimate**: 4 hours

### Task 1.3: Implement QR Code Detection & Session Init
- **File**: `qrmenu/packages/ui/src/screens/MenuScreen.jsx`
- **Goal**: Extract table info from URL and initialize session
- **Features**:
  - Parse table_id and restaurant from URL parameters
  - Call `/is_open` API to validate restaurant status
  - Handle restaurant closed/table disabled states
  - Call `/table_session` to create/join session
- **Dependencies**: Task 1.2
- **Estimate**: 3 hours

## Phase 2: WebSocket Communication

### Task 2.1: WebSocket Authentication Setup
- **File**: `qrmenu/packages/core/src/session.js`
- **Goal**: Implement JWT-based WebSocket authentication
- **Features**:
  - Store and manage `ws_token` in sessionStorage
  - Handle token refresh before expiry
  - Reconnection logic with authentication
- **Dependencies**: Task 1.2
- **Estimate**: 3 hours

### Task 2.2: WebSocket Event Handlers
- **File**: `qrmenu/packages/core/src/store/tableSession.js`
- **Goal**: Handle real-time events from server
- **Events to handle**:
  - `member_join` - Update members list
  - `cart_update` - Sync cart changes
  - `order_fired` - Show order confirmation
  - `session_closed` - Handle session end
- **Dependencies**: Task 2.1
- **Estimate**: 4 hours

## Phase 3: Multi-User Cart Management

### Task 3.1: Enhanced Cart Store for Multi-User
- **File**: `qrmenu/packages/core/src/store/cart.js`
- **Goal**: Support member-specific cart items and real-time sync
- **Features**:
  - Associate cart items with member IDs
  - Handle optimistic updates with conflict resolution
  - Implement version-based concurrency control
  - Send `cart_mutate` messages via WebSocket
- **Dependencies**: Task 2.2
- **Estimate**: 6 hours

### Task 3.2: Member Management Interface
- **File**: `qrmenu/packages/ui/src/components/MembersList.jsx`
- **Goal**: Show active members and allow nickname changes
- **Features**:
  - Display list of session members
  - Inline nickname editing for current user
  - Visual indicators for who added what items
- **Dependencies**: Task 1.2, Task 2.2
- **Estimate**: 3 hours

### Task 3.3: Member-Aware Cart Display
- **File**: `qrmenu/packages/ui/src/components/CartDrawer.jsx`
- **Goal**: Show cart items grouped by member
- **Features**:
  - Group cart items by member
  - Allow editing only own items
  - Show member nicknames with their items
  - Visual distinction between own and others' items
- **Dependencies**: Task 3.1, Task 3.2
- **Estimate**: 4 hours

## Phase 4: Table Session Interface

### Task 4.1: My Table Drawer Component
- **File**: `qrmenu/packages/ui/src/components/MyTableDrawer.jsx`
- **Goal**: Show table session details and activity
- **Features**:
  - Display "Table Number: X" at top
  - Show "X members joined" count
  - Display "Session expiring in Y minutes" timer
  - List all orders placed by the table
  - Show member activity feed (join events, orders)
- **Dependencies**: Task 1.2, Task 3.2
- **Estimate**: 5 hours

### Task 4.2: Session Timer & Auto-Expiry Warning
- **File**: `qrmenu/packages/ui/src/components/SessionTimer.jsx`
- **Goal**: Show countdown and warn before auto-expiry
- **Features**:
  - Real-time countdown display
  - Warning at 10 minutes remaining
  - Auto-refresh on user activity
- **Dependencies**: Task 1.2
- **Estimate**: 2 hours

## Phase 5: Order Placement Flow

### Task 5.1: Daily Pass Validation Modal
- **File**: `qrmenu/packages/ui/src/components/DailyPassModal.jsx`
- **Goal**: Handle daily password requirement
- **Features**:
  - Modal popup for password entry
  - Call `/session/{id}/validate_pass` API
  - Block cart operations until validated
  - Store validation state in session
- **Dependencies**: Task 1.2
- **Estimate**: 3 hours

### Task 5.2: Enhanced Order Placement
- **File**: `qrmenu/packages/ui/src/components/OrderConfirmationSheet.jsx`
- **Goal**: Place group orders with proper validation
- **Features**:
  - Show combined cart from all members
  - Calculate cart hash for idempotency
  - Call `/orders` API with session context
  - Handle conflicts and retry logic
  - Show POS ticket number on success
- **Dependencies**: Task 3.1, Task 5.1
- **Estimate**: 4 hours

### Task 5.3: Order Status Tracking
- **File**: `qrmenu/packages/ui/src/components/OrderStatusCard.jsx`
- **Goal**: Show real-time order status from kitchen
- **Features**:
  - Display order states (Sent, Cooking, Ready)
  - Show estimated time if available
  - Handle multiple concurrent orders
- **Dependencies**: Task 5.2, Task 2.2
- **Estimate**: 3 hours

## Phase 6: Error Handling & Polish

### Task 6.1: Connection Status Indicator
- **File**: `qrmenu/packages/ui/src/components/ConnectionStatus.jsx`
- **Goal**: Show WebSocket connection health
- **Features**:
  - Green/red indicator for connection status
  - Reconnection attempts display
  - Offline mode messaging
- **Dependencies**: Task 2.1
- **Estimate**: 2 hours

### Task 6.2: Conflict Resolution UI
- **File**: `qrmenu/packages/ui/src/components/ConflictDialog.jsx`
- **Goal**: Handle cart conflicts gracefully
- **Features**:
  - Show conflicting cart state
  - Options to retry or refresh
  - Clear error messaging
- **Dependencies**: Task 3.1
- **Estimate**: 3 hours

### Task 6.3: Session Recovery Logic
- **File**: `qrmenu/packages/core/src/utils/sessionRecovery.js`
- **Goal**: Handle page refreshes and rejoining sessions
- **Features**:
  - Detect existing session on page load
  - Restore WebSocket connection
  - Sync cart state via `/cart_snapshot`
  - Handle stale sessions (>90 min)
- **Dependencies**: Task 1.2, Task 2.1
- **Estimate**: 4 hours

## Phase 7: Mobile Optimization

### Task 7.1: Touch-Friendly Interactions
- **Files**: Various component files
- **Goal**: Optimize for mobile touch interactions
- **Features**:
  - Larger touch targets for buttons
  - Swipe gestures for drawers
  - Pull-to-refresh for session sync
- **Dependencies**: All previous tasks
- **Estimate**: 3 hours

### Task 7.2: Offline-First Cart
- **File**: `qrmenu/packages/core/src/store/offlineCart.js`
- **Goal**: Allow browsing and cart building without connection
- **Features**:
  - Cache menu data locally
  - Queue cart operations when offline
  - Sync when connection restored
- **Dependencies**: Task 3.1, Task 6.1
- **Estimate**: 5 hours

## Testing & Integration

### Task 8.1: Component Unit Tests
- **Files**: `__tests__/` directories
- **Goal**: Test all new components and stores
- **Coverage**: 80%+ for critical cart and session logic
- **Estimate**: 8 hours

### Task 8.2: E2E Multi-User Flow Tests
- **Files**: `cypress/integration/`
- **Goal**: Test complete multi-user ordering scenario
- **Scenarios**: QR scan, join session, collaborate on cart, place order
- **Estimate**: 6 hours

---

## Total Estimated Time: ~75 hours

## Priority Order:
1. **Phase 1**: Foundation (9 hours)
2. **Phase 2**: WebSocket (7 hours) 
3. **Phase 3**: Multi-user cart (13 hours)
4. **Phase 4**: Table interface (7 hours)
5. **Phase 5**: Order flow (10 hours)
6. **Phase 6**: Error handling (9 hours)
7. **Phase 7**: Mobile optimization (8 hours)
8. **Testing**: (14 hours)

Each task includes specific file paths and clear acceptance criteria for easier tracking and implementation. 