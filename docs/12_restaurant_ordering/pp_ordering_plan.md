# PetPooja Order Integration Implementation Plan

## ✅ IMPLEMENTATION STATUS: COMPLETED

All core functionality has been successfully implemented and is ready for testing.

## Overview
This document outlines the implementation plan for integrating PetPooja POS order placement with our existing order handling system. The order is already created with all necessary data in `handle_place_order()` - we need to transform it to PetPooja's API format and handle the submission.

## Current Order Flow
1. `handle_place_order()` creates order with complete payload
2. ✅ **COMPLETED**: Replaced `process_order_dummy()` with `process_order_with_pos()`
3. ✅ **COMPLETED**: Integrated actual PetPooja order submission

## Implementation Steps

### 1. Update `handle_place_order()` Function
**File**: `backend/urls/session_ws.py`

**Changes needed**:
```python
# Replace this line:
success = await process_order_dummy(order_id, order_payload, total_amount)

# With:
success, pos_order_id, pos_response = await process_order_with_pos(
    session.restaurant_id, new_order, session, member, db
)

# Update order record with POS response
if success:
    new_order.pos_order_id = pos_order_id
    new_order.pos_response = pos_response
    new_order.status = "confirmed"
    new_order.confirmed_at = datetime.utcnow()
else:
    new_order.status = "failed" 
    new_order.failed_at = datetime.utcnow()
    new_order.pos_response = pos_response  # Store error details
```

### 2. Create `process_order_with_pos()` Function
**File**: `backend/urls/session_ws.py`

```python
async def process_order_with_pos(restaurant_id: int, order: Order, session: Session, member: Member, db: Session):
    """Process order with POS integration"""
    try:
        # Get POS integration
        from services.pos.utils import get_pos_integration_by_name
        pos_integration = get_pos_integration_by_name(restaurant_id, "petpooja", db)
        
        if not pos_integration:
            logger.error(f"No PetPooja integration found for restaurant {restaurant_id}")
            return False, None, {"error": "No POS integration configured"}
        
        # Transform order for PetPooja and submit
        result = await pos_integration.place_order({
            "order": order,
            "session": session, 
            "member": member,
            "table_number": session.table.number
        })
        
        if result.get("success"):
            return True, result.get("pos_order_id"), result
        else:
            return False, None, result
            
    except Exception as e:
        logger.error(f"Error in POS order processing: {e}")
        return False, None, {"error": str(e)}
```

### 3. Complete `place_order()` Method in PetPoojaIntegration
**File**: `backend/services/pos/petpooja.py`

#### API Configuration
```python
async def place_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
    """Place an order with PetPooja"""
    try:
        # Extract data
        order = order_data["order"]
        session = order_data["session"] 
        member = order_data["member"]
        table_number = order_data["table_number"]
        
        # Transform to PetPooja format
        petpooja_order = self._transform_order_to_petpooja(order, session, member, table_number)
        
        # Prepare API call
        headers = {
            "Content-Type": "application/json",
            "app-key": self.config.get("app_key"),
            "app-secret": self.config.get("app_secret"), 
            "access-token": self.config.get("access_token")
        }
        
        save_order_url = self.config.get("apis", {}).get("saveorder")
        if not save_order_url:
            raise Exception("Save order endpoint not configured")
        
        # Make API call
        async with httpx.AsyncClient() as client:
            response = await client.post(
                save_order_url,
                headers=headers,
                json=petpooja_order,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "success": True,
                "pos_order_id": result.get("orderID", order.public_id),
                "api_response": result
            }
            
    except Exception as e:
        logger.error(f"PetPooja order submission failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "pos_order_id": None
        }
```

