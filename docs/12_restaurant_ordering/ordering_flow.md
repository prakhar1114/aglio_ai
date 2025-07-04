# Restaurant Ordering Flow Documentation

## Overview
This document outlines the complete ordering flow for the QR Menu system, including cart locking, websocket communication, state persistence, and error handling.

## Current State Analysis
- Orders are currently created locally without backend integration
- No cart locking mechanism exists
- Order confirmation is shown immediately without POS validation
- Cart state is not persisted across sessions

## Proposed Ordering Flow

### 1. Frontend Changes

#### A. Cart Store Updates (`qrmenu/packages/core/src/store/cart.js`)
**New State Management:**
- `cartLocked: boolean` - Indicates if cart is locked during order processing
- `pendingOrderId: string | null` - Tracks order being processed
- `orderProcessingStatus: 'idle' | 'processing' | 'confirmed' | 'failed'`

**New Methods:**
- `lockCart()` - Locks cart for all editing operations
- `unlockCart()` - Unlocks cart after order failure
- `setPendingOrder(orderId)` - Sets order being processed
- `clearPendingOrder()` - Clears pending order state

**Modified Methods:**
- `addToCart()` - Check if cart is locked before allowing additions
- `updateCartItem()` - Check if cart is locked before allowing updates
- `removeFromCart()` - Check if cart is locked before allowing removals
- `clearCart()` - Only allow if cart is not locked

#### B. MenuScreen.jsx Updates
**Modified `handleCheckout`:**
```javascript
const handleCheckout = (cartItems, total) => {
  console.log('Placing order via websocket:', { cartItems, total });
  
  // Lock cart immediately
  cartStore.lockCart();
  cartStore.setOrderProcessingStatus('processing');
  
  // Send websocket message to place order
  sendOrderPlacementMessage({
    type: "place_order",
    cart_items: cartItems,
    total: total,
    special_instructions: ""
  });
  
  // Don't show confirmation yet - wait for websocket response
};
```

**New Websocket Handlers:**
- Handle `order_processing` messages
- Handle `order_confirmed` messages  
- Handle `order_failed` messages
- Handle cart lock broadcasts

#### C. CartDrawer.jsx Updates
**State-Aware UI:**
- Show "Pending Confirmation..." when `orderProcessingStatus === 'processing'`
- Disable all cart editing when `cartLocked === true`
- Show retry option when `orderProcessingStatus === 'failed'`
- Gray out add/remove buttons when cart is locked

#### D. OrderConfirmationSheet.jsx Updates
**Backend Integration:**
- Use backend-provided `order_id` instead of local order generation
- Remove local order creation logic
- Display order confirmation only after backend confirms

#### E. MyOrdersDrawer.jsx Updates
**Order State Display:**
- Show order processing status
- Display backend order IDs
- Only show confirmed orders in history

### 2. Backend Changes

#### A. Cart Snapshot API Updates (`backend/urls/cart.py`)
**Enhanced `get_cart_snapshot` Response:**
```json
{
  "items": [...],
  "total": 1250.00,
  "cart_locked": true,
  "pending_order_id": "ORD-12345",
  "order_processing_status": "processing",
  "last_updated": "2024-01-15T10:30:00Z"
}
```

#### B. Websocket Message Handling (`backend/urls/session_ws.py`)
**New Message Type: `place_order`**
```python
async def handle_place_order(websocket, message, member_id, session_pid):
    # 1. Lock cart items to "locked" state
    # 2. Broadcast cart lock to all session members
    # 3. Generate order ID
    # 4. Call dummy POS integration
    # 5. Send confirmation or failure response
```

**Cart Lock Broadcast:**
```json
{
  "type": "cart_locked",
  "locked_by": "member_123",
  "order_id": "ORD-12345",
  "message": "Order is being processed..."
}
```

#### C. Database Schema Updates
**Cart Items State:**
- Update `state` enum to include proper transitions
- `pending` → `locked` → `ordered` (success) or `locked` → `pending` (failure)

**Orders Table:**
- Auto-incrementing order numbers per restaurant
- Backend-generated order IDs
- Order status tracking

#### D. Dummy POS Integration
**Mock Order Processing:**
```python
async def process_order_dummy(order_data):
    # Simulate 3-second processing time
    await asyncio.sleep(3)
    
    # 90% success rate for testing
    if random.random() < 0.9:
        return {"status": "success", "order_id": generate_order_id()}
    else:
        return {"status": "failed", "error": "POS system unavailable"}
```

### 3. Message Protocol

#### Frontend → Backend (Place Order)
```json
{
  "type": "place_order",
  "cart_items": [
    {
      "public_id": "item_123",
      "menu_item_id": 456,
      "qty": 2,
      "note": "Extra spicy"
    }
  ],
  "total": 1250.00,
  "special_instructions": "Table by the window"
}
```

