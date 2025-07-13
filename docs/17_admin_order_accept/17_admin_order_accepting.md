# Admin Order Approval Workflow - Design & Implementation Plan

## Overview
Transform the current direct order processing into a manual admin approval workflow where all customer orders must be reviewed and approved by restaurant staff before being sent to POS systems.

## Current vs New Flow

### Current Flow
```
Customer Order → Order Created (status: "processing") → POS Integration OR Admin Notification → Immediate Response
```

### New Flow
```
Customer Order → Order Created (status: "placed") → Customer Notified ("Order Placed") 
→ Admin Review → Admin Action (accept/reject/edit+accept) 
→ POS Integration (if approved) → Final Customer Notification
```

## Detailed Requirements

### 1. Order Status Management
- **"processing"**: Default status when customer places order (existing)
- **"placed"**: Order ready for admin review
- **"confirmed"**: Admin approved and sent to POS
- **"cancelled"**: Admin rejected
- **"failed"**: System/POS integration failure

### 2. Admin Actions
- **Accept**: Approve order as-is, send to POS, notify customer "confirmed"
- **Reject**: Cancel order, notify customer "cancelled"
- **Edit + Accept**: Modify order (add/remove items, change quantities), send to POS, notify customer with updated order details

### 3. Edge Case Handling
- **Concurrent Admin Actions**: Implement order locking mechanism
- **Admin Availability**: Queue orders indefinitely until admin available
- **Customer Cancellation**: Not allowed after order placed
- **POS Failures**: Admin can retry manually
- **Reconnection**: Queue pending orders and send when admin reconnects
- **Full Menu Modifications**: No reconfirmation needed from customer

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Order Model Extensions
```sql
-- No additional columns needed - use existing order structure
-- Order status enum already supports: "processing", "confirmed", "failed"
-- Add new status values: "placed", "cancelled"
```

#### 1.2 Update Order Status Enum
- Keep existing: "processing" (default when order created)
- Add new: "placed" (ready for admin review), "cancelled" (admin rejected)
- Existing: "confirmed" (admin approved), "failed" (system/POS failure)

### Phase 2: Backend WebSocket Updates

#### 2.1 Customer Order Placement (`session_ws.py`)
**File**: `backend/urls/session_ws.py`
**Function**: `handle_place_order`

**Changes**:
1. **Create order with status "processing" (existing)**
2. **Change status to "placed" after creation**
3. **Remove immediate POS integration**
4. **Send customer notification "Order Placed"**
5. **Always queue to admin dashboard**

```python
# New flow in handle_place_order:
1. Validate session/member (existing)
2. Create order with status="processing" (existing logic)
3. Update order status to "placed"
4. Broadcast to customer: {"type": "order_placed", "order": {...}}
5. Queue to admin dashboard: {"type": "pending_order", "order": {...}}
6. NO POS integration at this stage
```

#### 2.2 Admin Dashboard WebSocket (`dashboard_ws.py`)
**File**: `backend/urls/admin/dashboard_ws.py`

**New Actions**:
```python
class DashboardAction(BaseModel):
    action: str
    order_id: Optional[str] = None
    updated_order: Optional[dict] = None  # For edit action
    # ... existing fields
```

**New Action Handlers**:
1. **approve_order**: Lock order, send to POS, notify customer "confirmed"
2. **reject_order**: Lock order, notify customer "cancelled"  
3. **edit_order**: Lock order, update order payload, send to POS, notify customer with updated order
4. **retry_pos**: Retry failed POS integration

#### 2.3 Order Conflict Handling (Simplified Approach)
**What is "Order Locking"?**
- Prevents two admins from editing the same order simultaneously
- Example: Admin A clicks "Edit Order #123", Admin B also clicks "Edit Order #123"
- Without protection: Both could submit changes causing conflicts
- With protection: First admin action wins, second gets "Order already processed" error

**Simplified Implementation:**
```python
async def process_order_action(db, order_id: str, action: str, updated_order=None):
    # 1. Check if order status is still "placed"
    # 2. If yes, process the action (approve/reject/edit)
    # 3. If no, return error "Order already processed"
    # This eliminates need for locking - first action wins
```

