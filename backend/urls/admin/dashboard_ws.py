import json
import asyncio
from time import time
from typing import Dict, List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import BaseModel, ValidationError
from datetime import datetime

from models.schema import SessionLocal
from websocket.manager import ConnectionManager
from .auth_utils import decode_admin_jwt_token
from .dashboard import get_restaurant_by_slug
from services.table_service import (
    get_all_tables, close_table_service, disable_table_service,
    enable_table_service, restore_table_service, move_table_service
)
from models.schema import WaiterRequest, Table, Member, Order, Session, Restaurant


router = APIRouter()


class DashboardManager(ConnectionManager):
    """Specialized connection manager for admin dashboards with ping-pong keepalive"""
    
    def __init__(self):
        super().__init__()
        # Override the connections dict to use restaurant_slug instead of session_pid
        # restaurant_slug -> list of WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}
        # websocket -> restaurant_slug mapping for cleanup
        self.websocket_sessions: Dict[WebSocket, str] = {}
        
        # Ping-pong state for admin connections
        self.ping_tasks: Dict[WebSocket, asyncio.Task] = {}
        self.last_pong: Dict[WebSocket, float] = {}
        self.ping_interval = 50  # seconds
        self.pong_timeout = 12   # seconds
    
    async def connect(self, websocket: WebSocket, restaurant_slug: str) -> bool:
        """
        Add a WebSocket connection to a restaurant dashboard
        
        Args:
            websocket: WebSocket connection
            restaurant_slug: Restaurant slug
            
        Returns:
            True if connection added, False if restaurant is at capacity
        """
        await websocket.accept()
        
        # Initialize restaurant connections list if needed
        if restaurant_slug not in self.connections:
            self.connections[restaurant_slug] = []
            
        # Check connection limit (max 20 per restaurant)
        if len(self.connections[restaurant_slug]) >= 20:
            await websocket.close(code=4008, reason="Connection limit exceeded")
            return False
            
        # Add connection
        self.connections[restaurant_slug].append(websocket)
        self.websocket_sessions[websocket] = restaurant_slug
        
        # Start ping task for this admin connection
        ping_task = asyncio.create_task(self._ping_loop(websocket))
        self.ping_tasks[websocket] = ping_task
        self.last_pong[websocket] = time()
        
        logger.info(f"Dashboard WebSocket connected for restaurant {restaurant_slug}. Total connections: {len(self.connections[restaurant_slug])}")
        return True
    
    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection
        
        Args:
            websocket: WebSocket connection to remove
        """
        restaurant_slug = self.websocket_sessions.get(websocket)
        
        # Cancel ping task
        if websocket in self.ping_tasks:
            self.ping_tasks[websocket].cancel()
            del self.ping_tasks[websocket]
            
        if websocket in self.last_pong:
            del self.last_pong[websocket]
        
        if not restaurant_slug:
            return
            
        # Remove from connections
        if restaurant_slug in self.connections:
            try:
                self.connections[restaurant_slug].remove(websocket)
                if not self.connections[restaurant_slug]:  # Remove empty restaurant
                    del self.connections[restaurant_slug]
            except ValueError:
                pass  # Connection already removed
                
        # Remove from websocket mapping
        if websocket in self.websocket_sessions:
            del self.websocket_sessions[websocket]
            
        logger.info(f"Dashboard WebSocket disconnected from restaurant {restaurant_slug}")
    
    async def handle_pong(self, websocket: WebSocket):
        """Update last pong timestamp for admin connection"""
        self.last_pong[websocket] = time()
        logger.debug("Received pong from admin dashboard")
    
    async def _ping_loop(self, websocket: WebSocket):
        """Periodic ping sender with timeout checking for admin connections"""
        try:
            while True:
                await asyncio.sleep(self.ping_interval)
                
                # Check if connection is still tracked
                if websocket not in self.last_pong:
                    break
                    
                # Check for pong timeout
                time_since_pong = time() - self.last_pong[websocket]
                if time_since_pong > (self.ping_interval + self.pong_timeout):
                    logger.warning(f"Admin dashboard pong timeout, disconnecting")
                    await self._force_disconnect(websocket)
                    break
                    
                # Send ping
                try:
                    await websocket.send_text("ping")
                    logger.debug("Sent ping to admin dashboard")
                except Exception as e:
                    logger.warning(f"Failed to send ping to admin dashboard: {e}")
                    await self._force_disconnect(websocket)
                    break
                    
        except asyncio.CancelledError:
            logger.debug("Admin ping task cancelled")
        except Exception as e:
            logger.error(f"Admin ping loop error: {e}")
    
    async def _force_disconnect(self, websocket: WebSocket):
        """Force disconnect a stale admin connection"""
        try:
            await websocket.close(code=4001, reason="Ping timeout")
        except:
            pass  # Connection might already be closed
        finally:
            self.disconnect(websocket)

    async def broadcast_table_update(self, restaurant_slug: str, table_data: dict):
        """
        Broadcast a table update to all dashboard connections for a restaurant
        
        Args:
            restaurant_slug: Restaurant slug
            table_data: Table data dict to broadcast
        """
        if restaurant_slug not in self.connections:
            return
            
        update_message = {
            "type": "table_update",
            "table": table_data
        }
        
        await self.broadcast_to_session(restaurant_slug, update_message)
    
    async def broadcast_to_session(self, restaurant_slug: str, message: dict):
        """
        Broadcast a message to all dashboard connections for a restaurant
        
        Args:
            restaurant_slug: Restaurant slug
            message: Message dict to broadcast
        """
        if restaurant_slug not in self.connections:
            return
            
        # Create list copy to avoid modification during iteration
        connections = self.connections[restaurant_slug].copy()
        
        for websocket in connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send message to dashboard WebSocket for restaurant {restaurant_slug}: {e}")
                # Remove broken connection
                self.disconnect(websocket)


# Create dashboard-specific connection manager
dashboard_manager = DashboardManager()


class DashboardAction(BaseModel):
    action: str
    table_id: Optional[int] = None
    from_table_id: Optional[int] = None  # For move action
    to_table_id: Optional[int] = None    # For move action
    request_id: Optional[str] = None     # For resolve_waiter_request action
    order_id: Optional[str] = None       # For acknowledge_order action
    updated_order: Optional[dict] = None  # For edit_order action


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time dashboard updates"""
    restaurant_slug: Optional[str] = None
    
    try:
        # 1. Extract auth token from query params (WebSocket doesn't support custom headers reliably)
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4003, reason="Missing auth token")
            return
        
        # 2. Validate token and get restaurant slug
        auth_data = decode_admin_jwt_token(token)
        if not auth_data:
            await websocket.close(code=4003, reason="Invalid token")
            return
        
        restaurant_slug = auth_data["restaurant_slug"]
        
        # 3. Connect to dashboard manager
        connected = await dashboard_manager.connect(websocket, restaurant_slug)
        if not connected:
            return  # Connection was rejected
        
        logger.info(f"Dashboard WebSocket connected for restaurant: {restaurant_slug}")
        
        # 4. Send initial tables snapshot
        await send_tables_snapshot(websocket, restaurant_slug)
        
        # 5. Send pending waiter requests
        await send_pending_waiter_requests(websocket, restaurant_slug)
        
        # 6. Send pending orders
        await send_pending_orders(websocket, restaurant_slug)
        
        # 6. Message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                
                # Handle ping/pong for admin keepalive
                if data.strip() == "ping":
                    await websocket.send_text("pong")
                    continue
                elif data.strip() == "pong":
                    await dashboard_manager.handle_pong(websocket)
                    continue
                
                # Parse JSON message
                try:
                    message_data = json.loads(data)
                except json.JSONDecodeError:
                    await dashboard_manager.send_error(
                        websocket, "invalid_json", "Invalid JSON format"
                    )
                    continue
                
                # Validate action message
                try:
                    action = DashboardAction(**message_data)
                except ValidationError as e:
                    await dashboard_manager.send_error(
                        websocket, "invalid_action", f"Invalid action format: {e}"
                    )
                    continue
                
                # Handle the action
                await handle_dashboard_action(websocket, action, restaurant_slug)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"Dashboard WebSocket message error: {e}", exc_info=True)
                await dashboard_manager.send_error(
                    websocket, "message_error", "Error processing message"
                )
    
    except Exception as e:
        logger.error(f"Dashboard WebSocket connection error: {e}")
        if websocket.client_state.name == "CONNECTED":
            await websocket.close(code=4000, reason="Internal error")
    finally:
        if restaurant_slug:
            dashboard_manager.disconnect(websocket)


