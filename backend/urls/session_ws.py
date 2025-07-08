from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import json
import uuid
from datetime import datetime
from config import logger
import uuid
import secrets
from sqlalchemy import select

# SQLAlchemy models / DB session
from models.schema import (
    SessionLocal, Restaurant, Session, Member, MenuItem, CartItem, CartItemAddon, ItemVariation, AddonGroupItem, ItemAddon, Order, POSSystem
)

# Pydantic event models
from models.cart_models import (
    CartMutateEvent, CartUpdateEvent, CartErrorEvent, CartItemResponse,
    SelectedVariationResponse, SelectedAddonResponse
)

# Utilities
from utils.jwt_utils import decode_ws_token
from websocket.manager import connection_manager
from services.pos.utils import get_pos_integration_by_name
from utils.addon_helpers import resolve_addon_context, build_selected_addon_responses

# Import new models
from models.schema import CartItemVariationAddon, ItemVariationAddon

# Import AI chat functionality
from recommender.ai import generate_blocks
from common.utils import enrich_blocks


router = APIRouter()

@router.websocket("/ws/session")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time table-session communication (cart & member events)."""
    session_pid: str | None = None
    try:
        # 1. Extract session id from query params
        session_pid = websocket.query_params.get("sid")
        if not session_pid:
            await websocket.close(code=4003, reason="Missing session ID")
            return

        # 2. Extract auth token (either header or query param fallback)
        token: str | None = None
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            token = websocket.query_params.get("token")

        if not token:
            await websocket.close(code=4003, reason="Missing or invalid auth token")
            return

        # 3. Verify token & session
        payload = decode_ws_token(token)
        if not payload:
            await websocket.close(code=4003, reason="Invalid token")
            return
        if payload.get("sid") != session_pid:
            await websocket.close(code=4003, reason="Session ID mismatch")
            return

        # 4. Register connection
        connected = await connection_manager.connect(websocket, session_pid)
        if not connected:
            return  # Connection was rejected (e.g., connection limit reached)

        logger.info(f"WebSocket connected to session {session_pid}")

        # 5. Message loop
        while True:
            try:
                data = await websocket.receive_text()

                # Handle simple ping/pong keep-alive
                if data.strip() == "ping":
                    await websocket.send_text("pong")
                    continue

                # Parse JSON payload
                try:
                    message = json.loads(data)
                except json.JSONDecodeError:
                    await connection_manager.send_error(
                        websocket, "invalid_json", "Invalid JSON format"
                    )
                    continue

                # Handle different message types
                if isinstance(message, dict):
                    if "op" in message:
                        # Cart mutation message
                        await handle_cart_mutation(websocket, message, payload["sub"], session_pid)
                    elif message.get("type") == "chat_message":
                        # Chat message - handle and broadcast to AI
                        await handle_chat_message(websocket, message, payload["sub"], session_pid)
                    elif message.get("type") == "place_order":
                        # Order placement message
                        await handle_place_order(websocket, session_pid, payload["sub"], message)
                    else:
                        await connection_manager.send_error(
                            websocket,
                            "invalid_payload",
                            "Unsupported message format",
                        )
                else:
                    await connection_manager.send_error(
                        websocket,
                        "invalid_payload",
                        "Unsupported message format",
                    )
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WebSocket message error: {e}", exc_info=True)
                await connection_manager.send_error(
                    websocket, "message_error", "Error processing message"
                )

    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        if websocket.client_state.name == "CONNECTED":
            await websocket.close(code=4000, reason="Internal error")
    finally:
        if session_pid:
            connection_manager.disconnect(websocket)


async def handle_chat_message(websocket: WebSocket, message: dict, member_pid: str, session_pid: str):
    """Handle chat message and generate AI response"""
    try:
        # Extract message details
        sender_name = message.get("sender_name", "Unknown")
        user_message = message.get("message", "")
        thread_id = message.get("thread_id")
        message_id = message.get("message_id")
        
        if not user_message.strip():
            await connection_manager.send_error(
                websocket, "empty_message", "Message cannot be empty"
            )
            return
        
        logger.info(f"Chat message from {sender_name} in session {session_pid}: {user_message}")
        
        # Broadcast user message to all session members first
        user_message_event = {
            "type": "chat_user_message",
            "sender_name": sender_name,
            "message": user_message,
            "thread_id": thread_id,
            "message_id": message_id
        }
        await connection_manager.broadcast_to_session(session_pid, user_message_event)
        
        with SessionLocal() as db:
            session_record = db.query(Session).filter(Session.public_id == session_pid).first()
            if not session_record:
                logger.error(f"Session {session_pid} not found for chat")
                return
                
            restaurant = db.query(Restaurant).filter(Restaurant.id == session_record.restaurant_id).first()
            if not restaurant:
                logger.error(f"Restaurant not found for session {session_pid}")
                return
        
        # Generate AI response using existing AI system
        ai_payload = {
            "text": user_message,
            "filters": {},
            "cart": [],
            "more_context": {}
        }
        
        # # Generate blocks using AI system
        blocks = generate_blocks(ai_payload, thread_id, restaurant.slug)
        enriched_blocks = enrich_blocks(blocks, restaurant.slug)
        
        # Broadcast AI response to all session members
        ai_response_event = {
            "type": "chat_response",
            "sender_name": "AI Waiter",
            "blocks": enriched_blocks.get("blocks", []),
            "thread_id": thread_id,
            "message_id": uuid.uuid4().hex[:6]
        }
        
        logger.info(f"Sending AI response to session {session_pid}")
        await connection_manager.broadcast_to_session(session_pid, ai_response_event)
        
    except Exception as e:
        logger.error(f"Error handling chat message: {e}", exc_info=True)
        await connection_manager.send_error(
            websocket, "chat_error", "Error processing chat message"
        )


async def handle_place_order(websocket, session_pid, member_pid, data):
    """Handle order placement request"""
    with SessionLocal() as db:
        try:
            # Validate session and member
            session: Session | None = db.query(Session).filter(Session.public_id == session_pid).first()
            if not session or session.state != "active":
                await websocket.send_text(json.dumps({
                    "type": "order_failed",
                    "error": "Invalid session"
                }))
                return
                
            member: Member | None = (
                db.query(Member)
                .filter(Member.public_id == member_pid, Member.session_id == session.id)
                .first()
            )
            if not member:
                await websocket.send_text(json.dumps({
                    "type": "order_failed",
                    "error": "Invalid member"
                }))
                return
            
            # Get all pending cart items for this session
            cart_items = db.query(CartItem).filter(
                CartItem.session_id == session.id,
                CartItem.state == "pending"
            ).all()
            
            if not cart_items:
                await websocket.send_text(json.dumps({
                    "type": "order_failed",
                    "error": "No items in cart"
                }))
                return
            
            # Generate sequential order ID based on the number of existing orders for this restaurant
            # Count all orders linked to this restaurant (across all its sessions)
            order_count = (
                db.query(Order)
                .join(Session, Order.session_id == Session.id)
                .filter(Session.restaurant_id == session.restaurant_id)
                .count()
            )
            order_sequence_num = order_count + 1

            # Format: ORD-{restaurant_id}-{sequence}
            order_id = f"{order_sequence_num}"
            
            # Create Order record in database
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            new_order = Order(
                public_id=f"{restaurant.slug[0:4]}_{order_id}",
                session_id=session.id,
                initiated_by_member_id=member.id,  # Track who initiated the order
                payload=[],  # Will be filled after processing
                cart_hash="",  # Will be calculated
                total_amount=0.0,  # Will be calculated
                status="processing"
            )
            db.add(new_order)
            db.flush()  # Get the order ID
            
            # Lock all cart items and associate with order
            total_amount = 0.0
            order_payload = []

            for item in cart_items:
                item.state = "locked"
                item.order_id = new_order.id  # Associate cart item with order

                # Base & variation prices
                unit_price = item.menu_item.price  # Base menu item price (veg/food base)
                selected_variation_detail = None
                final_price_unit = unit_price  # Will adjust if variation / addons present

                if item.selected_item_variation:
                    variation_obj = item.selected_item_variation
                    final_price_unit = variation_obj.price  # Absolute price override
                    selected_variation_detail = {
                        "item_variation_id": variation_obj.id,
                        "variation_name": variation_obj.variation.name,
                        "group_name": variation_obj.variation.group_name,
                        "price": variation_obj.price,
                    }

                # Addons
                selected_addons_detail, addons_total_per_unit = build_addon_details(item)

                # Final unit price after addons
                final_price_unit += addons_total_per_unit

                line_total = final_price_unit * item.qty
                total_amount += line_total

                order_payload.append({
                    "public_id": item.public_id,
                    "cart_item_id": item.public_id,
                    "menu_item_id": item.menu_item.public_id,
                    "menu_item_pid": item.menu_item.public_id,
                    "name": item.menu_item.name,
                    "qty": item.qty,
                    "unit_price": unit_price,
                    "final_price": final_price_unit,  # per-unit final price including addons & variation
                    "total": line_total,
                    "note": item.note or "",
                    "member_pid": item.member.public_id,
                    "selected_variation": selected_variation_detail,
                    "selected_addons": selected_addons_detail,
                })
            
            # Update order with payload and total
            new_order.payload = order_payload
            new_order.total_amount = total_amount
            new_order.cart_hash = f"hash_{len(cart_items)}_{total_amount}"  # Simple hash
            
            db.commit()
            
            # Broadcast cart locked to all session members
            lock_message = {
                "type": "cart_locked",
                "order_id": order_id,
                "locked_by_member": member.public_id,
                "locked_by_nickname": member.nickname,
                "total_amount": total_amount
            }
            await connection_manager.broadcast_to_session(session_pid, lock_message)
            
            # Determine POS usage and process the order accordingly
            success, pos_order_id, pos_response, pos_used = await process_order_with_pos(
                session.restaurant_id, new_order, session, member, db
            )
            
            # Update order record with POS response
            if success:
                new_order.pos_order_id = pos_order_id or order_id
                new_order.pos_response = [pos_response]
                new_order.status = "confirmed"
                new_order.confirmed_at = datetime.utcnow()
                
                # Mark all cart items as ordered (keep them for order history)
                for item in cart_items:
                    item.state = "ordered"
                
                db.commit()
                
                # Broadcast success to all session members
                success_message = {
                    "type": "order_confirmed",
                    "order_id": order_id,
                    "order": {
                        "id": order_id,
                        "orderNumber": order_sequence_num,
                        "timestamp": new_order.created_at.isoformat(),
                        "items": order_payload,
                        "total": total_amount,
                        "initiated_by": {
                            "member_pid": member.public_id,
                            "nickname": member.nickname
                        }
                    }
                }
                await connection_manager.broadcast_to_session(session_pid, success_message)

                # If NO POS integration was used, notify the admin dashboard
                if not pos_used:
                    try:
                        from urls.admin.dashboard_ws import dashboard_manager
                        restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()

                        admin_notification = {
                            "type": "order_notification",
                            "order": {
                                "id": order_id,
                                "order_number": order_sequence_num,
                                "table_id": session.table.id,
                                "table_number": session.table.number,
                                "timestamp": new_order.created_at.isoformat() + "Z",
                                "items": order_payload
                            }
                        }

                        await dashboard_manager.broadcast_to_session(restaurant.slug, admin_notification)
                        logger.info(f"Sent order notification to admin dashboard for restaurant {restaurant.slug}")

                    except Exception as e:
                        logger.error(f"Failed to send order notification to admin dashboard: {e}")
            else:
                # Mark order as failed
                new_order.status = "failed" 
                new_order.failed_at = datetime.utcnow()
                new_order.pos_response = pos_response  # Store error details
                
                # UNLOCK cart items - revert to pending state
                for item in cart_items:
                    item.state = "pending"
                    item.order_id = None  # Remove order association
                
                db.commit()
                
                # Broadcast failure to all session members
                failure_message = {
                    "type": "order_failed",
                    "order_id": order_id,
                    "error": "Order processing failed"
                }
                await connection_manager.broadcast_to_session(session_pid, failure_message)
                            
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing order: {e}")
            await websocket.send_text(json.dumps({
                "type": "order_failed",
                "error": "Internal server error"
            }))


async def process_order_with_pos(restaurant_id: int, order: Order, session: Session, member: Member, db):
    """Process order with POS integration"""
    try:
        # Check if a POS integration exists for this restaurant
        pos_integration = get_pos_integration_by_name(restaurant_id, "petpooja", db)
        pos_used = pos_integration is not None

        if pos_used:
            # POS-enabled restaurant – delegate order to POS system
            result = await pos_integration.place_order({
                "order": order,
                "session": session,
                "member": member,
                "table_number": session.table.number,
            })

            if result.get("success"):
                return True, result.get("pos_order_id"), result, True
            else:
                return False, None, result, True
        else:
            # No POS integration – treat as manual confirmation
            logger.info(f"No POS integration found for restaurant {restaurant_id}; confirming order manually")
            return True, None, {"success": True, "message": "Manual confirmation - no POS integration"}, False

    except Exception as e:
        logger.error(f"Error in POS order processing: {e}")
        return False, None, {"error": str(e)}, False


async def process_order_dummy(order_id, order_payload, total_amount):
    """Dummy POS integration - simulates order processing with 3 second delay"""
    import asyncio
    import random
    
    logger.info(f"Processing order {order_id} with dummy POS system...")
    
    # Simulate 3-second processing time
    await asyncio.sleep(3)
    
    # 90% success rate for testing
    if random.random() < 0.9:
        logger.info(f"Order {order_id} processed successfully")
        return True
    else:
        logger.warning(f"Order {order_id} failed - POS system error")
        return False

# ---------------------------------------------------------------------------
# Cart-mutation helpers
# ---------------------------------------------------------------------------

async def handle_cart_mutation(
    websocket: WebSocket, message: dict, member_pid: str, session_pid: str
):
    """Entry point for all cart-mutation messages coming from the client."""
    try:
        cart_event = CartMutateEvent(**message)

        with SessionLocal() as db:
            # Validate session is active
            session: Session | None = db.query(Session).filter(Session.public_id == session_pid).first()
            if not session or session.state != "active":
                await connection_manager.send_error(websocket, "session_closed", "Session is closed")
                return

            # Ensure restaurant pass (if required) has been validated
            restaurant: Restaurant | None = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            if restaurant.require_pass and not session.pass_validated:
                await connection_manager.send_error(websocket, "pass_required", "Daily password required")
                return

            # Fetch member performing the mutation
            member: Member | None = (
                db.query(Member)
                .filter(Member.public_id == member_pid, Member.session_id == session.id)
                .first()
            )
            if not member:
                await connection_manager.send_error(websocket, "member_not_found", "Member not found in session")
                return

            # Dispatch operation
            if cart_event.op == "create":
                await handle_cart_create(websocket, cart_event, member, session, session_pid, db)
            elif cart_event.op == "update":
                await handle_cart_update(websocket, cart_event, member, session, session_pid, db)
            elif cart_event.op == "delete":
                await handle_cart_delete(websocket, cart_event, member, session, session_pid, db)
            elif cart_event.op == "replace":
                await handle_cart_replace(websocket, cart_event, member, session, session_pid, db)
            else:
                await connection_manager.send_error(
                    websocket, "invalid_operation", f"Unknown operation: {cart_event.op}"
                )
    except Exception as e:
        logger.error(f"Error handling cart mutation: {e}")
        await connection_manager.send_error(websocket, "mutation_error", "Error processing cart mutation")


async def handle_cart_create(
    websocket: WebSocket,
    event: CartMutateEvent,
    member: Member,
    session: Session,
    session_pid: str,
    db,
):
    """Create a new cart item."""
    try:
        if not event.menu_item_id:
            await connection_manager.send_error(websocket, "bad_request", "menu_item_id required for create operation")
            return

        # Validate menu item exists
        menu_item: MenuItem | None = db.query(MenuItem).filter(MenuItem.public_id == event.menu_item_id).first()
        if not menu_item:
            await connection_manager.send_error(websocket, "menu_item_not_found", "Menu item not found")
            return

        # Validate item variation if provided
        selected_variation = None
        if event.selected_item_variation_id:
            from models.schema import ItemVariation
            selected_variation = db.query(ItemVariation).filter(
                ItemVariation.id == event.selected_item_variation_id,
                ItemVariation.menu_item_id == menu_item.id,
                ItemVariation.is_active == True
            ).first()
            if not selected_variation:
                await connection_manager.send_error(websocket, "invalid_variation", "Invalid variation for this menu item")
                return

        # Determine if variation overrides addon groups
        variation_has_override = bool(selected_variation and selected_variation.variation_addons)

        # Build allowed addon group id set
        allowed_group_ids: set[int] = set()
        if variation_has_override:
            for iva in selected_variation.variation_addons:
                if iva.is_active and iva.addon_group.is_active:
                    allowed_group_ids.add(iva.addon_group_id)
        else:
            # Base item addon groups
            for ia in menu_item.item_addons:
                if ia.is_active and ia.addon_group.is_active:
                    allowed_group_ids.add(ia.addon_group_id)

        # Validate addons if provided
        addon_items: list[tuple] = []
        if event.selected_addons:

            for addon_selection in event.selected_addons:
                # Get the addon item
                addon_item = db.query(AddonGroupItem).filter(
                    AddonGroupItem.id == addon_selection.addon_group_item_id,
                    AddonGroupItem.is_active == True,
                ).first()

                if not addon_item:
                    await connection_manager.send_error(
                        websocket,
                        "invalid_addon",
                        f"Invalid addon item: {addon_selection.addon_group_item_id}",
                    )
                    return
                
                if addon_item.addon_group_id not in allowed_group_ids:
                    await connection_manager.send_error(
                        websocket,
                        "addon_not_allowed",
                        f"Addon not allowed for this selection: {addon_item.name}",
                    )
                    return
                
                addon_items.append((addon_item, addon_selection.quantity))

        # Persist cart item
        cart_item = CartItem(
            public_id=f"ci_{uuid.uuid4().hex[:8]}",
            session_id=session.id,
            member_id=member.id,
            menu_item_id=menu_item.id,
            selected_item_variation_id=selected_variation.id if selected_variation else None,
            qty=event.qty,
            note=event.note,
            version=1,
        )
        db.add(cart_item)
        db.flush()

        # Add selected addons to appropriate table
        if variation_has_override:
        for addon_item, quantity in addon_items:
                db.add(
                    CartItemVariationAddon(
                cart_item_id=cart_item.id,
                        item_variation_id=selected_variation.id if selected_variation else None,
                addon_item_id=addon_item.id,
                        quantity=quantity,
                    )
            )
        else:
            for addon_item, quantity in addon_items:
                db.add(
                    CartItemAddon(
                        cart_item_id=cart_item.id,
                        addon_item_id=addon_item.id,
                        quantity=quantity,
                    )
                )

        # Build response with price calculations
        restaurant: Restaurant | None = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
        
        # Calculate final price
        final_price = menu_item.price
        
        # Add variation price (absolute price, not modifier)
        selected_variation_response = None
        if selected_variation:
            final_price = selected_variation.price  # Use absolute price
            selected_variation_response = SelectedVariationResponse(
                item_variation_id=selected_variation.id,
                variation_name=selected_variation.variation.name,
                group_name=selected_variation.variation.group_name,
                price=selected_variation.price
            )
        
        # Add addon prices and build addon responses
        selected_addons_response, addons_total = build_selected_addon_responses([
            type('obj', (object,), {
                'addon_item': addon_item,
                'quantity': quantity
            }) for addon_item, quantity in addon_items
        ])
        final_price += addons_total

        # Split responses for payload fields
        selected_addons_field = selected_addons_response if not variation_has_override else []
        selected_variation_addons_field = selected_addons_response if variation_has_override else []
        
        response_item = CartItemResponse(
            public_id=cart_item.public_id,
            member_pid=member.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            base_price=menu_item.price,
            final_price=final_price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            cloudflare_image_id=menu_item.cloudflare_image_id,
            cloudflare_video_id=menu_item.cloudflare_video_id,
            veg_flag=menu_item.veg_flag,
            selected_variation=selected_variation_response,
            selected_addons=selected_addons_field,
            selected_variation_addons=selected_variation_addons_field
        )

        setattr(session, 'last_activity_at', datetime.utcnow())
        db.commit()

        update_event = CartUpdateEvent(op="create", item=response_item, tmpId=event.tmpId)
        await connection_manager.broadcast_to_session(session_pid, update_event.model_dump())
    except Exception as e:
        logger.error(f"Error creating cart item: {e}")
        await connection_manager.send_error(websocket, "create_error", "Error creating cart item")


async def handle_cart_update(
    websocket: WebSocket,
    event: CartMutateEvent,
    member: Member,
    session: Session,
    session_pid: str,
    db,
):
    """Update an existing cart item."""
    try:
        if not event.public_id or event.version is None:
            await connection_manager.send_error(websocket, "bad_request", "public_id and version required for update operation")
            return

        cart_item: CartItem | None = (
            db.query(CartItem)
            .filter(CartItem.public_id == event.public_id, CartItem.session_id == session.id)
            .first()
        )
        if not cart_item:
            await connection_manager.send_error(websocket, "item_not_found", "Cart item not found")
            return

        if cart_item.state != "pending":
            await connection_manager.send_error(websocket, "item_not_editable", f"Cart item is {cart_item.state}, cannot be edited")
            return

        if cart_item.member_id != member.id and not member.is_host:
            await connection_manager.send_error(websocket, "not_authorised", "Not authorized to edit this item")
            return

        if cart_item.version != event.version:
            # Send current item data for conflict resolution
            current_member = db.query(Member).filter(Member.id == cart_item.member_id).first()
            menu_item = db.query(MenuItem).filter(MenuItem.id == cart_item.menu_item_id).first()
            current_item = {
                "public_id": cart_item.public_id,
                "member_pid": current_member.public_id,
                "menu_item_pid": menu_item.public_id,
                "name": menu_item.name,
                "qty": cart_item.qty,
                "note": cart_item.note or "",
                "version": cart_item.version,
            }
            error_event = CartErrorEvent(
                code="version_conflict",
                detail=f"Item version is {cart_item.version}, not {event.version}",
                currentItem=current_item,
            )
            await websocket.send_text(json.dumps(error_event.model_dump()))
            return

        # Apply update
        cart_item.qty = event.qty
        cart_item.note = event.note
        cart_item.version += 1

        menu_item = db.query(MenuItem).filter(MenuItem.id == cart_item.menu_item_id).first()
        item_owner = db.query(Member).filter(Member.id == cart_item.member_id).first()
        restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()

        # Read current variation from database
        selected_variation_response = None
        final_price = menu_item.price
        
        if cart_item.selected_item_variation_id:
            selected_variation = db.query(ItemVariation).filter(
                ItemVariation.id == cart_item.selected_item_variation_id,
                ItemVariation.is_active == True
            ).first()
            if selected_variation:
                final_price = selected_variation.price  # Use absolute price
                selected_variation_response = SelectedVariationResponse(
                    item_variation_id=selected_variation.id,
                    variation_name=selected_variation.variation.name,
                    group_name=selected_variation.variation.group_name,
                    price=selected_variation.price
                )
        
        addon_rows, source = resolve_addon_context(cart_item)
        selected_addons_response, addons_total = build_selected_addon_responses(addon_rows)
        final_price += addons_total
            
        selected_addons_field = selected_addons_response if source == "base" else []
        selected_variation_addons_field = selected_addons_response if source == "variation" else []

        response_item = CartItemResponse(
            public_id=cart_item.public_id,
            member_pid=item_owner.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            base_price=menu_item.price,
            final_price=final_price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            cloudflare_image_id=menu_item.cloudflare_image_id,
            cloudflare_video_id=menu_item.cloudflare_video_id,
            veg_flag=menu_item.veg_flag,
            selected_variation=selected_variation_response,
            selected_addons=selected_addons_field,
            selected_variation_addons=selected_variation_addons_field
        )

        setattr(session, 'last_activity_at', datetime.utcnow())
        db.commit()

        update_event = CartUpdateEvent(op="update", item=response_item)
        await connection_manager.broadcast_to_session(session_pid, update_event.model_dump())
    except Exception as e:
        logger.error(f"Error updating cart item: {e}")
        await connection_manager.send_error(websocket, "update_error", "Error updating cart item")


async def handle_cart_delete(
    websocket: WebSocket,
    event: CartMutateEvent,
    member: Member,
    session: Session,
    session_pid: str,
    db,
):
    """Delete a cart item."""
    try:
        if not event.public_id or event.version is None:
            await connection_manager.send_error(websocket, "bad_request", "public_id and version required for delete operation")
            return

        cart_item: CartItem | None = (
            db.query(CartItem)
            .filter(CartItem.public_id == event.public_id, CartItem.session_id == session.id)
            .first()
        )
        if not cart_item:
            await connection_manager.send_error(websocket, "item_not_found", "Cart item not found")
            return

        if cart_item.state != "pending":
            await connection_manager.send_error(websocket, "item_not_editable", f"Cart item is {cart_item.state}, cannot be deleted")
            return

        if cart_item.member_id != member.id and not member.is_host:
            await connection_manager.send_error(websocket, "not_authorised", "Not authorized to delete this item")
            return

        if cart_item.version != event.version:
            await connection_manager.send_error(websocket, "version_conflict", f"Item version is {cart_item.version}, not {event.version}")
            return

        menu_item = db.query(MenuItem).filter(MenuItem.id == cart_item.menu_item_id).first()
        item_owner = db.query(Member).filter(Member.id == cart_item.member_id).first()
        restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()

        response_item = CartItemResponse(
            public_id=cart_item.public_id,
            member_pid=item_owner.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            base_price=menu_item.price,
            final_price=menu_item.price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            cloudflare_image_id=menu_item.cloudflare_image_id,
            cloudflare_video_id=menu_item.cloudflare_video_id,
            veg_flag=menu_item.veg_flag,
        )

        # Delete associated addon records first (both base & variation)
        db.query(CartItemAddon).filter(CartItemAddon.cart_item_id == cart_item.id).delete()
        db.query(CartItemVariationAddon).filter(CartItemVariationAddon.cart_item_id == cart_item.id).delete()
        db.delete(cart_item)
        setattr(session, 'last_activity_at', datetime.utcnow())
        db.commit()

        update_event = CartUpdateEvent(op="delete", item=response_item)
        await connection_manager.broadcast_to_session(session_pid, update_event.model_dump())
    except Exception as e:
        logger.error(f"Error deleting cart item: {e}")
        await connection_manager.send_error(websocket, "delete_error", "Error deleting cart item") 


async def handle_cart_replace(
    websocket: WebSocket,
    event: CartMutateEvent,
    member: Member,
    session: Session,
    session_pid: str,
    db,
):
    """Replace a cart item with new variations/addons (atomic delete + create)."""
    try:
        if not event.public_id or event.version is None or not event.menu_item_id:
            await connection_manager.send_error(websocket, "bad_request", "public_id, version, and menu_item_id required for replace operation")
            return

        # Validate existing cart item (same as delete logic)
        cart_item: CartItem | None = (
            db.query(CartItem)
            .filter(CartItem.public_id == event.public_id, CartItem.session_id == session.id)
            .first()
        )
        if not cart_item:
            await connection_manager.send_error(websocket, "item_not_found", "Cart item not found")
            return

        if cart_item.state != "pending":
            await connection_manager.send_error(websocket, "item_not_editable", f"Cart item is {cart_item.state}, cannot be replaced")
            return

        if cart_item.member_id != member.id and not member.is_host:
            await connection_manager.send_error(websocket, "not_authorised", "Not authorized to replace this item")
            return

        if cart_item.version != event.version:
            await connection_manager.send_error(websocket, "version_conflict", f"Item version is {cart_item.version}, not {event.version}")
            return

        # Validate new menu item exists (same as create logic)
        menu_item: MenuItem | None = db.query(MenuItem).filter(MenuItem.public_id == event.menu_item_id).first()
        if not menu_item:
            await connection_manager.send_error(websocket, "menu_item_not_found", "Menu item not found")
            return

        # Validate new item variation if provided
        selected_variation = None
        if event.selected_item_variation_id:
            selected_variation = db.query(ItemVariation).filter(
                ItemVariation.id == event.selected_item_variation_id,
                ItemVariation.menu_item_id == menu_item.id,
                ItemVariation.is_active == True
            ).first()
            if not selected_variation:
                await connection_manager.send_error(websocket, "invalid_variation", "Invalid variation for this menu item")
                return

        # Determine if variation overrides addon groups
        variation_has_override = bool(selected_variation and selected_variation.variation_addons)

        # Build allowed addon group id set
        allowed_group_ids: set[int] = set()
        if variation_has_override:
            for iva in selected_variation.variation_addons:
                if iva.is_active and iva.addon_group.is_active:
                    allowed_group_ids.add(iva.addon_group_id)
        else:
            # Base item addon groups
            for ia in menu_item.item_addons:
                if ia.is_active and ia.addon_group.is_active:
                    allowed_group_ids.add(ia.addon_group_id)

        # Validate new addons if provided
        addon_items: list[tuple] = []
        if event.selected_addons:
            for addon_selection in event.selected_addons:
                # Get the addon item
                addon_item = db.query(AddonGroupItem).filter(
                    AddonGroupItem.id == addon_selection.addon_group_item_id,
                    AddonGroupItem.is_active == True
                ).first()
                if not addon_item:
                    await connection_manager.send_error(websocket, "invalid_addon", f"Invalid addon item: {addon_selection.addon_group_item_id}")
                    return
                
                # Check if this addon group is linked to this menu item
                addon_link = db.query(ItemAddon).filter(
                    ItemAddon.menu_item_id == menu_item.id,
                    ItemAddon.addon_group_id == addon_item.addon_group_id,
                    ItemAddon.is_active == True
                ).first()
                if not addon_link:
                    await connection_manager.send_error(websocket, "addon_not_allowed", f"Addon not allowed for this menu item: {addon_item.name}")
                    return
                
                addon_items.append((addon_item, addon_selection.quantity))

        # Get restaurant for image URL construction
        restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()

        # Update the existing cart item with new values
        cart_item.menu_item_id = menu_item.id
        cart_item.selected_item_variation_id = selected_variation.id if selected_variation else None
        cart_item.qty = event.qty
        cart_item.note = event.note
        cart_item.version += 1  # Increment version
        
        # Clear existing addons (both base and variation) before inserting new ones
        db.query(CartItemAddon).filter(CartItemAddon.cart_item_id == cart_item.id).delete()
        db.query(CartItemVariationAddon).filter(CartItemVariationAddon.cart_item_id == cart_item.id).delete()
        db.flush()  # Ensure delete is processed before adding new ones

        # Add new selected addons
        for addon_item, quantity in addon_items:
            cart_addon = CartItemAddon(
                cart_item_id=cart_item.id,
                addon_item_id=addon_item.id,
                quantity=quantity
            )
            db.add(cart_addon)

        # Build response with updated item and price calculations
        final_price = menu_item.price
        
        # Add variation price (absolute price, not modifier)
        selected_variation_response = None
        if selected_variation:
            final_price = selected_variation.price  # Use absolute price
            selected_variation_response = SelectedVariationResponse(
                item_variation_id=selected_variation.id,
                variation_name=selected_variation.variation.name,
                group_name=selected_variation.variation.group_name,
                price=selected_variation.price
            )
        
        # Add addon prices and build addon responses
        selected_addons_response, addons_total = build_selected_addon_responses([
            type('obj', (object,), {
                'addon_item': addon_item,
                'quantity': quantity
            }) for addon_item, quantity in addon_items
        ])
        final_price += addons_total

        # Split responses for payload fields
        selected_addons_field = selected_addons_response if not variation_has_override else []
        selected_variation_addons_field = selected_addons_response if variation_has_override else []
        
        response_item = CartItemResponse(
            public_id=cart_item.public_id,  # Same cart item ID
            member_pid=member.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            base_price=menu_item.price,
            final_price=final_price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,  # Updated version
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            cloudflare_image_id=menu_item.cloudflare_image_id,
            cloudflare_video_id=menu_item.cloudflare_video_id,
            veg_flag=menu_item.veg_flag,
            selected_variation=selected_variation_response,
            selected_addons=selected_addons_field,
            selected_variation_addons=selected_variation_addons_field
        )

        session.last_activity_at = datetime.utcnow()
        db.commit()

        # Send single update event for the modified item
        update_event = CartUpdateEvent(op="update", item=response_item)
        await connection_manager.broadcast_to_session(session_pid, update_event.model_dump())
        
    except Exception as e:
        logger.error(f"Error replacing cart item: {e}")
        await connection_manager.send_error(websocket, "replace_error", "Error replacing cart item") 

# Helper to compute addon details (mirrors cart snapshot logic)
def build_addon_details(cart_item):
    addon_rows, _ = resolve_addon_context(cart_item)
    details, total = build_selected_addon_responses(addon_rows)
    # Convert list of SelectedAddonResponse objects to dicts for legacy payload shape
    return [d.model_dump() for d in details], total
