import json
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
from models.schema import WaiterRequest, Table, Member


router = APIRouter()


class DashboardManager(ConnectionManager):
    """Specialized connection manager for admin dashboards"""
    
    def __init__(self):
        super().__init__()
        # Override the connections dict to use restaurant_slug instead of session_pid
        # restaurant_slug -> list of WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}
        # websocket -> restaurant_slug mapping for cleanup
        self.websocket_sessions: Dict[WebSocket, str] = {}
    
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
        
        logger.info(f"Dashboard WebSocket connected for restaurant {restaurant_slug}. Total connections: {len(self.connections[restaurant_slug])}")
        return True
    
    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection
        
        Args:
            websocket: WebSocket connection to remove
        """
        restaurant_slug = self.websocket_sessions.get(websocket)
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


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time dashboard updates"""
    restaurant_slug: str = None
    
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
        
        # 6. Message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                
                # Handle ping/pong
                if data.strip() == "ping":
                    await websocket.send_text("pong")
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
            
            else:
                await dashboard_manager.send_error(websocket, "unknown_action", f"Unknown action: {action.action}")
                return
            
            # Handle result
            if success:
                # Broadcast table updates to all connected dashboards for this restaurant
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