#### 2.4 Pending Orders Queue Management
```python
async def send_pending_orders_to_admin(websocket: WebSocket, restaurant_slug: str):
    # Query all orders with status="placed" for this restaurant
    # Send order details, customer info, table info to admin
    # No additional admin_action field needed - status tells the story
```

### Phase 3: POS Integration Updates

#### 3.1 Move POS Integration Post-Approval
**File**: `backend/urls/admin/dashboard_ws.py`

```python
async def process_approved_order(db, order, restaurant):
    # 1. Verify order status is "placed"
    # 2. Update order with any edits (if action was "edit")
    # 3. Send to POS (if configured)
    # 4. Handle POS response
    # 5. Update order status (confirmed/failed)
    # 6. Notify customer and admin dashboard
```

#### 3.2 POS Retry Logic
```python
async def retry_pos_integration(db, order_id: str):
    # Allow infinite retries - no retry count limit
    # Re-attempt POS integration for failed orders
    # Handle success/failure
    # Notify admin dashboard and customer
    # Admin can retry as many times as needed
```

### Phase 4: Frontend Updates

#### 4.1 Customer WebSocket Handlers (`core/src/store/cart.js`)
**New Message Types**:
```javascript
// Handle new order status messages
case 'order_placed':
    // Show "Order Placed, awaiting confirmation" 
    this.orderProcessingStatus = 'placed';
    
case 'order_confirmed':
    // Show "Order Confirmed" + play success sound
    this.orderProcessingStatus = 'confirmed';
    
case 'order_updated':
    // Admin edited order - update cart display
    this.handleOrderUpdate(message.updated_order);
    
case 'order_cancelled':
    // Show "Order Cancelled" 
    this.orderProcessingStatus = 'cancelled';
```

#### 4.2 Admin Dashboard UI (`dashboard.js` & `dashboard.html`)
**New Sections**:
1. **Pending Orders Panel**: List of orders awaiting approval
2. **Order Detail Modal**: Full order view with edit capabilities
3. **Order Actions**: Approve/Reject/Edit buttons
4. **POS Retry Button**: For failed orders

**Order Display**:
```html
<div class="pending-order-card">
    <div class="order-header">
        <span>Order #${order.id}</span>
        <span>Table ${table.number}</span>
        <span>${order.timestamp}</span>
    </div>
    <div class="order-items">
        <!-- List of ordered items -->
    </div>
    <div class="order-actions">
        <button onclick="approveOrder('${order.id}')">Approve</button>
        <button onclick="editOrder('${order.id}')">Edit</button>
        <button onclick="rejectOrder('${order.id}')">Reject</button>
    </div>
</div>
```

### Phase 5: Order Editing Interface

#### 5.1 Admin Order Editor
**Features**:
- Add new menu items to order
- Remove existing items
- Modify quantities
- Real-time total calculation
- Menu item search/browse

#### 5.2 Edit Workflow
```javascript
1. Load order details
2. Fetch restaurant menu for adding items
3. Provide edit interface (add/remove/modify)
4. Calculate new totals
5. Send updated order payload to backend
6. Backend processes edit + sends to POS
7. Customer receives updated order notification
```

### Phase 6: Error Handling & Edge Cases

#### 6.1 Concurrent Admin Protection
```python
# Simplified approach - no locking needed
# First admin action wins, subsequent actions get error
async def handle_admin_action(order_id, action):
    if order.status != "placed":
        return error("Order already processed")
    # Process the action...
```

#### 6.2 Admin Disconnect Handling
```python
# On admin disconnect:
1. No special handling needed (no order locking to release)
2. Pending orders remain in queue for other admins
3. When admin reconnects, send current pending orders
```

#### 6.3 Customer Disconnect Handling
```python
# Orders remain in admin queue even if customer disconnects
# When customer reconnects, send current order status
```

#### 6.4 POS Integration Failures
```python
# On POS failure:
1. Mark order as "failed"
2. Notify admin dashboard with retry option
3. Notify customer of delay
4. Allow admin manual retry
```

