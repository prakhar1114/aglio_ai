from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import json
import uuid
from datetime import datetime
from loguru import logger

# SQLAlchemy models / DB session
from models.schema import (
    SessionLocal, Restaurant, Session, Member, MenuItem, CartItem
)

# Pydantic event models
from models.cart_models import (
    CartMutateEvent, CartUpdateEvent, CartErrorEvent, CartItemResponse
)

# Utilities
from utils.jwt_utils import decode_ws_token
from websocket.manager import connection_manager

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

                # Handle cart-mutation messages
                if isinstance(message, dict) and "op" in message:
                    await handle_cart_mutation(websocket, message, payload["sub"], session_pid)
                else:
                    await connection_manager.send_error(
                        websocket,
                        "invalid_payload",
                        "Unsupported message format",
                    )
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WebSocket message error: {e}")
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

        # Persist cart item
        cart_item = CartItem(
            public_id=f"ci_{uuid.uuid4().hex[:8]}",
            session_id=session.id,
            member_id=member.id,
            menu_item_id=menu_item.id,
            qty=event.qty,
            note=event.note,
            version=1,
        )
        db.add(cart_item)
        db.flush()

        # Build response
        restaurant: Restaurant | None = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
        response_item = CartItemResponse(
            public_id=cart_item.public_id,
            member_pid=member.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            price=menu_item.price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            veg_flag=menu_item.veg_flag,
        )

        session.last_activity_at = datetime.utcnow()
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

        response_item = CartItemResponse(
            public_id=cart_item.public_id,
            member_pid=item_owner.public_id,
            menu_item_pid=menu_item.public_id,
            name=menu_item.name,
            price=menu_item.price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            veg_flag=menu_item.veg_flag,
        )

        session.last_activity_at = datetime.utcnow()
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
            price=menu_item.price,
            qty=cart_item.qty,
            note=cart_item.note or "",
            version=cart_item.version,
            image_url=f"image_data/{restaurant.slug}/{menu_item.image_path}" if restaurant and menu_item.image_path else None,
            veg_flag=menu_item.veg_flag,
        )

        db.delete(cart_item)
        session.last_activity_at = datetime.utcnow()
        db.commit()

        update_event = CartUpdateEvent(op="delete", item=response_item)
        await connection_manager.broadcast_to_session(session_pid, update_event.model_dump())
    except Exception as e:
        logger.error(f"Error deleting cart item: {e}")
        await connection_manager.send_error(websocket, "delete_error", "Error deleting cart item") 