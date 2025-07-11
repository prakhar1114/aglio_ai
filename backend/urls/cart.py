from fastapi import APIRouter, HTTPException, Header, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from sqlalchemy.orm import joinedload
from datetime import datetime
import uuid
import hashlib
from loguru import logger



from models.schema import (
    SessionLocal, Session, Member, CartItem, MenuItem, Restaurant, Order,
    CartItemAddon, ItemVariation, AddonGroupItem, ItemAddon, CartItemVariationAddon
)
from models.cart_models import (
    CartItemCreateRequest, CartItemUpdateRequest, CartItemDeleteRequest,
    CartSnapshotResponse, CartItemCreateResponse, CartItemUpdateResponse,
    CartItemResponse, MemberInfo, ErrorResponse,
    OrderSubmissionRequest, OrderSubmissionResponse, CartMismatchResponse, OrderItemRequest,
    OrderCompletedEvent, CartClearedEvent, SelectedAddonResponse, SelectedVariationResponse
)
from utils.jwt_utils import decode_ws_token
from websocket.manager import connection_manager
from utils.addon_helpers import resolve_addon_context, build_selected_addon_responses

router = APIRouter()

def verify_auth_and_get_member(authorization: str, session_pid: str):
    """Verify JWT token and return member info"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"success": False, "code": "invalid_token", "detail": "Invalid authorization header"}
        )
    
    token = authorization[7:]  # Remove "Bearer "
    payload = decode_ws_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "code": "invalid_token", "detail": "Invalid or expired token"}
        )
    
    # Verify session ID matches token
    if payload.get("sid") != session_pid:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "code": "invalid_token", "detail": "Session ID mismatch"}
        )
    
    return payload["sub"]  # member_pid

def check_password_validation(session: Session, restaurant: Restaurant):
    """Check if password validation is required and satisfied"""
    if restaurant.require_pass and not session.pass_validated:
        raise HTTPException(
            status_code=403,
            detail={"success": False, "code": "pass_required", "detail": "Daily password required"}
        )

def calculate_cart_hash(items: list) -> str:
    """Calculate hash of cart items for order validation - using SHA256 of sorted items"""
    # Create deterministic string from cart items
    cart_data = []
    for item in sorted(items, key=lambda x: x.id):
        # Include variation and addon data in hash
        variation_str = f"v:{item.selected_item_variation_id}" if item.selected_item_variation_id else "v:none"
        
        # Sort addons by addon_item_id for consistency – use variation overrides first
        addon_rows, _ = resolve_addon_context(item)
        addon_strs = []
        for addon in sorted(addon_rows, key=lambda x: x.addon_item_id):
                addon_strs.append(f"a:{addon.addon_item_id}:{addon.quantity}")
        addon_str = ",".join(addon_strs) if addon_strs else "a:none"
        
        cart_data.append(f"{item.id}:{item.menu_item_id}:{variation_str}:{addon_str}:{item.qty}:{item.note}")
    
    cart_string = "|".join(cart_data)
    return hashlib.sha256(cart_string.encode()).hexdigest()

@router.get("/cart_snapshot", response_model=CartSnapshotResponse)
async def get_cart_snapshot(
    session_pid: str = Query(..., description="Session public ID"),
    authorization: str = Header(..., alias="Authorization")
):
    """
    Get complete cart state for hydrating Redux on page reload
    """
    try:
        member_pid = verify_auth_and_get_member(authorization, session_pid)
        
        with SessionLocal() as db:
            # Get session
            session = db.query(Session).filter(Session.public_id == session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            # Get restaurant for image URL construction
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # Verify member belongs to session
            member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            if not member:
                raise HTTPException(
                    status_code=401,
                    detail={"success": False, "code": "invalid_token", "detail": "Member not found in session"}
                )
            
            # Get ALL cart items (both pending and locked) to detect cart state
            all_cart_items = db.query(CartItem).options(
                joinedload(CartItem.menu_item),
                joinedload(CartItem.selected_item_variation).joinedload(ItemVariation.variation),
                joinedload(CartItem.selected_addons).joinedload(CartItemAddon.addon_item),
                joinedload(CartItem.member)
            ).filter(
                CartItem.session_id == session.id,
                CartItem.state.in_(['pending', 'locked'])
            ).all()
            
            # Separate pending and locked items
            pending_items = [item for item in all_cart_items if item.state == 'pending']
            locked_items = [item for item in all_cart_items if item.state == 'locked']
            
            # Determine cart processing state
            cart_locked = len(locked_items) > 0
            pending_order_id = None
            order_processing_status = "idle"
            locked_by_member = None
            
            if cart_locked:
                # Find the processing order by looking for orders with locked cart items
                current_order = (
                    db.query(Order)
                    .join(CartItem, Order.id == CartItem.order_id)
                    .filter(
                        CartItem.session_id == session.id,
                        CartItem.state == "locked",
                        Order.status == "processing"
                    )
                    .first()
                )
                
                if current_order:
                    pending_order_id = current_order.public_id
                    order_processing_status = "processing"
                    # Get the member who initiated the order
                    locked_by_member = current_order.initiated_by_member.public_id
            
            # Build response items (only pending items are returned for editing)
            items = []
            for cart_item in pending_items:
                # Calculate final price
                final_price = cart_item.menu_item.price
                
                # Add variation price (absolute price, not modifier)
                selected_variation = None
                if cart_item.selected_item_variation:
                    final_price = cart_item.selected_item_variation.price  # Use absolute price
                    selected_variation = SelectedVariationResponse(
                        item_variation_id=cart_item.selected_item_variation.id,
                        variation_name=cart_item.selected_item_variation.variation.name,
                        group_name=cart_item.selected_item_variation.variation.group_name,
                        price=cart_item.selected_item_variation.price
                    )
                
                # Addon handling – supports variation-specific overrides
                addon_rows, source = resolve_addon_context(cart_item)
                selected_addons_response, addons_total = build_selected_addon_responses(addon_rows)
                final_price += addons_total

                # Split into correct fields for response
                selected_addons = selected_addons_response if source == "base" else []
                selected_variation_addons = selected_addons_response if source == "variation" else []
                
                items.append(CartItemResponse(
                    public_id=cart_item.public_id,
                    member_pid=cart_item.member.public_id,
                    menu_item_pid=cart_item.menu_item.public_id,
                    name=cart_item.menu_item.name,
                    base_price=cart_item.menu_item.price,
                    final_price=final_price,
                    qty=cart_item.qty,
                    note=cart_item.note or "",
                    version=cart_item.version,
                    image_url=f"image_data/{restaurant.slug}/{cart_item.menu_item.image_path}" if cart_item.menu_item.image_path else None,
                    cloudflare_image_id=cart_item.menu_item.cloudflare_image_id,
                    cloudflare_video_id=cart_item.menu_item.cloudflare_video_id,
                    veg_flag=cart_item.menu_item.veg_flag,
                    selected_variation=selected_variation,
                    selected_addons=selected_addons,
                    selected_variation_addons=selected_variation_addons
                ))
            
            # Get all members
            members = db.query(Member).filter(Member.session_id == session.id).all()
            member_infos = [
                MemberInfo(
                    member_pid=m.public_id,
                    nickname=m.nickname,
                    is_host=m.is_host
                )
                for m in members
            ]
            
            # Get confirmed orders for this session
            orders_query = db.query(Order).filter(
                Order.session_id == session.id,
                Order.status == "confirmed"  # Only confirmed orders
            ).order_by(Order.created_at.desc()).all()
            
            orders = []
            for order in orders_query:
                # Convert order to frontend format
                order_data = {
                    "id": order.public_id,
                    # Extract the numeric sequence from the order public_id (format: ORD-<restaurant_id>-<sequence>)
                    "orderNumber": int(order.public_id.split("_")[1]),
                    "timestamp": order.created_at.isoformat(),
                    "items": order.payload,  # This contains the order items data
                    "total": order.total_amount,
                    "initiated_by": {
                        "member_pid": order.initiated_by_member.public_id,
                        "nickname": order.initiated_by_member.nickname
                    },
                    "status": order.status
                }
                orders.append(order_data)
            
            # Calculate cart version (max version of all items, or 0 if no items)
            cart_version = max([item.version for item in all_cart_items], default=0)
            
            return CartSnapshotResponse(
                items=items,
                members=member_infos,
                orders=orders,
                cart_version=cart_version,
                cart_locked=cart_locked,
                pending_order_id=pending_order_id,
                order_processing_status=order_processing_status,
                locked_by_member=locked_by_member
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cart snapshot: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.post("/cart_items", response_model=CartItemCreateResponse)
async def create_cart_item(
    data: CartItemCreateRequest,
    authorization: str = Header(..., alias="Authorization")
):
    """
    Add new item to cart
    """
    try:
        member_pid = verify_auth_and_get_member(authorization, data.session_pid)
        
        with SessionLocal() as db:
            # Get session and restaurant
            session = db.query(Session).filter(Session.public_id == data.session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # Check password validation
            check_password_validation(session, restaurant)
            
            # Get member
            member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            if not member:
                raise HTTPException(
                    status_code=401,
                    detail={"success": False, "code": "invalid_token", "detail": "Member not found in session"}
                )
            
            # Validate menu item exists
            menu_item = db.query(MenuItem).filter(MenuItem.public_id == data.menu_item_id).first()
            if not menu_item:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "menu_item_not_found", "detail": "Menu item not found"}
                )
            
            # Validate selected variation if provided
            selected_variation = None
            if data.selected_item_variation_id:
                selected_variation = db.query(ItemVariation).filter(
                    ItemVariation.id == data.selected_item_variation_id,
                    ItemVariation.menu_item_id == menu_item.id,
                    ItemVariation.is_active == True
                ).first()
                if not selected_variation:
                    raise HTTPException(
                        status_code=400,
                        detail={"success": False, "code": "invalid_variation", "detail": "Invalid variation selected"}
                    )
            
            # Validate selected addons if provided
            addon_items = []
            if data.selected_addons:
                for addon_selection in data.selected_addons:
                    # Get the addon item first
                    addon_item = db.query(AddonGroupItem).filter(
                        AddonGroupItem.id == addon_selection.addon_group_item_id,
                        AddonGroupItem.is_active == True
                    ).first()
                    
                    if not addon_item:
                        raise HTTPException(
                            status_code=400,
                            detail={"success": False, "code": "invalid_addon", "detail": f"Addon item {addon_selection.addon_group_item_id} not found"}
                        )
                    
                    # Check if this addon group is linked to this menu item
                    addon_link = db.query(ItemAddon).filter(
                        ItemAddon.menu_item_id == menu_item.id,
                        ItemAddon.addon_group_id == addon_item.addon_group_id,
                        ItemAddon.is_active == True
                    ).first()
                    
                    if not addon_link:
                        raise HTTPException(
                            status_code=400,
                            detail={"success": False, "code": "invalid_addon", "detail": f"Addon group not available for this item"}
                        )
                    
                    addon_items.append((addon_item, addon_selection.quantity))
            
            # Create cart item
            cart_item = CartItem(
                public_id=f"ci_{uuid.uuid4().hex[:8]}",
                session_id=session.id,
                member_id=member.id,
                menu_item_id=menu_item.id,  # Use the actual DB ID, not public_id
                selected_item_variation_id=selected_variation.id if selected_variation else None,
                qty=data.qty,
                note=data.note,
                version=1
            )
            
            db.add(cart_item)
            db.flush()  # Get the ID
            
            # Add selected addons
            for addon_item, quantity in addon_items:
                cart_addon = CartItemAddon(
                    cart_item_id=cart_item.id,
                    addon_item_id=addon_item.id,
                    quantity=quantity
                )
                db.add(cart_addon)
            
            # Update session activity
            session.last_activity_at = datetime.utcnow()
            db.commit()
            
            return CartItemCreateResponse(
                data={"public_id": cart_item.public_id, "version": cart_item.version}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating cart item: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.patch("/cart_items/{item_public_id}", response_model=CartItemUpdateResponse)
async def update_cart_item(
    item_public_id: str,
    data: CartItemUpdateRequest,
    authorization: str = Header(..., alias="Authorization")
):
    """
    Update existing cart item (qty/note)
    """
    try:
        member_pid = verify_auth_and_get_member(authorization, data.session_pid)
        
        with SessionLocal() as db:
            # Get session and restaurant
            session = db.query(Session).filter(Session.public_id == data.session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            check_password_validation(session, restaurant)
            
            # Get member
            member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            if not member:
                raise HTTPException(
                    status_code=401,
                    detail={"success": False, "code": "invalid_token", "detail": "Member not found in session"}
                )
            
            # Get cart item
            cart_item = db.query(CartItem).filter(
                CartItem.public_id == item_public_id,
                CartItem.session_id == session.id
            ).first()
            if not cart_item:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "item_not_found", "detail": "Cart item not found"}
                )
            
            # Check if item is in pending state (editable)
            if cart_item.state != 'pending':
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "item_not_editable", "detail": f"Cart item is {cart_item.state}, cannot be edited"}
                )
            
            # Check authorization (owner or host can edit)
            if cart_item.member_id != member.id and not member.is_host:
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "not_authorised", "detail": "Not authorized to edit this item"}
                )
            
            # Check version for optimistic locking
            if cart_item.version != data.version:
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "version_conflict", "detail": f"Item version is {cart_item.version}, not {data.version}"}
                )
            
            # Update item
            cart_item.qty = data.qty
            cart_item.note = data.note
            cart_item.version += 1
            
            session.last_activity_at = datetime.utcnow()
            db.commit()
            
            return CartItemUpdateResponse(
                data={"version": cart_item.version}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cart item: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.delete("/cart_items/{item_public_id}")
async def delete_cart_item(
    item_public_id: str,
    data: CartItemDeleteRequest,
    authorization: str = Header(..., alias="Authorization")
):
    """
    Delete cart item
    """
    try:
        member_pid = verify_auth_and_get_member(authorization, data.session_pid)
        
        with SessionLocal() as db:
            # Get session and restaurant
            session = db.query(Session).filter(Session.public_id == data.session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            check_password_validation(session, restaurant)
            
            # Get member
            member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            if not member:
                raise HTTPException(
                    status_code=401,
                    detail={"success": False, "code": "invalid_token", "detail": "Member not found in session"}
                )
            
            # Get cart item
            cart_item = db.query(CartItem).filter(
                CartItem.public_id == item_public_id,
                CartItem.session_id == session.id
            ).first()
            if not cart_item:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "item_not_found", "detail": "Cart item not found"}
                )
            
            # Check if item is in pending state (editable)
            if cart_item.state != 'pending':
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "item_not_editable", "detail": f"Cart item is {cart_item.state}, cannot be deleted"}
                )
            
            # Check authorization (owner or host can delete)
            if cart_item.member_id != member.id and not member.is_host:
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "not_authorised", "detail": "Not authorized to delete this item"}
                )
            
            # Check version for optimistic locking
            if cart_item.version != data.version:
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "version_conflict", "detail": f"Item version is {cart_item.version}, not {data.version}"}
                )
            
            # Delete item
            db.delete(cart_item)
            session.last_activity_at = datetime.utcnow()
            db.commit()
            
            return {"success": True}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting cart item: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.post("/orders", response_model=OrderSubmissionResponse)
async def submit_order(
    data: OrderSubmissionRequest,
    authorization: str = Header(..., alias="Authorization")
):
    """
    Submit cart as an order - persist to database for kitchen visibility
    """
    try:
        member_pid = verify_auth_and_get_member(authorization, data.session_pid)
        
        with SessionLocal() as db:
            # 1. Fetch session
            session = db.query(Session).filter(
                Session.public_id == data.session_pid,
                Session.state == 'active'
            ).first()
            if not session:
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            # Get restaurant and check password validation
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            check_password_validation(session, restaurant)
            
            # Verify member belongs to session
            member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            if not member:
                raise HTTPException(
                    status_code=401,
                    detail={"success": False, "code": "invalid_token", "detail": "Member not found in session"}
                )
            
            # 2. Load only pending cart_items for this session, keyed by public_id
            cart_items = db.query(CartItem, MenuItem).join(
                MenuItem, CartItem.menu_item_id == MenuItem.id
            ).filter(
                CartItem.session_id == session.id,
                CartItem.state == 'pending'
            ).all()
            
            rows = {cart_item.public_id: (cart_item, menu_item) for cart_item, menu_item in cart_items}
            
            # Check if cart is empty
            if not data.items:
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "cart_empty", "detail": "Cart is empty"}
                )
            
            # 3. Validate request items - every public_id in request must exist in cart
            economic_rows = []
            for req_item in data.items:
                if req_item.public_id not in rows:
                    raise HTTPException(
                        status_code=409,
                        detail={"success": False, "code": "item_not_found", "detail": f"Cart item {req_item.public_id} not found"}
                    )
                
                cart_item, menu_item = rows[req_item.public_id]
                # Use server values for qty and note (client may have stale data)
                economic_rows.append({
                    "id": cart_item.id,
                    "public_id": cart_item.public_id,
                    "menu_item_pid": menu_item.public_id,
                    "name": menu_item.name,
                    "qty": cart_item.qty,  # Use server qty, not client qty
                    "note": cart_item.note or "",
                    "price": menu_item.price,
                    "member_pid": db.query(Member).filter(Member.id == cart_item.member_id).first().public_id
                })
            
            # 4. Recompute canonical hash and validate
            current_hash = calculate_cart_hash([type('obj', (), row) for row in economic_rows])
            if current_hash != data.cart_hash:
                # Return cart mismatch with current snapshot
                items = [
                    CartItemResponse(
                        public_id=row["public_id"],
                        member_pid=row["member_pid"],
                        menu_item_pid=row["menu_item_pid"],
                        name=row["name"],
                        price=row["price"],
                        qty=row["qty"],
                        note=row["note"],
                        version=rows[row["public_id"]][0].version,
                        image_url=f"image_data/{restaurant.slug}/{rows[row['public_id']][1].image_path}" if restaurant and rows[row['public_id']][1].image_path else None,
                        veg_flag=rows[row['public_id']][1].veg_flag
                    )
                    for row in economic_rows
                ]
                
                members = db.query(Member).filter(Member.session_id == session.id).all()
                member_infos = [
                    MemberInfo(
                        member_pid=m.public_id,
                        nickname=m.nickname,
                        is_host=m.is_host
                    )
                    for m in members
                ]
                
                cart_version = max([item.version for item in items], default=0)
                
                cart_snapshot = CartSnapshotResponse(
                    items=items,
                    members=member_infos,
                    orders=[],
                    cart_version=cart_version
                )
                
                raise HTTPException(
                    status_code=409,
                    detail={
                        "success": False,
                        "code": "cart_mismatch",
                        "detail": "Hash differs; refresh cart.",
                        "cart_snapshot": cart_snapshot.model_dump()
                    }
                )
            
            # 5. Calculate total amount
            total_amount = sum(row["qty"] * row["price"] for row in economic_rows)
            
            # 6. Insert orders row
            order_pid = f"o_{uuid.uuid4().hex[:6]}"
            order = Order(
                public_id=order_pid,
                session_id=session.id,
                payload=economic_rows,
                cart_hash=data.cart_hash,
                total_amount=total_amount,
                pay_method=data.pay_method,
                pos_ticket=None  # Reserved for future POS push
            )
            
            db.add(order)
            
            # 7. Update cart items state to 'ordered'
            cart_item_ids = [row["id"] for row in economic_rows]
            db.query(CartItem).filter(
                CartItem.id.in_(cart_item_ids)
            ).update({CartItem.state: 'ordered'}, synchronize_session=False)
            
            session.last_activity_at = datetime.utcnow()
            db.commit()
            
            # 8. WebSocket broadcast order completion and empty cart
            if data.session_pid in connection_manager.connections:
                # Broadcast order completed event
                order_event = OrderCompletedEvent(
                    order_id=order_pid,
                    total_amount=total_amount,
                    pay_method=data.pay_method,
                    items=economic_rows
                )
                await connection_manager.broadcast_to_session(
                    data.session_pid, 
                    order_event.model_dump()
                )
                
                # Broadcast cart cleared event  
                cart_cleared_event = CartClearedEvent()
                await connection_manager.broadcast_to_session(
                    data.session_pid,
                    cart_cleared_event.model_dump()
                )
            
            # 9. Return success
            return OrderSubmissionResponse(
                data={"order_id": order_pid}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting order: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        ) 