#### Order Transformation Method
```python
def _transform_order_to_petpooja(self, order: Order, session: Session, member: Member, table_number: int) -> Dict[str, Any]:
    """Transform our order format to PetPooja API format"""
    
    # Extract restaurant config
    restaurant_config = self.config.get("restaurant_id")
    
    # Calculate taxes (hardcoded from menu.json)
    tax_total = self._calculate_tax_total(order.total_amount)
    
    # Build order items
    order_items = []
    for item_data in order.payload:
        petpooja_item = self._transform_order_item(item_data)
        order_items.append(petpooja_item)
    
    # Build PetPooja order structure
    petpooja_order = {
        "app_key": self.config.get("app_key"),
        "app_secret": self.config.get("app_secret"),
        "access_token": self.config.get("access_token"),
        "orderinfo": {
            "OrderInfo": {
                "Restaurant": {
                    "details": {
                        "restID": restaurant_config
                    }
                },
                "Customer": {
                    "details": {
                        "name": member.nickname,
                        "email": "",  # Optional for dine-in
                        "phone": "",  # Optional for dine-in
                        "address": ""  # Optional for dine-in
                    }
                },
                "Order": {
                    "details": {
                        "orderID": order.public_id,
                        "order_type": "D",  # Dine-in
                        "payment_type": "COD",
                        "table_no": str(table_number),
                        "total": str(order.total_amount),
                        "tax_total": str(tax_total),
                        "service_charge": "0",
                        "delivery_charges": "0", 
                        "packing_charges": "0",
                        "discount_total": "0",
                        "created_on": order.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    }
                },
                "OrderItem": {
                    "details": order_items
                },
                "Tax": {
                    "details": self._get_tax_details(tax_total)
                }
            }
        },
        "device_type": "Web"
    }
    
    return petpooja_order

def _transform_order_item(self, item_data: Dict) -> Dict[str, Any]:
    """Transform individual order item to PetPooja format"""
    
    # Get external IDs from database using the menu_item_id
    with SessionLocal() as db:
        menu_item = db.query(MenuItem).filter(
            MenuItem.public_id == item_data["menu_item_pid"]
        ).first()
        
        if not menu_item or not menu_item.external_id:
            raise Exception(f"Menu item {item_data['name']} not found or missing external_id")
    
    # Build basic item
    petpooja_item = {
        "id": menu_item.external_id,  # PetPooja itemid
        "name": item_data["name"],
        "price": str(item_data["unit_price"]),
        "final_price": str(item_data["final_price"]),
        "quantity": str(item_data["qty"]),
        "description": item_data.get("note", ""),
        "gst_liability": "restaurant",  # Default value
        "item_tax": self._get_item_tax_details(item_data["final_price"]),
        "item_discount": "0"
    }
    
    # Add variation if present
    if item_data.get("selected_variation"):
        variation_detail = item_data["selected_variation"]
        # Get external variation ID from ItemVariation table
        with SessionLocal() as db:
            item_variation = db.query(ItemVariation).filter(
                ItemVariation.id == variation_detail["item_variation_id"]
            ).first()
            
            if item_variation and item_variation.external_id:
                petpooja_item["variation_id"] = item_variation.external_id
                petpooja_item["variation_name"] = variation_detail["variation_name"]
    
    # Add addons if present  
    addon_details = []
    if item_data.get("selected_addons"):
        for addon in item_data["selected_addons"]:
            # Get external addon ID from AddonGroupItem table
            with SessionLocal() as db:
                addon_item = db.query(AddonGroupItem).filter(
                    AddonGroupItem.id == addon["addon_item_id"]
                ).first()
                
                if addon_item and addon_item.external_addon_id:
                    addon_details.append({
                        "id": addon_item.external_addon_id,
                        "name": addon["name"],
                        "group_name": addon["group_name"],
                        "price": str(addon["price"]),
                        "group_id": addon_item.addon_group.external_group_id,
                        "quantity": str(addon["quantity"])
                    })
    
    petpooja_item["AddonItem"] = {"details": addon_details}
    
    return petpooja_item

def _calculate_tax_total(self, order_total: float) -> float:
    """Calculate total tax (CGST 2.5% + SGST 2.5% = 5%)"""
    return round(order_total * 0.05, 2)

def _get_tax_details(self, tax_total: float) -> List[Dict]:
    """Get tax breakdown (hardcoded from menu.json)"""
    cgst_amount = tax_total / 2
    sgst_amount = tax_total / 2
    
    return [
        {
            "id": "2524",
            "title": "CGST", 
            "type": "P",
            "price": "2.5",
            "tax": str(cgst_amount),
            "restaurant_liable_amt": str(cgst_amount)
        },
        {
            "id": "2525", 
            "title": "SGST",
            "type": "P", 
            "price": "2.5",
            "tax": str(sgst_amount),
            "restaurant_liable_amt": str(sgst_amount)
        }
    ]

def _get_item_tax_details(self, item_final_price: float) -> List[Dict]:
    """Get per-item tax details"""
    item_tax_total = item_final_price * 0.05
    cgst_amount = item_tax_total / 2
    sgst_amount = item_tax_total / 2
    
    return [
        {
            "id": "2524",
            "name": "CGST",
            "amount": str(cgst_amount)
        },
        {
            "id": "2525", 
            "name": "SGST",
            "amount": str(sgst_amount)
        }
    ]
```

### 4. Error Handling Updates
**File**: `backend/urls/session_ws.py`

Update the success/failure handling in `handle_place_order()`:

