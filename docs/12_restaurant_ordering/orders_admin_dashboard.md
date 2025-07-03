# Orders Admin Dashboard Implementation

## Overview
This feature adds real-time order notifications to the admin dashboard, allowing restaurant staff to be notified immediately when customers place orders and acknowledge them.

## Feature Requirements

### 1. Order Notifications
- **Trigger**: Send notifications only for **confirmed** orders (status = "confirmed")
- **Channel**: Use existing admin WebSocket infrastructure
- **Display**: Show in existing "Waiter Requests" panel (no separate panel)
- **Data**: Include full order details and table number (no members or total shown in notification)

### 2. Staff Acknowledgment
- **Action**: Simple acknowledgment button in the waiter requests panel
- **Persistence**: No database storage needed - just WebSocket message
- **Cleanup**: Acknowledged notifications disappear immediately from panel

### 3. Enhanced Session Info
- **Scope**: Show customizations for both cart items AND order history items
- **Details**: Selected variations, addons, quantities, prices (similar to cart snapshot)
- **Access**: Via "Get Session Info" modal in admin dashboard

## Technical Implementation

### Backend Changes

#### 1. Session WebSocket (`backend/urls/session_ws.py`)
- Modify `handle_place_order()` function
- After successful order confirmation, broadcast to admin dashboard
- Message type: `"order_notification"`
- Include: order details, table number, timestamp

#### 2. Admin Dashboard API (`backend/urls/admin/dashboard.py`)
- Enhance `get_session_details()` function  
- Add detailed customization data similar to `get_cart_snapshot()`
- Include variations, addons for both cart items and order items

#### 3. Dashboard WebSocket (`backend/urls/admin/dashboard_ws.py`)
- Add message handler for order acknowledgments
- Message type: `"acknowledge_order"`
- Broadcast acknowledgment to remove notification from all admin clients

### Frontend Changes

#### 1. Dashboard JavaScript (`backend/urls/admin/static/dashboard.js`)
- Extend waiter requests handling to support order notifications
- Add order acknowledgment functionality
- Enhanced session info modal rendering with customization details
- Same notification sound for orders

#### 2. Dashboard Template (`backend/urls/admin/templates/admin/partials/grid.html`)
- No changes needed (uses existing waiter requests panel)

### Visual Design

#### Order Notification Styling
- **Color**: Purple (#8B5CF6) badge to distinguish from orange waiter calls
- **Icon**: 🍽️ (plate) or 📋 (clipboard) for orders
- **Label**: "New Order"
- **Layout**: Same structure as waiter requests

```html
<div class="request-card new-order">
    <div class="request-header">
        <div class="request-type-badge new-order">
            <span class="request-icon">🍽️</span>
            <span class="request-type-text">New Order</span>
        </div>
        <div class="request-time">Just now</div>
    </div>
    <div class="request-body">
        <div class="table-info">
            <div class="table-details">
                <span class="table-label">Table 5</span>
                <span class="order-id">Order #123</span>
            </div>
        </div>
        <button class="acknowledge-btn" onclick="dashboard.acknowledgeOrder('order_123')">
            ✓ Acknowledge
        </button>
    </div>
</div>
```

## Message Flow

### 1. Order Placement Flow
```
Customer places order → POS integration → Order confirmed → 
Admin WebSocket notification → Dashboard updates → Sound notification
```

### 2. Acknowledgment Flow
```
Staff clicks acknowledge → WebSocket message → 
Remove notification from all admin clients
```

### 3. Session Info Flow
```
Staff clicks "Get Session Info" → API call with enhanced data → 
Modal displays with full customization details
```

## WebSocket Message Formats

### Order Notification Message
```json
{
    "type": "order_notification",
    "order": {
        "id": "123",
        "order_number": 123,
        "table_id": 5,
        "table_number": 5,
        "timestamp": "2024-01-15T10:30:00Z",
        "items": [
            {
                "name": "Margherita Pizza",
                "qty": 2,
                "note": "Extra cheese",
                "selected_variation": {
                    "variation_name": "Large",
                    "price": 450.0
                },
                "selected_addons": [
                    {
                        "name": "Extra Cheese",
                        "quantity": 1,
                        "price": 50.0
                    }
                ]
            }
        ]
    }
}
```

### Acknowledgment Message
```json
{
    "action": "acknowledge_order",
    "order_id": "123"
}
```

### Acknowledgment Broadcast
```json
{
    "type": "order_acknowledged",
    "order_id": "123"
}
```

## Enhanced Session Info Response

### Additional Fields Added
- **Cart Items**: Full customization details (variations, addons)
- **Order Items**: Historical order details with customizations
- **Pricing**: Breakdown of base price + variations + addons

### Example Enhanced Response
```json
{
    "cart_items": [
        {
            "menu_item_name": "Margherita Pizza",
            "qty": 1,
            "note": "Extra spicy",
            "selected_variation": {
                "variation_name": "Large",
                "group_name": "Size",
                "price": 450.0
            },
            "selected_addons": [
                {
                    "name": "Extra Cheese",
                    "addon_group_name": "Cheese Options",
                    "quantity": 1,
                    "price": 50.0,
                    "total_price": 50.0
                }
            ],
            "final_price": 500.0
        }
    ],
    "orders": [
        {
            "order_id": "123",
            "items": [
                // Same detailed structure as cart items
            ]
        }
    ]
}
```

## CSS Styling

### Order Notification Styles
```css
.request-card.new-order {
    border-left: 4px solid #8B5CF6;
}

.request-type-badge.new-order {
    background-color: #8B5CF6;
    color: white;
}

.acknowledge-btn {
    background-color: #10B981;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
}

.acknowledge-btn:hover {
    background-color: #059669;
}
```

## Benefits

1. **Real-time Awareness**: Staff immediately know when orders are placed
2. **Unified Interface**: Orders and waiter requests in same panel
3. **Detailed Visibility**: Full order customization details available
4. **Simple Workflow**: Quick acknowledgment without complex state management
5. **Consistent UX**: Reuses existing notification patterns and styling

