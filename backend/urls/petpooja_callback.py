"""
PetPooja Callback Endpoint

Handles order status updates from PetPooja POS system via webhook callbacks.
Maps status values and updates internal order records.
"""

from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.schema import get_db, Restaurant, POSSystem, Order
from config import logger

router = APIRouter(prefix="/pp_callback", tags=["petpooja_callback"])

# PetPooja status mapping for dine-in orders
PETPOOJA_STATUS_MAPPING = {
    "-1": "cancelled",     # Cancelled
    "1": "confirmed",      # Accepted
    "2": "confirmed",      # Accepted  
    "3": "confirmed",      # Accepted
    "5": "food_ready",     # Food Ready
    "10": "delivered",     # Delivered
    "4": "dispatch",       # Dispatch
    # Skip 4 (dispatch), 10 (delivered) - not relevant for dine-in
}

def find_restaurant_by_slug(restaurant_slug: str, db: Session) -> Restaurant:
    """
    Find restaurant by slug.
    
    Args:
        restaurant_slug: Restaurant slug from URL path
        db: Database session
        
    Returns:
        Restaurant: The restaurant instance
        
    Raises:
        HTTPException: If restaurant not found
    """
    restaurant = db.execute(
        select(Restaurant).where(Restaurant.slug == restaurant_slug)
    ).scalar_one_or_none()
    
    if not restaurant:
        logger.warning(f"Restaurant not found for slug: {restaurant_slug}")
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    logger.info(f"Found restaurant {restaurant_slug}")
    return restaurant

def validate_callback_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate PetPooja callback payload format and extract required fields.
    
    Args:
        payload: Raw callback payload from PetPooja
        
    Returns:
        Dict: Validated and cleaned payload
        
    Raises:
        HTTPException: If payload is invalid
    """
    required_fields = ["restID", "orderID", "status"]
    
    # Check required fields
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate status value
    status = str(payload["status"])
    if status not in PETPOOJA_STATUS_MAPPING:
        logger.warning(f"Unknown PetPooja status: {status}")
        # Don't reject unknown statuses, just log them
        # They might be new statuses we haven't mapped yet
    
    return {
        "rest_id": payload["restID"],
        "order_id": payload["orderID"],
        "status": status,
        "cancel_reason": payload.get("cancel_reason", ""),
        "minimum_prep_time": payload.get("minimum_prep_time", ""),
        "minimum_delivery_time": payload.get("minimum_delivery_time", ""),
        "rider_name": payload.get("rider_name", ""),
        "rider_phone_number": payload.get("rider_phone_number", ""),
        "is_modified": payload.get("is_modified", "No")
    }

async def update_order_status(order: Order, new_status: str, callback_data: Dict[str, Any], db: Session) -> str:
    """
    Update order status and related timestamps.
    
    Args:
        order: Order instance to update
        new_status: New internal status
        callback_data: Full callback data for storage
        db: Database session
        
    Returns:
        str: The updated status
    """
    old_status = order.status
    current_time = datetime.utcnow()
    
    # Update status
    # setattr(order, 'status', new_status)
    
    # Update timestamps based on status change
    if new_status == "confirmed" and str(old_status) != "confirmed":
        setattr(order, 'confirmed_at', current_time)
        logger.info(f"Order {order.public_id} confirmed at {current_time}")
        setattr(order, 'status', new_status)
    
    elif new_status in ["failed", "cancelled"] and str(old_status) not in ["failed", "cancelled"]:
        setattr(order, 'failed_at', current_time)
        logger.info(f"Order {order.public_id} failed/cancelled at {current_time}")
        setattr(order, 'status', new_status)
    
    # Store full callback data in pos_response for debugging
    existing_response = getattr(order, 'pos_response', None)
    if not existing_response:
        setattr(order, 'pos_response', [])
        existing_response = []
    
    existing_response.append({
        "timestamp": current_time.isoformat(),
        "callback_type": "status_update",
        "data": callback_data
    })
    setattr(order, 'pos_response', existing_response)
    
    db.flush()

    # ----------------------------------------------------------
    # 🔊  Broadcast status change to all guests in the session
    # ----------------------------------------------------------
    try:
        from websocket.manager import connection_manager  # Local import to avoid circular deps
        from models.schema import Session as DineSession

        sess = db.query(DineSession).filter(DineSession.id == order.session_id).first()
        if sess:
            success_message = {
                "type": "order_confirmed",
                "order_id": order.public_id,
                "order": {
                    "id": order.public_id,
                    "orderNumber": order.public_id.split("_")[1],
                    "timestamp": order.created_at.isoformat(),
                    "items": order.payload,
                    "total": order.total_amount,
                    "status": new_status
                }
            }
            # Fire-and-forget; failures are logged but don't block POS callback
            logger.info(f"Broadcasting order status update to session {sess.public_id}")
            await connection_manager.broadcast_to_session(sess.public_id, success_message)  # type: ignore
        else:
            logger.warning(f"Session not found for order {order.public_id}")

    except Exception as e:
        logger.warning(f"Broadcast module unavailable: {e}")
    
    logger.info(f"Order {order.public_id} status updated: {old_status} → {new_status}")
    
    return new_status

@router.post("/{restaurant_slug}/", summary="PetPooja Order Status Callback")
async def petpooja_callback(
    restaurant_slug: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle PetPooja order status update callbacks.
    
    This endpoint receives order status updates from PetPooja POS system
    and updates the corresponding order in our internal database.
    
    URL format: /pp_callback/{restaurant_slug}/
    
    Supported status mappings:
    - -1 → cancelled
    - 1/2/3 → confirmed  
    - 5 → food_ready
    """
    try:
        # Parse request body
        try:
            payload = await request.json()
        except Exception as e:
            logger.error(f"Invalid JSON payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
        logger.info(f"Received callback for restaurant {restaurant_slug}: {payload}")
        
        # Find restaurant
        restaurant = find_restaurant_by_slug(restaurant_slug, db)
        
        # Validate payload
        validated_data = validate_callback_payload(payload)
        
        # Find order by public_id and restaurant
        order = db.execute(
            select(Order).where(
                Order.public_id == validated_data["order_id"],
                Order.session.has(restaurant_id=restaurant.id)
            )
        ).scalar_one_or_none()
        
        if not order:
            logger.warning(f"Order not found: {validated_data['order_id']} for restaurant {restaurant_slug}")
            raise HTTPException(status_code=404, detail=f"Order not found: {validated_data['order_id']}")
        
        # Map PetPooja status to internal status
        petpooja_status = validated_data["status"]
        internal_status = PETPOOJA_STATUS_MAPPING.get(petpooja_status)
        
        if not internal_status:
            # Unknown status - log but don't update
            logger.warning(f"Unknown PetPooja status {petpooja_status} for order {order.public_id}")
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": f"Unknown status {petpooja_status} - logged but not processed",
                    "order_id": order.public_id,
                    "current_status": order.status
                }
            )
        
        # Update order status
        updated_status = await update_order_status(order, internal_status, validated_data, db)
        
        # Commit transaction
        db.commit()
        
        logger.success(f"Successfully processed callback for order {order.public_id}")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Order status updated successfully",
                "order_id": order.public_id,
                "new_status": updated_status,
                "petpooja_status": petpooja_status
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        db.rollback()
        raise
        
    except Exception as e:
        # Handle unexpected errors
        db.rollback()
        logger.error(f"Unexpected error in callback processing: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{restaurant_slug}/item_switch", summary="Switch menu items or addons on/off (PetPooja)")