async def send_tables_snapshot(websocket: WebSocket, restaurant_slug: str):
    """Send initial tables snapshot to the connected client"""
    try:
        with SessionLocal() as db:
            restaurant = get_restaurant_by_slug(db, restaurant_slug)
            tables = await get_all_tables(db, restaurant)
            
            snapshot_message = {
                "type": "tables_snapshot",
                "tables": [table.to_dict() for table in tables]
            }
            
            await websocket.send_text(json.dumps(snapshot_message))
            logger.info(f"Sent tables snapshot to {restaurant_slug}: {len(tables)} tables")
    
    except Exception as e:
        logger.error(f"Error sending tables snapshot: {e}")
        await dashboard_manager.send_error(
            websocket, "snapshot_error", "Failed to load tables"
        )


async def send_pending_waiter_requests(websocket: WebSocket, restaurant_slug: str):
    """Send all pending waiter requests to the connected client"""
    try:
        with SessionLocal() as db:
            restaurant = get_restaurant_by_slug(db, restaurant_slug)
            
            # Get all pending waiter requests for this restaurant
            requests = db.query(WaiterRequest, Table, Member).join(
                Table, WaiterRequest.table_id == Table.id
            ).join(
                Member, WaiterRequest.member_id == Member.id
            ).filter(
                Table.restaurant_id == restaurant.id,
                WaiterRequest.status == "pending"
            ).order_by(WaiterRequest.created_at.asc()).all()  # Oldest first
            
            request_list = []
            for waiter_request, table, member in requests:
                request_list.append({
                    "id": waiter_request.public_id,
                    "table_id": table.id,
                    "table_number": table.number,
                    "request_type": waiter_request.request_type,
                    "member_name": member.nickname,
                    "created_at": waiter_request.created_at.isoformat() + "Z",  # Add Z for UTC
                })
            
            requests_message = {
                "type": "pending_waiter_requests",
                "requests": request_list
            }
            
            await websocket.send_text(json.dumps(requests_message))
            logger.info(f"Sent pending waiter requests to {restaurant_slug}: {len(request_list)} requests")
    
    except Exception as e:
        logger.error(f"Error sending pending waiter requests: {e}")
        await dashboard_manager.send_error(
            websocket, "requests_error", "Failed to load pending requests"
        )