### Phase 7: WebSocket Message Specifications

#### 7.1 Customer Messages
```javascript
// Order placed confirmation
{
    "type": "order_placed",
    "order_id": "CHNT_123",
    "message": "Order placed successfully! Awaiting restaurant confirmation.",
    "order": { /* order details */ }
}

// Order confirmed by admin
{
    "type": "order_confirmed", 
    "order_id": "CHNT_123",
    "message": "Order confirmed by restaurant!",
    "order": { /* final order details */ }
}

// Order updated by admin
{
    "type": "order_updated",
    "order_id": "CHNT_123", 
    "message": "Restaurant has updated your order",
    "updated_order": { /* modified order */ },
    "changes_summary": "Added 1x Garlic Bread, Removed 1x Coke"
}

// Order cancelled by admin
{
    "type": "order_cancelled",
    "order_id": "CHNT_123",
    "message": "Order has been cancelled",
    "reason": "Item unavailable"
}
```

#### 7.2 Admin Dashboard Messages
```javascript
// New pending order
{
    "type": "pending_order",
    "order": {
        "id": "CHNT_123",
        "table_id": 5,
        "table_number": "T5",
        "timestamp": "2024-01-15T10:30:00Z",
        "customer_name": "John Doe",
        "items": [ /* order items */ ],
        "total": 850.00,
        "special_instructions": "No onions"
    }
}

// Order action result
{
    "type": "order_action_result",
    "order_id": "CHNT_123",
    "action": "approved", // approved, rejected, edited
    "success": true,
    "pos_response": { /* POS integration response */ }
}

// POS integration failure
{
    "type": "pos_integration_failed",
    "order_id": "CHNT_123", 
    "error": "Connection timeout",
    "retry_available": true
}
```

### Phase 8: Testing Strategy

#### 8.1 Unit Tests
- Order locking mechanism
- Status transitions
- POS integration retry logic
- Order editing calculations

#### 8.2 Integration Tests
- Customer order placement flow
- Admin approval workflow
- WebSocket message broadcasting
- Concurrent admin actions

#### 8.3 E2E Tests
- Complete order lifecycle
- Admin disconnect/reconnect scenarios
- POS failure handling
- Order editing workflows

### Phase 9: Deployment Plan

#### 9.1 Database Migration
1. Run schema updates
2. Migrate existing order statuses
3. Verify data integrity

#### 9.2 Backend Deployment
1. Deploy WebSocket changes
2. Update admin dashboard endpoints
3. Test WebSocket connectivity

#### 9.3 Frontend Deployment
1. Update customer apps
2. Deploy admin dashboard updates
3. Test order flows

#### 9.4 Rollback Plan
- Keep existing order processing as fallback
- Feature flag for admin approval workflow
- Quick rollback to direct POS integration if needed

## Success Metrics
- Order approval response time < 2 minutes average
- Zero lost orders due to admin unavailability
- POS integration retry success rate > 90%
- Customer satisfaction with order confirmation UX

## Future Enhancements
- Auto-approval for trusted customers/VIP tables
- Order approval timeouts with escalation
- Advanced order analytics and reporting
- Mobile admin app for order management

## Simplified Approach Summary

Based on feedback, the implementation has been simplified:

### **Removed Complexity:**
- ❌ Order locking mechanism with admin tracking
- ❌ admin_action field (status field sufficient)
- ❌ locked_by_admin, locked_at columns
- ❌ original_payload backup (edit orders directly)
- ❌ pos_retry_count limit (infinite retries allowed)

### **Clean Order Flow:**
1. **Customer places order** → Status: "processing" → "placed"
2. **Admin sees all orders with status="placed"**
3. **Admin actions**: approve/reject/edit → Status: "confirmed"/"cancelled"/"failed"
4. **Conflict handling**: First action wins, second gets error
5. **POS retry**: Infinite attempts allowed

### **Database Changes:**
- Only need to add "placed" and "cancelled" status values
- No additional columns required
- Use existing order structure

This approach is much cleaner and easier to implement while maintaining all the required functionality.