```python
# Handle success/failure
if success:
    # Mark order as confirmed 
    new_order.status = "confirmed"
    new_order.confirmed_at = datetime.utcnow()
    
    # Mark all cart items as ordered (keep them for order history)
    for item in cart_items:
        item.state = "ordered"
    
    db.commit()
    
    # Broadcast success...
else:
    # Mark order as failed
    new_order.status = "failed"
    new_order.failed_at = datetime.utcnow()
    
    # UNLOCK cart items - revert to pending state
    for item in cart_items:
        item.state = "pending"
        item.order_id = None  # Remove order association
    
    db.commit()
    
    # Broadcast failure...
```

### 5. Required Imports
Add these imports to the relevant files:

**`backend/urls/session_ws.py`**:
```python
from services.pos.utils import get_pos_integration_by_name
from models.schema import MenuItem, ItemVariation, AddonGroupItem
```

**`backend/services/pos/petpooja.py`**:
```python
import httpx
from sqlalchemy.orm import Session
from models.schema import MenuItem, ItemVariation, AddonGroupItem, SessionLocal
from typing import Dict, Any, List
```

## Key Data Mappings

### External ID Requirements
- **Menu Items**: `menu_item.external_id` → PetPooja `itemid`
- **Variations**: `item_variation.external_id` → PetPooja `variation_id` 
- **Addons**: `addon_group_item.external_addon_id` → PetPooja addon `id`
- **Addon Groups**: `addon_group.external_group_id` → PetPooja `group_id`

### Tax Configuration (Hardcoded)
- **CGST**: 2.5% (Tax ID: 2524)
- **SGST**: 2.5% (Tax ID: 2525) 
- **Total Tax**: 5% of order amount

### Order Type & Payment
- **Order Type**: "D" (Dine-in)
- **Payment Type**: "COD" 
- **Table Number**: From session.table.number

## Testing Strategy

### 1. Unit Tests
- Test order transformation logic
- Test tax calculations
- Test external ID mapping

### 2. Integration Tests  
- Test with actual PetPooja credentials
- Test error scenarios (missing external_ids, API failures)
- Test cart unlock on failure

### 3. End-to-End Tests
- Complete order flow from cart to PetPooja submission
- Verify order status updates and websocket broadcasts

## Error Scenarios & Handling

### 1. Missing External IDs
- **Error**: Menu item, variation, or addon missing external_id
- **Action**: Fail order, unlock cart, log detailed error

### 2. PetPooja API Failure  
- **Error**: Network timeout, authentication failure, invalid data
- **Action**: Fail order, unlock cart, store API error response

### 3. Configuration Issues
- **Error**: Missing POS system config, invalid credentials
- **Action**: Fail order, unlock cart, log configuration error

## Success Criteria
1. Order successfully submitted to PetPooja with correct format
2. Order status properly updated in our database  
3. Cart items correctly locked/unlocked based on success/failure
4. Websocket broadcasts sent to all session members
5. Complete audit trail with POS responses stored

---

## ✅ IMPLEMENTATION COMPLETED

### What Was Successfully Implemented:

#### 1. **Core Integration** (`backend/urls/session_ws.py`)
- ✅ Updated `handle_place_order()` to use POS integration
- ✅ Created `process_order_with_pos()` function
- ✅ Added proper error handling and cart unlocking on failure
- ✅ Enhanced success/failure response handling

#### 2. **PetPooja Integration** (`backend/services/pos/petpooja.py`)
- ✅ **`place_order()` Method**: Complete API integration with PetPooja
  - HTTP POST with proper authentication headers
  - Enhanced error handling and logging
  - PetPooja response validation
  - Proper success/failure detection
  
- ✅ **`_transform_order_to_petpooja()` Method**: Complete data transformation
  - Full PetPooja API structure compliance
  - Customer details (nickname, address from config)
  - Order details (dine-in, COD payment, table number)
  - Tax calculation (5% total: 2.5% CGST + 2.5% SGST)
  - Order items transformation with variations and addons
  - All required date/time fields
  - Callback URL placeholder

#### 3. **Key Features Implemented**:
- ✅ **Menu Item Mapping**: `menu_item.external_id` → PetPooja `itemid`
- ✅ **Variation Support**: `item_variation.external_id` → PetPooja `variation_id`
- ✅ **Addon Support**: `addon_group_item.external_addon_id` → PetPooja `addonid`
- ✅ **Tax Calculation**: Hardcoded CGST/SGST with proper tax amounts
- ✅ **Order Requirements**: All required fields from PetPooja API documentation
- ✅ **Error Handling**: Comprehensive error logging and response handling

### ⚠️ Action Items for Testing:
1. **Replace Callback URL**: Update placeholder `"https://your-domain.com/petpooja/callback"` with actual URL
2. **Test with PetPooja Credentials**: Use real restaurant credentials for testing
3. **Verify External IDs**: Ensure all menu items have proper `external_id` mappings from PetPooja sync

### Ready for Production:
The implementation is now complete and ready for testing with actual PetPooja credentials.