async def send_pending_orders(websocket: WebSocket, restaurant_slug: str):
    """Send all pending orders (status='placed') to the connected admin"""
    try:
        with SessionLocal() as db:
            restaurant = get_restaurant_by_slug(db, restaurant_slug)
            
            # Get all orders with status="placed" for this restaurant
            orders = db.query(Order, Session, Table, Member).join(
                Session, Order.session_id == Session.id
            ).join(
                Table, Session.table_id == Table.id
            ).join(
                Member, Order.initiated_by_member_id == Member.id
            ).filter(
                Session.restaurant_id == restaurant.id,
                Order.status == "placed"
            ).order_by(Order.created_at.asc()).all()  # Oldest first
            
            order_list = []
            for order, session, table, member in orders:
                order_list.append({
                    "id": order.public_id,
                    "order_number": order.public_id.split("_")[1],  # Extract number from SLUG_123
                    "table_id": table.id,
                    "table_number": table.number,
                    "timestamp": order.created_at.isoformat() + "Z",
                    "customer_name": member.nickname,
                    "items": order.payload,
                    "total": order.total_amount,
                    "special_instructions": "",  # Can be enhanced later
                    "initiated_by": {
                        "member_pid": member.public_id,
                        "nickname": member.nickname
                    }
                })
            
            orders_message = {
                "type": "pending_orders",
                "orders": order_list
            }
            
            await websocket.send_text(json.dumps(orders_message))
            logger.info(f"Sent pending orders to {restaurant_slug}: {len(order_list)} orders")
    
    except Exception as e:
        logger.error(f"Error sending pending orders: {e}")
        await dashboard_manager.send_error(
            websocket, "orders_error", "Failed to load pending orders"
        )