async def item_switch(
    restaurant_slug: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Switch menu items or addons on/off (is_active) based on PetPooja callback.
    Request body:
    {
        "restID": "xxxx",
        "type": "item" | "addon",
        "inStock": true/false,
        "itemID": ["7778660", ...],
        ...
    }
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Invalid JSON payload for item_switch: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Received item_switch for restaurant {restaurant_slug}: {payload}")

    # Validate required fields
    required_fields = ["restID", "type", "inStock", "itemID"]
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    switch_type = payload["type"]
    in_stock = bool(payload["inStock"])
    item_ids = payload["itemID"]
    if not isinstance(item_ids, list):
        raise HTTPException(status_code=400, detail="itemID must be a list")

    # Find restaurant
    restaurant = find_restaurant_by_slug(restaurant_slug, db)

    updated_ids = []
    not_found_ids = []

    if switch_type == "item":
        from models.schema import MenuItem
        for ext_id in item_ids:
            item = db.query(MenuItem).filter(
                MenuItem.external_id == str(ext_id),
                MenuItem.restaurant_id == restaurant.id
            ).first()
            if item:
                setattr(item, "is_active", in_stock)
                updated_ids.append(ext_id)
                logger.info(f"Set MenuItem {ext_id} is_active={in_stock}")
            else:
                not_found_ids.append(ext_id)
                logger.warning(f"MenuItem not found for external_id={ext_id} in restaurant {restaurant.id}")
    elif switch_type == "addon":
        from models.schema import AddonGroupItem
        for ext_id in item_ids:
            addon = db.query(AddonGroupItem).filter(
                AddonGroupItem.external_addon_id == str(ext_id)
            ).first()
            if addon:
                setattr(addon, "is_active", in_stock)
                updated_ids.append(ext_id)
                logger.info(f"Set AddonGroupItem {ext_id} is_active={in_stock}")
            else:
                not_found_ids.append(ext_id)
                logger.warning(f"AddonGroupItem not found for external_addon_id={ext_id}")
    else:
        raise HTTPException(status_code=400, detail="type must be 'item' or 'addon'")

    db.commit()

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "status": "success",
            "message": "Stock status updated successfully" 
        }
    )

# Health check endpoint for callback service
@router.get("/health", summary="Callback Service Health Check")
async def callback_health():
    """Health check endpoint for PetPooja callback service."""
    return {"status": "healthy", "service": "petpooja_callback"} 