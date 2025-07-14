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

from models.schema import (
    get_db, Restaurant, POSSystem, Order, MenuItem, Variation, AddonGroup, 
    AddonGroupItem, ItemVariation, ItemAddon, ItemVariationAddon, SessionLocal
)
from config import logger
from utils.general import new_id

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

@router.post("/{restaurant_slug}/get_store_status", summary="Get store open/closed status (PetPooja)")
async def get_store_status(
    restaurant_slug: str,
    db: Session = Depends(get_db)
):
    """
    Returns the current open/closed status of the restaurant as per PetPooja format.
    """
    restaurant = find_restaurant_by_slug(restaurant_slug, db)
    store_status = "1" if getattr(restaurant, "is_open", True) else "0"
    logger.info(f"store_status: {store_status}")
    return {
        "http_code": 200,
        "status": "success",
        "store_status": store_status,
        "message": "Store Delivery Status fetched successfully"
    }

@router.post("/{restaurant_slug}/store_status", summary="Set store open/closed status (PetPooja)")
async def set_store_status(
    restaurant_slug: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Updates the open/closed status of the restaurant as per PetPooja format.
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Invalid JSON payload for store_status: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Received store_status update for restaurant {restaurant_slug}: {payload}")

    required_fields = ["restID", "store_status"]
    for field in required_fields:
        if field not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    store_status = str(payload["store_status"])
    is_open = store_status == "1" or store_status == 1
    turn_on_time = payload.get("turn_on_time")
    reason = payload.get("reason")
    logger.info(f"turn_on_time: {turn_on_time}, reason: {reason}")

    restaurant = find_restaurant_by_slug(restaurant_slug, db)
    setattr(restaurant, "is_open", is_open)
    db.commit()

    return {
        "http_code": 200,
        "status": "success",
        "message": f"Store Status updated successfully for store {payload['restID']}"
    }
# Menu Sync Endpoint
@router.post("/{restaurant_slug}/sync_menu", summary="PetPooja Menu Sync")
async def sync_menu(restaurant_slug: str, request: Request):
    """
    Sync complete menu data from PetPooja POS system.
    
    This endpoint receives full menu data from PetPooja and updates all
    related database entities: MenuItem, Variation, AddonGroup, AddonGroupItem,
    ItemVariation, ItemAddon, ItemVariationAddon.
    
    Returns success/error response in PetPooja format.
    """
    try:
        # Parse request body
        try:
            payload = await request.json()
        except Exception as e:
            logger.error(f"Invalid JSON payload for menu sync: {e}")
            return {"success": "0", "message": "Invalid JSON payload"}
        
        logger.info(f"Starting menu sync for restaurant {restaurant_slug}")
        
        # Validate input structure
        if not payload or not isinstance(payload, dict):
            return {"success": "0", "message": "Invalid menu data format"}
        
        required_keys = ["items", "variations", "addongroups"]
        missing_keys = [key for key in required_keys if key not in payload]
        if missing_keys:
            return {"success": "0", "message": f"Missing required keys: {missing_keys}"}
        
        # Process menu sync in single transaction
        with SessionLocal() as db:
            try:
                # Find restaurant
                restaurant = find_restaurant_by_slug(restaurant_slug, db)
                restaurant_id = int(restaurant.id)
                
                # Validate POS system
                pos_system = validate_petpooja_pos_system(restaurant_id, db)
                pos_system_id = int(pos_system.id)
                
                # Update POS system config with taxes and discounts
                update_pos_system_config(pos_system, payload, db)
                
                # Deactivate all existing entities
                deactivate_all_entities(restaurant_id, pos_system_id, db)
                
                # Process core entities
                stats = process_menu_entities(payload, restaurant_id, pos_system_id, db)
                
                # Process relationships
                process_menu_relationships(payload, restaurant_id, pos_system_id, db)
                
                # Commit all changes
                db.commit()
                
                logger.info(f"Menu sync completed successfully for {restaurant_slug}. Stats: {stats}")
                return {"success": "1", "message": "Menu items are successfully listed."}
                
            except Exception as e:
                # Transaction will auto-rollback
                db.rollback()
                raise e
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Menu sync failed for {restaurant_slug}: {e}")
        return {"success": "0", "message": str(e)}


def validate_petpooja_pos_system(restaurant_id: int, db: Session) -> POSSystem:
    """Validate that restaurant has a PetPooja POS system."""
    pos_system = db.query(POSSystem).filter_by(
        restaurant_id=restaurant_id, 
        name="petpooja"
    ).first()
    
    if not pos_system:
        raise ValueError("No PetPooja POS system found for this restaurant")
    
    return pos_system


def update_pos_system_config(pos_system: POSSystem, payload: Dict[str, Any], db: Session):
    """Update POS system config with taxes and discounts from menu data."""
    logger.info("Updating POS system config with taxes and discounts")
    
    # Extract taxes from PetPooja menu data
    taxes_data = payload.get("taxes", [])
    discount_data = payload.get("discounts", [])
    
    # Process taxes to make them active and usable
    processed_taxes = []
    for tax in taxes_data:
        processed_tax = {
            "taxid": tax.get("taxid", ""),
            "taxname": tax.get("taxname", ""),
            "tax": tax.get("tax", "0"),
            "taxtype": tax.get("taxtype", "1"),
            "tax_ordertype": tax.get("tax_ordertype", ""),
            "active": True,  # Make taxes active by default
            "tax_coreortotal": tax.get("tax_coreortotal", "2"),
            "tax_taxtype": tax.get("tax_taxtype", "1"),
            "rank": tax.get("rank", "1"),
            "consider_in_core_amount": tax.get("consider_in_core_amount", "0"),
            "description": tax.get("description", "")
        }
        processed_taxes.append(processed_tax)
    
    # Update config with taxes and discounts
    current_config = pos_system.config or {}
    current_config["taxes"] = processed_taxes
    current_config["discounts"] = discount_data
    
    pos_system.config = current_config
    pos_system.updated_at = datetime.utcnow()
    
    db.flush()
    logger.info(f"Updated POS config with {len(processed_taxes)} taxes and {len(discount_data)} discounts")


def deactivate_all_entities(restaurant_id: int, pos_system_id: int, db: Session):
    """Set all existing menu entities as inactive to prepare for sync."""
    logger.info("Deactivating existing menu entities")
    
    # Get all menu items for this restaurant
    menu_item_ids = [
        item.id for item in db.query(MenuItem.id).filter_by(restaurant_id=restaurant_id).all()
    ]
    
    # Get all addon group ids for this POS system
    addon_group_ids = [
        ag.id for ag in db.query(AddonGroup.id).filter_by(pos_system_id=pos_system_id).all()
    ]
    
    # Get all item variation ids for menu items
    item_variation_ids = []
    if menu_item_ids:
        item_variation_ids = [
            iv.id for iv in db.query(ItemVariation.id).filter(
                ItemVariation.menu_item_id.in_(menu_item_ids)
            ).all()
        ]
    
    # Deactivate menu items
    db.query(MenuItem).filter_by(restaurant_id=restaurant_id).update({"is_active": False})
    
    # Deactivate variations
    db.query(Variation).filter_by(pos_system_id=pos_system_id).update({"is_active": False})
    
    # Deactivate addon groups
    db.query(AddonGroup).filter_by(pos_system_id=pos_system_id).update({"is_active": False})
    
    # Deactivate addon group items
    if addon_group_ids:
        db.query(AddonGroupItem).filter(
            AddonGroupItem.addon_group_id.in_(addon_group_ids)
        ).update({"is_active": False})
    
    # Deactivate item variations
    if menu_item_ids:
        db.query(ItemVariation).filter(
            ItemVariation.menu_item_id.in_(menu_item_ids)
        ).update({"is_active": False})
    
    # Deactivate item addons  
    if menu_item_ids:
        db.query(ItemAddon).filter(
            ItemAddon.menu_item_id.in_(menu_item_ids)
        ).update({"is_active": False})
    
    # Deactivate item variation addons
    if item_variation_ids:
        db.query(ItemVariationAddon).filter(
            ItemVariationAddon.item_variation_id.in_(item_variation_ids)
        ).update({"is_active": False})
    
    db.flush()
    logger.info("Deactivated all existing menu entities")


def process_menu_entities(payload: Dict[str, Any], restaurant_id: int, pos_system_id: int, db: Session) -> Dict[str, int]:
    """Process core menu entities from PetPooja data."""
    stats = {
        "items_created": 0,
        "items_updated": 0,
        "variations_created": 0,
        "variations_updated": 0,
        "addon_groups_created": 0,
        "addon_groups_updated": 0,
        "addon_items_created": 0,
        "addon_items_updated": 0
    }
    
    # Create attributes map for tags and veg_flag processing
    attributes_map = {attr["attributeid"]: attr["attribute"] for attr in payload.get("attributes", [])}
    
    # Process MenuItems
    logger.info(f"Processing {len(payload.get('items', []))} menu items")
    for item_data in payload.get("items", []):
        existing_item = db.query(MenuItem).filter(
            MenuItem.external_id == item_data["itemid"],
            MenuItem.restaurant_id == restaurant_id
        ).first()
        
        if existing_item:
            update_menu_item(existing_item, item_data, pos_system_id, attributes_map)
            stats["items_updated"] += 1
        else:
            new_item = create_menu_item(item_data, restaurant_id, pos_system_id, attributes_map)
            db.add(new_item)
            stats["items_created"] += 1
    
    # Process Variations
    logger.info(f"Processing {len(payload.get('variations', []))} variations")
    for variation_data in payload.get("variations", []):
        existing_variation = db.query(Variation).filter(
            Variation.external_variation_id == variation_data["variationid"],
            Variation.pos_system_id == pos_system_id
        ).first()
        
        if existing_variation:
            update_variation(existing_variation, variation_data)
            stats["variations_updated"] += 1
        else:
            new_variation = create_variation(variation_data, pos_system_id)
            db.add(new_variation)
            stats["variations_created"] += 1
    
    # Process AddonGroups and their items
    logger.info(f"Processing {len(payload.get('addongroups', []))} addon groups")
    for addon_group_data in payload.get("addongroups", []):
        existing_group = db.query(AddonGroup).filter(
            AddonGroup.external_group_id == addon_group_data["addongroupid"],
            AddonGroup.pos_system_id == pos_system_id
        ).first()
        
        if existing_group:
            update_addon_group(existing_group, addon_group_data)
            stats["addon_groups_updated"] += 1
        else:
            new_group = create_addon_group(addon_group_data, pos_system_id)
            db.add(new_group)
            db.flush()  # Flush to get the ID for addon items
            existing_group = new_group
            stats["addon_groups_created"] += 1
        
        # Process addon items for this group
        for addon_item_data in addon_group_data.get("addongroupitems", []):
            existing_addon_item = db.query(AddonGroupItem).filter(
                AddonGroupItem.external_addon_id == addon_item_data["addonitemid"],
                AddonGroupItem.addon_group_id == existing_group.id
            ).first()
            
            if existing_addon_item:
                update_addon_item(existing_addon_item, addon_item_data, payload.get("attributes", []))
                stats["addon_items_updated"] += 1
            else:
                new_addon_item = create_addon_item(addon_item_data, existing_group.id, payload.get("attributes", []))
                db.add(new_addon_item)
                stats["addon_items_created"] += 1
    
    db.flush()
    logger.info(f"Processed core entities: {stats}")
    return stats


def create_menu_item(item_data: Dict[str, Any], restaurant_id: int, pos_system_id: int, attributes_map: Dict[str, str] = None) -> MenuItem:
    """Create new MenuItem from PetPooja data."""
    # Handle tags - copy item_tags and add attribute if present
    tags_list = item_data.get("item_tags", []).copy()
    attr_id_val = item_data.get("item_attributeid")
    
    # Set veg_flag based on attribute
    veg_flag = False
    if attr_id_val:
        if attr_id_val == "1":  # "1" maps to "veg"
            veg_flag = True
        
        # Add attribute to tags if attributes_map is provided
        if attributes_map and attr_id_val in attributes_map:
            tags_list.append(attributes_map[attr_id_val])
    
    return MenuItem(
        public_id=new_id(),
        restaurant_id=restaurant_id,
        name=item_data["itemname"],
        description=item_data.get("itemdescription", ""),
        price=float(item_data["price"]),
        is_active=item_data.get("active", "0") == "1",
        veg_flag=veg_flag,
        itemallowvariation=item_data.get("itemallowvariation", "0") == "1",
        itemallowaddon=item_data.get("itemallowaddon", "0") == "1",
        external_id=item_data["itemid"],
        external_data=item_data,
        pos_system_id=pos_system_id,
        tags=tags_list
    )


def update_menu_item(menu_item: MenuItem, item_data: Dict[str, Any], pos_system_id: int, attributes_map: Dict[str, str] = None):
    """Update existing MenuItem with PetPooja data."""
    # Handle tags - copy item_tags and add attribute if present
    tags_list = item_data.get("item_tags", []).copy()
    attr_id_val = item_data.get("item_attributeid")
    
    # Set veg_flag based on attribute
    veg_flag = False
    if attr_id_val:
        if attr_id_val == "1":  # "1" maps to "veg"
            veg_flag = True
        
        # Add attribute to tags if attributes_map is provided
        if attributes_map and attr_id_val in attributes_map:
            tags_list.append(attributes_map[attr_id_val])
    
    menu_item.name = item_data["itemname"]
    menu_item.description = item_data.get("itemdescription", "")
    menu_item.price = float(item_data["price"])
    menu_item.is_active = item_data.get("active", "0") == "1"
    menu_item.veg_flag = veg_flag
    menu_item.itemallowvariation = item_data.get("itemallowvariation", "0") == "1"
    menu_item.itemallowaddon = item_data.get("itemallowaddon", "0") == "1"
    menu_item.external_data = item_data
    menu_item.tags = tags_list


def create_variation(variation_data: Dict[str, Any], pos_system_id: int) -> Variation:
    """Create new Variation from PetPooja data."""
    return Variation(
        name=variation_data["name"],
        display_name=variation_data["name"],
        group_name=variation_data["groupname"],
        is_active=variation_data["status"] == "1",
        external_variation_id=variation_data["variationid"],
        external_data=variation_data,
        pos_system_id=pos_system_id
    )


def update_variation(variation: Variation, variation_data: Dict[str, Any]):
    """Update existing Variation with PetPooja data."""
    variation.name = variation_data["name"]
    variation.display_name = variation_data["name"]
    variation.group_name = variation_data["groupname"]
    variation.is_active = variation_data["status"] == "1"
    variation.external_data = variation_data


def create_addon_group(addon_group_data: Dict[str, Any], pos_system_id: int) -> AddonGroup:
    """Create new AddonGroup from PetPooja data."""
    return AddonGroup(
        name=addon_group_data["addongroup_name"],
        display_name=addon_group_data["addongroup_name"],
        is_active=addon_group_data["active"] == "1",
        priority=int(addon_group_data.get("addongroup_rank", 0)),
        external_group_id=addon_group_data["addongroupid"],
        external_data=addon_group_data,
        pos_system_id=pos_system_id
    )


def update_addon_group(addon_group: AddonGroup, addon_group_data: Dict[str, Any]):
    """Update existing AddonGroup with PetPooja data."""
    addon_group.name = addon_group_data["addongroup_name"]
    addon_group.display_name = addon_group_data["addongroup_name"]
    addon_group.is_active = addon_group_data["active"] == "1"
    addon_group.priority = int(addon_group_data.get("addongroup_rank", 0))
    addon_group.external_data = addon_group_data


def create_addon_item(addon_item_data: Dict[str, Any], addon_group_id: int, attributes: list) -> AddonGroupItem:
    """Create new AddonGroupItem from PetPooja data."""
    # Get tags from attributes
    tags = []
    if addon_item_data.get("attributes"):
        attributes_map = {attr["attributeid"]: attr["attribute"] for attr in attributes}
        for attr_id in addon_item_data["attributes"].split(","):
            attr_id = attr_id.strip()
            if attr_id in attributes_map:
                tags.append(attributes_map[attr_id])
    
    return AddonGroupItem(
        addon_group_id=addon_group_id,
        name=addon_item_data["addonitem_name"],
        display_name=addon_item_data["addonitem_name"],
        price=float(addon_item_data["addonitem_price"]),
        is_active=addon_item_data["active"] == "1",
        priority=int(addon_item_data.get("addonitem_rank", 0)),
        tags=tags,
        external_addon_id=addon_item_data["addonitemid"],
        external_data=addon_item_data
    )


def update_addon_item(addon_item: AddonGroupItem, addon_item_data: Dict[str, Any], attributes: list):
    """Update existing AddonGroupItem with PetPooja data."""
    # Get tags from attributes
    tags = []
    if addon_item_data.get("attributes"):
        attributes_map = {attr["attributeid"]: attr["attribute"] for attr in attributes}
        for attr_id in addon_item_data["attributes"].split(","):
            attr_id = attr_id.strip()
            if attr_id in attributes_map:
                tags.append(attributes_map[attr_id])
    
    addon_item.name = addon_item_data["addonitem_name"]
    addon_item.display_name = addon_item_data["addonitem_name"]
    addon_item.price = float(addon_item_data["addonitem_price"])
    addon_item.is_active = addon_item_data["active"] == "1"
    addon_item.priority = int(addon_item_data.get("addonitem_rank", 0))
    addon_item.tags = tags
    addon_item.external_data = addon_item_data


def process_menu_relationships(payload: Dict[str, Any], restaurant_id: int, pos_system_id: int, db: Session):
    """Process relationship entities from PetPooja data."""
    logger.info("Processing menu item relationships")
    
    # Create lookup maps for efficient foreign key resolution
    menu_items_map = {
        item.external_id: item for item in 
        db.query(MenuItem).filter_by(restaurant_id=restaurant_id).all()
    }
    
    variations_map = {
        variation.external_variation_id: variation for variation in
        db.query(Variation).filter_by(pos_system_id=pos_system_id).all()
    }
    
    addon_groups_map = {
        group.external_group_id: group for group in
        db.query(AddonGroup).filter_by(pos_system_id=pos_system_id).all()
    }
    
    relationship_counts = {
        "item_variations": 0,
        "item_addons": 0,
        "item_variation_addons": 0
    }
    
    # Process each item's relationships
    for item_data in payload.get("items", []):
        menu_item = menu_items_map.get(item_data["itemid"])
        if not menu_item:
            continue
        
        # Process ItemVariations
        for variation_data in item_data.get("variation", []):
            variation = variations_map.get(variation_data["variationid"])
            if variation:
                # Check if relationship already exists
                existing = db.query(ItemVariation).filter_by(
                    menu_item_id=menu_item.id,
                    variation_id=variation.id
                ).first()
                
                if not existing:
                    item_variation = ItemVariation(
                        menu_item_id=menu_item.id,
                        variation_id=variation.id,
                        price=float(variation_data["price"]),
                        is_active=variation_data["active"] == "1",
                        priority=int(variation_data.get("variationrank", 0)),
                        variationallowaddon=variation_data.get("variationallowaddon", 0) == 1,
                        external_id=variation_data["id"],
                        external_data=variation_data
                    )
                    db.add(item_variation)
                    db.flush()  # Get the ID for variation addons
                    relationship_counts["item_variations"] += 1
                    
                    # Process ItemVariationAddons
                    for var_addon_data in variation_data.get("addon", []):
                        addon_group = addon_groups_map.get(var_addon_data["addon_group_id"])
                        if addon_group:
                            existing_var_addon = db.query(ItemVariationAddon).filter_by(
                                item_variation_id=item_variation.id,
                                addon_group_id=addon_group.id
                            ).first()
                            
                            if not existing_var_addon:
                                item_var_addon = ItemVariationAddon(
                                    item_variation_id=item_variation.id,
                                    addon_group_id=addon_group.id,
                                    min_selection=int(var_addon_data.get("addon_item_selection_min", 0)),
                                    max_selection=int(var_addon_data.get("addon_item_selection_max", 1)),
                                    is_active=True,
                                    priority=0
                                )
                                db.add(item_var_addon)
                                relationship_counts["item_variation_addons"] += 1
        
        # Process ItemAddons  
        for addon_data in item_data.get("addon", []):
            addon_group = addon_groups_map.get(addon_data["addon_group_id"])
            if addon_group:
                existing = db.query(ItemAddon).filter_by(
                    menu_item_id=menu_item.id,
                    addon_group_id=addon_group.id
                ).first()
                
                if not existing:
                    item_addon = ItemAddon(
                        menu_item_id=menu_item.id,
                        addon_group_id=addon_group.id,
                        min_selection=int(addon_data.get("addon_item_selection_min", 0)),
                        max_selection=int(addon_data.get("addon_item_selection_max", 1)),
                        is_active=True,
                        priority=0
                    )
                    db.add(item_addon)
                    relationship_counts["item_addons"] += 1
    
    db.flush()
    logger.info(f"Created relationships: {relationship_counts}")


# Health check endpoint for callback service
@router.get("/health", summary="Callback Service Health Check")
async def callback_health():
    """Health check endpoint for PetPooja callback service."""
    return {"status": "healthy", "service": "petpooja_callback"} 