async def resolve_waiter_request_service(db, restaurant, request_id: str):
    """
    Resolve a waiter request
    
    Returns:
        tuple: (success: bool, error_code: str)
    """
    try:
        # Find the waiter request
        waiter_request = db.query(WaiterRequest).join(
            Table, WaiterRequest.table_id == Table.id
        ).filter(
            WaiterRequest.public_id == request_id,
            Table.restaurant_id == restaurant.id,
            WaiterRequest.status == "pending"
        ).first()
        
        if not waiter_request:
            return False, "request_not_found"
        
        # Mark as resolved
        waiter_request.status = "resolved"
        waiter_request.resolved_at = datetime.utcnow()
        waiter_request.resolved_by = "admin"  # Could be enhanced to track specific admin user
        
        db.commit()
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error resolving waiter request {request_id}: {e}")
        db.rollback()
        return False, "internal_error"


async def handle_dashboard_action(websocket: WebSocket, action: DashboardAction, restaurant_slug: str):
    """Handle dashboard action and broadcast updates"""
    try:
        with SessionLocal() as db:
            restaurant = get_restaurant_by_slug(db, restaurant_slug)
            
            success = False
            updated_tables = []
            error_code = None
            
            # Dispatch action to appropriate service
            if action.action == "close_table":
                if not action.table_id:
                    await dashboard_manager.send_error(websocket, "missing_table_id", "Table ID required")
                    return
                
                success, table_info, error_code = await close_table_service(db, restaurant, action.table_id)
                if success:
                    updated_tables = [table_info]
            
            elif action.action == "disable_table":
                if not action.table_id:
                    await dashboard_manager.send_error(websocket, "missing_table_id", "Table ID required")
                    return
                
                success, table_info, error_code = await disable_table_service(db, restaurant, action.table_id)
                if success:
                    updated_tables = [table_info]
            
            elif action.action == "enable_table":
                if not action.table_id:
                    await dashboard_manager.send_error(websocket, "missing_table_id", "Table ID required")
                    return
                
                success, table_info, error_code = await enable_table_service(db, restaurant, action.table_id)
                if success:
                    updated_tables = [table_info]
            
            elif action.action == "restore_table":
                if not action.table_id:
                    await dashboard_manager.send_error(websocket, "missing_table_id", "Table ID required")
                    return
                
                success, table_info, error_code = await restore_table_service(db, restaurant, action.table_id)
                if success:
                    updated_tables = [table_info]
            
            elif action.action == "move_table":
                if not action.from_table_id or not action.to_table_id:
                    await dashboard_manager.send_error(websocket, "missing_table_ids", "Both from_table_id and to_table_id required")
                    return
                
                success, tables_list, error_code = await move_table_service(db, restaurant, action.from_table_id, action.to_table_id)
                if success:
                    updated_tables = tables_list
            
            elif action.action == "resolve_waiter_request":
                if not action.request_id:
                    await dashboard_manager.send_error(websocket, "missing_request_id", "Request ID required")
                    return
                
                success, error_code = await resolve_waiter_request_service(db, restaurant, action.request_id)
                if success:
                    # Broadcast resolution to all admin dashboards for this restaurant
                    resolution_message = {
                        "type": "waiter_request_resolved",
                        "request_id": action.request_id
                    }
                    await dashboard_manager.broadcast_to_session(restaurant_slug, resolution_message)
                    logger.info(f"Successfully resolved waiter request {action.request_id} for restaurant {restaurant_slug}")
                    return  # No table updates needed, just broadcast
            
            elif action.action == "acknowledge_order":
                if not action.order_id:
                    await dashboard_manager.send_error(websocket, "missing_order_id", "Order ID required")
                    return
                
                # Just broadcast acknowledgment - no database persistence needed
                acknowledgment_message = {
                    "type": "order_acknowledged",
                    "order_id": action.order_id
                }
                await dashboard_manager.broadcast_to_session(restaurant_slug, acknowledgment_message)
                logger.info(f"Successfully acknowledged order {action.order_id} for restaurant {restaurant_slug}")
                return  # No table updates needed, just broadcast
            
            elif action.action == "approve_order":
                if not action.order_id:
                    await dashboard_manager.send_error(websocket, "missing_order_id", "Order ID required")
                    return
                
                success, error_code = await approve_order_service(db, restaurant, action.order_id)
                if success:
                    logger.info(f"Successfully approved order {action.order_id} for restaurant {restaurant_slug}")
                    return  # No table updates needed, just broadcast
                else:
                    await dashboard_manager.send_error(websocket, error_code or "approve_failed", f"Failed to approve order {action.order_id}")
                    return
            
            elif action.action == "reject_order":
                if not action.order_id:
                    await dashboard_manager.send_error(websocket, "missing_order_id", "Order ID required")
                    return
                
                success, error_code = await reject_order_service(db, restaurant, action.order_id)
                if success:
                    logger.info(f"Successfully rejected order {action.order_id} for restaurant {restaurant_slug}")
                    return  # No table updates needed, just broadcast
                else:
                    await dashboard_manager.send_error(websocket, error_code or "reject_failed", f"Failed to reject order {action.order_id}")
                    return
            
            elif action.action == "edit_order":
                if not action.order_id:
                    await dashboard_manager.send_error(websocket, "missing_order_id", "Order ID required")
                    return
                
                if not action.updated_order:
                    await dashboard_manager.send_error(websocket, "missing_updated_order", "Updated order data required")
                    return
                
                success, error_code = await edit_order_service(db, restaurant, action.order_id, action.updated_order)
                if success:
                    logger.info(f"Successfully edited and approved order {action.order_id} for restaurant {restaurant_slug}")
                    return  # No table updates needed, just broadcast
                else:
                    await dashboard_manager.send_error(websocket, error_code or "edit_failed", f"Failed to edit order {action.order_id}")
                    return
            
            elif action.action == "retry_pos":
                if not action.order_id:
                    await dashboard_manager.send_error(websocket, "missing_order_id", "Order ID required")
                    return
                
                success, error_code = await retry_pos_service(db, restaurant, action.order_id)
                if success:
                    logger.info(f"Successfully retried POS for order {action.order_id} for restaurant {restaurant_slug}")
                    return  # No table updates needed, just broadcast
                else:
                    await dashboard_manager.send_error(websocket, error_code or "retry_failed", f"Failed to retry POS for order {action.order_id}")
                    return
            
            else:
                await dashboard_manager.send_error(websocket, "unknown_action", f"Unknown action: {action.action}")
                return
            
            # Handle result
            if success:
                # Broadcast table updates to all connected dashboards for this restaurant
                if updated_tables:
                    for table_info in updated_tables:
                        update_message = {
                            "type": "table_update",
                            "table": table_info.to_dict()
                        }
                        await dashboard_manager.broadcast_to_session(restaurant_slug, update_message)
                
                logger.info(f"Successfully executed {action.action} for restaurant {restaurant_slug}")
            else:
                # Send error to requesting client
                await dashboard_manager.send_error(websocket, error_code or "action_failed", f"Failed to {action.action}")
    
    except Exception as e:
        logger.error(f"Error handling dashboard action {action.action}: {e}")
        await dashboard_manager.send_error(websocket, "action_error", f"Error executing {action.action}")