#### Backend → All Session Members (Cart Locked)
```json
{
  "type": "cart_locked",
  "locked_by_member": "member_123",
  "order_id": "ORD-12345",
  "message": "Order is being processed...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Backend → All Session Members (Order Confirmed)
```json
{
  "type": "order_confirmed",
  "order_id": "ORD-12345",
  "message": "Order placed successfully!"
}
```

#### Backend → All Session Members (Order Failed)
```json
{
  "type": "order_failed",
  "order_id": "ORD-12345",
  "error": "POS system unavailable",
  "message": "Order failed. Please try again.",
  "allow_retry": true
}
```

### 4. State Management Flow

#### 4.1 Normal Order Flow
1. **User clicks "Place Order"**
   - Cart locked locally
   - Status set to "processing"
   - Websocket message sent to backend

2. **Backend receives order**
   - Validates session and cart
   - Locks cart items in database
   - Broadcasts cart lock to all session members
   - Calls dummy POS function (3s delay)

3. **All session members receive cart lock**
   - UI updates to show "Order Processing..."
   - Cart editing disabled for everyone

4. **Backend processes order**
   - Generate restaurant-specific order number
   - Create order record in database
   - Update cart items to "ordered" state

5. **Backend responds with confirmation**
   - Broadcasts order confirmation to all members
   - Includes backend order ID

6. **Frontend handles confirmation**
   - Shows OrderConfirmationSheet with backend order data
   - Clears cart
   - Unlocks cart for new orders

#### 4.2 Order Failure Flow
1. **POS system fails**
   - Backend receives failure response
   - Cart items reverted to "pending" state
   - Failure message broadcast to all members

2. **Frontend handles failure**
   - Shows error message with retry option
   - Unlocks cart for editing
   - Allows automatic retry after 2 seconds

#### 4.3 Page Refresh During Order Processing
1. **User refreshes page**
   - `setupConnection()` called
   - `loadCartSnapshot()` fetches current cart state

2. **Cart snapshot includes lock state**
   - `cart_locked: true`
   - `order_processing_status: "processing"`
   - `pending_order_id: "ORD-12345"`

3. **Frontend restores state**
   - Cart locked on UI
   - "Pending Confirmation..." shown
   - Websocket reconnects
   - Continues waiting for order response

### 5. Error Handling Scenarios

#### 5.1 Websocket Disconnection During Order
- Frontend detects websocket disconnection
- Polls cart snapshot every 2 seconds
- Restores order state from snapshot
- Shows "Reconnecting..." message

#### 5.2 Order Timeout (10 seconds)
- Frontend sets 10-second timeout
- If no response received, shows timeout message
- Allows manual retry
- Backend continues processing and updates cart snapshot

#### 5.3 Race Conditions (Multiple Order Attempts)
- First order locks cart for entire session
- Subsequent order attempts blocked at frontend
- Clear error message shown: "Order already being processed"

#### 5.4 Network Issues
- Automatic retry with exponential backoff
- Maximum 3 retry attempts
- Clear error messages for user

### 6. Race Condition Prevention

#### 6.1 Session-Level Cart Locking
- When any member places order, entire session cart is locked
- No new items can be added by any member
- Clear indication of who initiated the order

#### 6.2 Database-Level Constraints
- Cart item state transitions managed at database level
- Prevents invalid state changes
- Ensures data consistency

### 7. Configuration Settings

#### 7.1 Timeouts
- Order processing timeout: 10 seconds
- Websocket reconnection timeout: 5 seconds
- Cart snapshot polling interval: 2 seconds

#### 7.2 Retry Logic
- Maximum retry attempts: 3
- Retry delay: 2 seconds (exponential backoff)
- Auto-retry enabled for failed orders

#### 7.3 Order Management
- Order numbers: Auto-incrementing per restaurant
- Order history: Only successful orders stored
- Order ID format: `ORD-{restaurant_id}-{order_number}`

### 8. UI States and Messages

#### 8.1 Cart States
- **Normal**: "Place Order" (green button)
- **Processing**: "Pending Confirmation..." (gray button, disabled)
- **Failed**: "Retry Order" (orange button)
- **Locked by Others**: "Order Being Processed by [Member Name]" (gray, disabled)

#### 8.2 User Messages
- **Order Processing**: "Your order is being processed..."
- **Order Confirmed**: "Order placed successfully! 🎉"
- **Order Failed**: "Order failed: [reason]. Tap to retry."
- **Cart Locked**: "Order being processed by [Member Name]"
- **Network Issues**: "Connection lost. Reconnecting..."

### 9. Testing Scenarios

#### 9.1 Happy Path
- Single user places order successfully
- Order confirmed within 3 seconds
- Cart cleared and unlocked

#### 9.2 Multi-User Scenarios
- Member A places order, Member B sees locked cart
- Order confirmed, both members see confirmation
- Cart unlocked for new orders

#### 9.3 Failure Scenarios
- POS system fails, order retried successfully
- Network disconnection during order, state restored
- Page refresh during processing, state maintained

#### 9.4 Edge Cases
- Rapid successive order attempts (race condition)
- Long processing times (timeout handling)
- Invalid cart states (error recovery)

### 10. Implementation Priority

#### Phase 1: Core Functionality
1. Cart locking mechanism
2. Websocket order placement
3. Dummy POS integration
4. Basic error handling

#### Phase 2: State Persistence
1. Enhanced cart snapshot API
2. State restoration on refresh
3. Websocket reconnection handling

#### Phase 3: Advanced Features
1. Multi-user coordination
2. Comprehensive error handling
3. Retry mechanisms
4. UI polish

#### Phase 4: Production Ready
1. Real POS integration
2. Performance optimization
3. Monitoring and logging
4. Load testing

