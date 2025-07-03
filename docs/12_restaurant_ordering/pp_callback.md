# PetPooja Callback Implementation Plan

## Overview
Implement a callback endpoint for PetPooja to notify order status updates post successful order relay.

## Implementation Steps

### 1. Database Schema Updates

#### 1.1 Extend Order Status Enum
```python
# Update Order.status enum in schema.py
status = Column(Enum("processing", "confirmed", "food_ready", "failed", "cancelled", name="order_status"), default="processing", nullable=False)
```

### 2. URL Routing Structure

#### 2.1 New Callback Endpoint
```
POST /pp_callback/{restaurant_slug}/
```

### 3. Order Status Mapping

#### 3.1 PetPooja to Internal Status Mapping
```python
PETPOOJA_STATUS_MAPPING = {
    "-1": "cancelled",     # Cancelled
    "1": "confirmed",      # Accepted
    "2": "confirmed",      # Accepted  
    "3": "confirmed",      # Accepted
    "5": "food_ready",     # Food Ready
    # Skip 4 (dispatch), 10 (delivered) - not relevant for dine-in
}
```

#### 3.2 Timestamp Updates
- `confirmed_at`: Set when status changes to "confirmed"
- `failed_at`: Set when status changes to "failed" or "cancelled"

### 4. Implementation Components

#### 4.1 Restaurant Lookup Service
- Extract restaurant slug from URL path parameter
- Find restaurant by slug

#### 4.2 Order Update Service
- Find order by public_id and restaurant
- Map PetPooja status to internal status
- Update order status and timestamps
- Store full callback data in pos_response

#### 4.3 Error Handling
- 404: Restaurant or order not found
- 400: Invalid status or malformed request
- 500: Internal server error

### 5. Security Considerations

#### 5.1 Order ID Privacy
- Order IDs are private and provide sufficient security
- Only valid order IDs can update order status

#### 5.2 Validation
- Validate restaurant slug format
- Validate order ID format
- Validate status values against allowed set

#### 5.3 Logging
- Log all callback attempts (success/failure)
- Store audit trail of status changes

### 6. Callback Request Format

#### 6.1 URL Structure
```
POST /pp_callback/{restaurant_slug}/
```

#### 6.2 Expected Payload
```json
{
  "restID": "xxxxxx",
  "orderID": "A-1", 
  "status": "1",
  "cancel_reason": "",
  "minimum_prep_time": 20,
  "minimum_delivery_time": "",
  "rider_name": "",
  "rider_phone_number": "",
  "is_modified": "No"
}
```

#### 6.3 Response Format
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "order_id": "A-1",
  "new_status": "confirmed"
}
```

### 7. File Structure

```
backend/
├── urls/
│   └── petpooja_callback.py          # New callback endpoint
├── services/pos/
│   └── petpooja.py                   # Update with callback logic
├── models/
│   └── schema.py                     # Updated Order enum
└── scripts/
    └── 1_onboard_PP_restaurants.py   # Generate callback keys
```

### 8. Testing Strategy

#### 8.1 Unit Tests
- Authentication validation
- Status mapping logic
- Error handling scenarios

#### 8.2 Integration Tests
- End-to-end callback flow
- Database transaction integrity
- Authentication edge cases

### 9. Deployment Considerations

#### 9.1 Database Migration
- Alter Order status enum to include "food_ready"
- Migrate existing data if needed

#### 9.2 Configuration
- Update callback URL in PetPooja save order requests to include restaurant slug
- URL format: `{base_url}/pp_callback/{restaurant_slug}/`

### 10. Monitoring & Observability

#### 10.1 Metrics
- Callback success/failure rates
- Response times
- Authentication failure rates

#### 10.2 Alerting
- Failed callback notifications
- Authentication breach attempts
- Order status inconsistencies

## Implementation Priority
1. Schema updates (Order enum, POSSystem config)
2. Authentication key generation in onboarding
3. Callback endpoint implementation
4. Error handling and logging
5. Testing and validation
6. Documentation and deployment