# decode_admin_jwt_token is now imported from auth_utils 


async def approve_order_service(db, restaurant, order_id: str):
    """
    Approve an order - send to POS and notify customers
    
    Returns:
        tuple: (success: bool, error_code: str)
    """
    try:
        # Find the order
        order = db.query(Order).join(
            Session, Order.session_id == Session.id
        ).filter(
            Order.public_id == order_id,
            Session.restaurant_id == restaurant.id,
            Order.status == "placed"
        ).first()
        
        if not order:
            return False, "order_not_found"
        
        # Get order details for notifications
        session = db.query(Session).filter(Session.id == order.session_id).first()
        member = db.query(Member).filter(Member.id == order.initiated_by_member_id).first()
        
        # Process order with POS integration
        from urls.session_ws import process_order_with_pos
        success, pos_order_id, pos_response, pos_used = await process_order_with_pos(
            restaurant.id, order, session, member, db
        )
        
        if success:
            # Update order status
            order.status = "confirmed"
            order.confirmed_at = datetime.utcnow()
            order.pos_order_id = pos_order_id or order_id
            order.pos_response = [pos_response]
            
            # Mark cart items as ordered
            from models.schema import CartItem
            cart_items = db.query(CartItem).filter(CartItem.order_id == order.id).all()
            for item in cart_items:
                item.state = "ordered"
            
            db.commit()
            
            # Broadcast to customers
            from websocket.manager import connection_manager
            success_message = {
                "type": "order_confirmed",
                "order_id": order.public_id,
                "message": "Order confirmed by restaurant!",
                "order": {
                    "id": order.public_id,
                    "orderNumber": order.public_id.split("_")[1],
                    "timestamp": order.created_at.isoformat(),
                    "items": order.payload,
                    "total": order.total_amount,
                    "initiated_by": {
                        "member_pid": member.public_id,
                        "nickname": member.nickname
                    },
                    "status": order.status
                }
            }
            await connection_manager.broadcast_to_session(session.public_id, success_message)
            
            # Remove from admin dashboard
            removal_message = {
                "type": "order_removed",
                "order_id": order.public_id,
                "reason": "approved"
            }
            await dashboard_manager.broadcast_to_session(restaurant.slug, removal_message)
            
            return True, None
        else:
            # POS integration failed
            order.status = "failed"
            order.failed_at = datetime.utcnow()
            order.pos_response = pos_response
            db.commit()
            
            # Notify customers of failure
            from websocket.manager import connection_manager
            failure_message = {
                "type": "order_failed",
                "order_id": order.public_id,
                "message": "Order processing failed. Please try again.",
                "error": "POS integration failed"
            }
            await connection_manager.broadcast_to_session(session.public_id, failure_message)
            
            return False, "pos_integration_failed"
        
    except Exception as e:
        logger.error(f"Error approving order {order_id}: {e}")
        db.rollback()
        return False, "internal_error"


async def reject_order_service(db, restaurant, order_id: str):
    """
    Reject an order - cancel and notify customers
    
    Returns:
        tuple: (success: bool, error_code: str)
    """
    try:
        # Find the order
        order = db.query(Order).join(
            Session, Order.session_id == Session.id
        ).filter(
            Order.public_id == order_id,
            Session.restaurant_id == restaurant.id,
            Order.status == "placed"
        ).first()
        
        if not order:
            return False, "order_not_found"
        
        # Get order details for notifications
        session = db.query(Session).filter(Session.id == order.session_id).first()
        member = db.query(Member).filter(Member.id == order.initiated_by_member_id).first()
        
        # Update order status
        order.status = "cancelled"
        order.failed_at = datetime.utcnow()
        
        # Unlock cart items - revert to pending state
        from models.schema import CartItem
        cart_items = db.query(CartItem).filter(CartItem.order_id == order.id).all()
        for item in cart_items:
            item.state = "pending"
            item.order_id = None
        
        db.commit()
        
        # Broadcast to customers
        from websocket.manager import connection_manager
        cancellation_message = {
            "type": "order_cancelled",
            "order_id": order.public_id,
            "message": "Order has been cancelled by the restaurant",
            "reason": "Restaurant rejected the order. Contact staff for help."
        }
        await connection_manager.broadcast_to_session(session.public_id, cancellation_message)
        
        # Remove from admin dashboard
        removal_message = {
            "type": "order_removed",
            "order_id": order.public_id,
            "reason": "rejected"
        }
        await dashboard_manager.broadcast_to_session(restaurant.slug, removal_message)
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error rejecting order {order_id}: {e}")
        db.rollback()
        return False, "internal_error"


async def edit_order_service(db, restaurant, order_id: str, updated_order: dict):
    """
    Edit an order completely - handle item deletions, quantity changes, and new items
    
    Returns:
        tuple: (success: bool, error_code: str)
    """
    try:
        # Find the order
        order = db.query(Order).join(
            Session, Order.session_id == Session.id
        ).filter(
            Order.public_id == order_id,
            Session.restaurant_id == restaurant.id,
            Order.status == "placed"
        ).first()
        
        if not order:
            return False, "order_not_found"
        
        # Get order details for notifications
        session = db.query(Session).filter(Session.id == order.session_id).first()
        member = db.query(Member).filter(Member.id == order.initiated_by_member_id).first()
        
        # Validate and process the updated order items
        new_items = updated_order.get("items", [])
        if not new_items:
            return False, "no_items_in_order"
        
        # Create change summary for logging
        original_items_count = len(order.payload)
        new_items_count = len(new_items)
        
        # Update order payload with admin changes
        order.payload = new_items
        order.total_amount = updated_order.get("total", 0)
        order.cart_hash = f"hash_{len(order.payload)}_{order.total_amount}_{datetime.utcnow().timestamp()}"
        
        # Add edit tracking to POS response field (as a simple way to store edit history)
        edit_record = {
            "edited_by": "AdminStaff",
            "edited_at": datetime.utcnow().isoformat(),
            "changes": {
                "original_items_count": original_items_count,
                "new_items_count": new_items_count,
                "original_total": order.total_amount,
                "new_total": updated_order.get("total", 0)
            }
        }
        
        # Store edit history in pos_response field if it exists
        if order.pos_response:
            if isinstance(order.pos_response, list):
                order.pos_response.append({"edit_history": edit_record})
            else:
                order.pos_response = [order.pos_response, {"edit_history": edit_record}]
        else:
            order.pos_response = [{"edit_history": edit_record}]
        
        # Process order with POS integration
        from urls.session_ws import process_order_with_pos
        success, pos_order_id, pos_response, pos_used = await process_order_with_pos(
            restaurant.id, order, session, member, db
        )
        
        if success:
            # Update order status
            order.status = "confirmed"
            order.confirmed_at = datetime.utcnow()
            order.pos_order_id = pos_order_id or order_id
            order.pos_response = [pos_response]
            
            # Update related cart items
            from models.schema import CartItem
            cart_items = db.query(CartItem).filter(CartItem.order_id == order.id).all()
            
            # Mark existing cart items as ordered
            for item in cart_items:
                item.state = "ordered"
            
            # Note: For comprehensive cart item management, we would need to:
            # 1. Remove cart items that were deleted from the order
            # 2. Update quantities for modified items
            # 3. Create new cart items for newly added items
            # This is complex as cart items have their own structure and relationships
            
            db.commit()
            
            # Create detailed change summary for customer notification
            changes_summary = f"Order modified by restaurant staff - {new_items_count} items (was {original_items_count})"
            
            # Broadcast updated order to customers
            from websocket.manager import connection_manager
            update_message = {
                "type": "order_updated",
                "order_id": order.public_id,
                "message": "Restaurant has updated your order",
                "updated_order": {
                    "id": order.public_id,
                    "orderNumber": order.public_id.split("_")[1],
                    "timestamp": order.created_at.isoformat(),
                    "items": order.payload,
                    "total": order.total_amount,
                    "initiated_by": {
                        "member_pid": member.public_id,
                        "nickname": member.nickname
                    },
                    "status": order.status,
                    "edited_by": "AdminStaff",
                    "edited_at": datetime.utcnow().isoformat()
                },
                "changes_summary": changes_summary
            }
            await connection_manager.broadcast_to_session(session.public_id, update_message)
            
            # Remove from admin dashboard
            removal_message = {
                "type": "order_removed",
                "order_id": order.public_id,
                "reason": "edited_and_approved"
            }
            await dashboard_manager.broadcast_to_session(restaurant.slug, removal_message)
            
            logger.info(f"Order {order_id} successfully edited and approved by AdminStaff - {changes_summary}")
            return True, None
            
        else:
            # POS integration failed
            order.status = "failed"
            order.failed_at = datetime.utcnow()
            order.pos_response = pos_response
            db.commit()
            
            # Notify customers of failure
            from websocket.manager import connection_manager
            failure_message = {
                "type": "order_failed",
                "order_id": order.public_id,
                "message": "Order processing failed after editing. Please try again.",
                "error": "POS integration failed"
            }
            await connection_manager.broadcast_to_session(session.public_id, failure_message)
            
            return False, "pos_integration_failed"
        
    except Exception as e:
        logger.error(f"Error editing order {order_id}: {e}")
        db.rollback()
        return False, "internal_error"


async def retry_pos_service(db, restaurant, order_id: str):
    """
    Retry POS integration for a failed order
    
    Returns:
        tuple: (success: bool, error_code: str)
    """
    try:
        # Find the order
        order = db.query(Order).join(
            Session, Order.session_id == Session.id
        ).filter(
            Order.public_id == order_id,
            Session.restaurant_id == restaurant.id,
            Order.status == "failed"
        ).first()
        
        if not order:
            return False, "order_not_found"
        
        # Get order details for notifications
        session = db.query(Session).filter(Session.id == order.session_id).first()
        member = db.query(Member).filter(Member.id == order.initiated_by_member_id).first()
        
        # Retry POS integration
        from urls.session_ws import process_order_with_pos
        success, pos_order_id, pos_response, pos_used = await process_order_with_pos(
            restaurant.id, order, session, member, db
        )
        
        if success:
            # Update order status
            order.status = "confirmed"
            order.confirmed_at = datetime.utcnow()
            order.pos_order_id = pos_order_id or order_id
            order.pos_response = [pos_response]
            
            # Mark cart items as ordered
            from models.schema import CartItem
            cart_items = db.query(CartItem).filter(CartItem.order_id == order.id).all()
            for item in cart_items:
                item.state = "ordered"
            
            db.commit()
            
            # Broadcast to customers
            from websocket.manager import connection_manager
            success_message = {
                "type": "order_confirmed",
                "order_id": order.public_id.split("_")[1],
                "message": "Order confirmed by restaurant!",
                "order": {
                    "id": order.public_id.split("_")[1],
                    "orderNumber": order.public_id.split("_")[1],
                    "timestamp": order.created_at.isoformat(),
                    "items": order.payload,
                    "total": order.total_amount,
                    "initiated_by": {
                        "member_pid": member.public_id,
                        "nickname": member.nickname
                    },
                    "status": order.status
                }
            }
            await connection_manager.broadcast_to_session(session.public_id, success_message)
            
            # Notify admin dashboard of success
            retry_success_message = {
                "type": "pos_retry_success",
                "order_id": order.public_id
            }
            await dashboard_manager.broadcast_to_session(restaurant.slug, retry_success_message)
            
            return True, None
        else:
            # POS integration still failed
            order.pos_response = pos_response
            db.commit()
            
            # Notify admin dashboard of continued failure
            retry_failure_message = {
                "type": "pos_retry_failed",
                "order_id": order.public_id,
                "error": str(pos_response)
            }
            await dashboard_manager.broadcast_to_session(restaurant.slug, retry_failure_message)
            
            return False, "pos_integration_failed"
        
    except Exception as e:
        logger.error(f"Error retrying POS for order {order_id}: {e}")
        db.rollback()
        return False, "internal_error"