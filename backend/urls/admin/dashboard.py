from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, Query, Header
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.schema import SessionLocal, Restaurant, Table, Session as TableSession, Member, CartItem, MenuItem, Order, WaiterRequest
from .auth_utils import auth, get_restaurant_api_keys, validate_api_key, create_admin_jwt_token, decode_admin_jwt_token
from config import FRONTEND_URL, DEBUG_MODE

import os

# Setup templates
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=templates_dir)

router = APIRouter()


# Response models
class SessionInfo(BaseModel):
    id: int
    last_active: str


class TableInfo(BaseModel):
    id: int
    number: int
    status: str
    session: Optional[SessionInfo] = None


class MoveTableRequest(BaseModel):
    target: int


class StandardResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    code: Optional[str] = None
    detail: Optional[str] = None


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_restaurant_by_slug(db: Session, slug: str) -> Restaurant:
    """Get restaurant by slug or raise 404"""
    restaurant = db.query(Restaurant).filter(Restaurant.slug == slug).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )
    return restaurant


def idle_time(timestamp):
    """Calculate idle time in minutes"""
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    diff = (datetime.utcnow() - timestamp).total_seconds()
    minutes = int(diff // 60)
    if minutes < 60:
        return f"{minutes} min"
    else:
        hours = minutes // 60
        remaining_mins = minutes % 60
        return f"{hours}h {remaining_mins}m"


# Add template filter
templates.env.filters['idle'] = idle_time


# Web interface endpoints
@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    """Serve login page"""
    return templates.TemplateResponse("admin/login.html", {"request": request})


@router.post("/login", response_class=HTMLResponse)
def login_submit(request: Request, api_key: str = Form(...)):
    """Handle login form submission"""
    # Validate API key using shared utility
    
    restaurant_slug = validate_api_key(api_key)
    if not restaurant_slug:
        return templates.TemplateResponse(
            "admin/login.html", 
            {"request": request, "error": "Invalid API Key"}
        )
    
    # Create JWT token for dashboard access
    jwt_token = create_admin_jwt_token(restaurant_slug, hours=24)
    
    # Get restaurant info
    db = SessionLocal()
    try:
        restaurant = get_restaurant_by_slug(db, restaurant_slug)
        return templates.TemplateResponse(
            "admin/dashboard.html", 
            {
                "request": request, 
                "restaurant_name": restaurant.name,
                "api_key": jwt_token  # Pass JWT token instead of raw API key
            }
        )
    finally:
        db.close()


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request, auth_data: dict = Depends(auth)):
    """Serve dashboard page (for direct access with Bearer token)"""
    restaurant_slug = auth_data["restaurant_slug"]
    
    db = SessionLocal()
    try:
        restaurant = get_restaurant_by_slug(db, restaurant_slug)
        return templates.TemplateResponse(
            "admin/dashboard.html", 
            {
                "request": request, 
                "restaurant_name": restaurant.name,
                "api_key": None  # Not available in this flow
            }
        )
    finally:
        db.close()


@router.get("/tables", response_class=HTMLResponse)
def get_tables_html(request: Request, auth_data: dict = Depends(auth)):
    """Return HTML grid partial for HTMX updates"""
    restaurant_slug = auth_data["restaurant_slug"]
    
    db = SessionLocal()
    try:
        restaurant = get_restaurant_by_slug(db, restaurant_slug)
        
        # Get all tables with their active sessions
        tables = db.query(Table).filter(Table.restaurant_id == restaurant.id).all()
        
        tables_data = []
        for table in tables:
            # Find active session for this table
            active_session = db.query(TableSession).filter(
                TableSession.table_id == table.id,
                TableSession.state == "active"
            ).first()
            
            table_info = {
                "id": table.id,
                "number": table.number,
                "status": table.status,
                "session": None
            }
            
            if active_session:
                table_info["session"] = {
                    "id": active_session.id,
                    "last_active": active_session.last_activity_at
                }
            
            tables_data.append(table_info)
        
        return templates.TemplateResponse(
            "admin/partials/grid.html", 
            {"request": request, "tables": tables_data}
        )
    finally:
        db.close()


# Error code to toast message mapping
ERROR_MESSAGES = {
    "table_occupied": "Table already has diners.",
    "target_unavailable": "Target table is not free.",
    "same_table": "Choose a different table.",
    "no_active_session": "No open session to close.",
    "already_disabled": "Table already disabled.",
    "not_disabled": "Table not disabled.",
    "no_session_to_move": "Nothing to move."
}


def toast_response(success: bool, message: str, code=None):
    """Generate toast response for HTMX"""
    if success:
        return f'<div class="toast-success">{message}</div>'
    else:
        error_msg = ERROR_MESSAGES.get(code, message)
        return f'<div class="toast-error">{error_msg}</div>'


@router.get("/api/tables", response_model=List[TableInfo])
def get_tables_api(
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Return live grid snapshot of all tables for the restaurant (JSON API)."""
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get all tables with their active sessions
    tables = db.query(Table).filter(Table.restaurant_id == restaurant.id).all()
    
    result = []
    for table in tables:
        # Find active session for this table
        active_session = db.query(TableSession).filter(
            TableSession.table_id == table.id,
            TableSession.state == "active"
        ).first()
        
        session_info = None
        if active_session:
            session_info = SessionInfo(
                id=active_session.id,
                last_active=active_session.last_activity_at.isoformat() + "Z"
            )
        
        table_info = TableInfo(
            id=table.id,
            number=table.number,
            status=table.status,
            session=session_info
        )
        result.append(table_info)
    
    return result


@router.post("/table/{table_id}/close", deprecated=True)
def close_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Close active session and mark table dirty.
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'close_table' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return HTMLResponse(
            toast_response(False, "Table not found"),
            status_code=404
        )
    
    # Find active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if not active_session:
        return HTMLResponse(
            toast_response(False, "No active session", "no_active_session")
        )
    
    # Close session and mark table dirty
    active_session.state = "closed"
    table.status = "dirty"
    
    db.commit()
    
    return HTMLResponse(
        toast_response(True, f"Table {table.number} closed successfully")
    )


@router.post("/table/{table_id}/disable", deprecated=True)
def disable_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Disable table (only when free).
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'disable_table' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return HTMLResponse(
            toast_response(False, "Table not found"),
            status_code=404
        )
    
    if table.status == "disabled":
        return HTMLResponse(
            toast_response(False, "Table already disabled", "already_disabled")
        )
    
    # Check for active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        return HTMLResponse(
            toast_response(False, "Table occupied", "table_occupied")
        )
    
    # Disable table
    table.status = "disabled"
    db.commit()
    
    return HTMLResponse(
        toast_response(True, f"Table {table.number} disabled")
    )


@router.post("/table/{table_id}/enable", deprecated=True)
def enable_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Re-open a disabled table or clean a dirty table.
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'enable_table' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return HTMLResponse(
            toast_response(False, "Table not found"),
            status_code=404
        )
    
    if table.status not in ["disabled", "dirty"]:
        return HTMLResponse(
            toast_response(False, "Table is already open", "not_disabled")
        )
    
    # Check for active session (shouldn't happen but validate)
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        return HTMLResponse(
            toast_response(False, "Table occupied", "table_occupied")
        )
    
    # Enable table or clean dirty table
    previous_status = table.status
    table.status = "open"
    db.commit()
    
    if previous_status == "dirty":
        message = f"Table {table.number} cleaned and ready"
    else:
        message = f"Table {table.number} enabled"
    
    return HTMLResponse(
        toast_response(True, message)
    )


@router.post("/table/{table_id}/restore", response_model=StandardResponse, deprecated=True)
def restore_table(
    table_id: int,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Reopen the most recent closed/expired session.
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'restore_table' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )
    
    # Check for existing active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Table occupied"
        )
    
    # Find most recent closed/expired session
    last_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state.in_(["closed", "expired"])
    ).order_by(desc(TableSession.last_activity_at)).first()
    
    if not last_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No session to restore"
        )
    
    # Restore session
    last_session.state = "active"
    last_session.last_activity_at = datetime.utcnow()
    
    db.commit()
    
    return StandardResponse(success=True, data={"session_id": last_session.id})


@router.post("/api/token", response_model=StandardResponse)
def create_dashboard_token(auth_data: dict = Depends(auth)):
    """Create a temporary JWT token for WebSocket dashboard access"""
    restaurant_slug = auth_data["restaurant_slug"]
    
    # Create a short-lived token for WebSocket access (2 hours)
    jwt_token = create_admin_jwt_token(restaurant_slug, hours=2)
    
    return StandardResponse(
        success=True,
        data={
            "token": jwt_token,
            "expires_in": 7200  # 2 hours in seconds
        }
    )


@router.post("/table/{table_id}/move", deprecated=True)
def move_table(
    table_id: int,
    request: Request,
    target: int = Form(...),
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Move current party to another empty table.
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'move_table' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    target_table_id = target
    
    if table_id == target_table_id:
        return HTMLResponse(
            toast_response(False, "Cannot move to same table", "same_table")
        )
    
    # Get source table
    source_table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not source_table:
        return HTMLResponse(
            toast_response(False, "Source table not found"),
            status_code=404
        )
    
    # Get target table
    target_table = db.query(Table).filter(
        Table.id == target_table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not target_table:
        return HTMLResponse(
            toast_response(False, "Target table not found"),
            status_code=404
        )
    
    # Check target table availability
    if target_table.status != "open":
        return HTMLResponse(
            toast_response(False, "Target table unavailable", "target_unavailable")
        )
    
    # Check for active session on target table
    target_active_session = db.query(TableSession).filter(
        TableSession.table_id == target_table_id,
        TableSession.state == "active"
    ).first()
    
    if target_active_session:
        return HTMLResponse(
            toast_response(False, "Target table unavailable", "target_unavailable")
        )
    
    # Check for active session on source table
    source_active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if not source_active_session:
        return HTMLResponse(
            toast_response(False, "No session to move", "no_session_to_move")
        )
    
    # Move the session
    source_active_session.table_id = target_table_id
    source_active_session.last_activity_at = datetime.utcnow()
    
    db.commit()
    
    return HTMLResponse(
        toast_response(True, f"Party moved from table {source_table.number} to table {target_table.number}")
    )


@router.get("/api/session/{table_id}")
async def get_session_details(
    table_id: int,
    authorization: str = Header(None)
):
    """
    Get session details for a specific table (admin only)
    Returns session info similar to cart_snapshot structure
    """
    try:
        # Extract token from Authorization header
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail={"success": False, "code": "missing_auth", "detail": "Authorization header required"}
            )
        
        # Handle both Bearer token format and raw token
        token = authorization
        if authorization.startswith("Bearer "):
            token = authorization.split()[1]
        
        # Try to decode as JWT token first, fallback to raw API key
        restaurant_slug = None
        
        # First try JWT token
        jwt_data = decode_admin_jwt_token(token)
        if jwt_data:
            restaurant_slug = jwt_data["restaurant_slug"]
        else:
            # Fallback to raw API key validation
            restaurant_slug = validate_api_key(token)
        
        if not restaurant_slug:
            raise HTTPException(
                status_code=403,
                detail={"success": False, "code": "invalid_auth", "detail": "Invalid API key or token"}
            )
        
        with SessionLocal() as db:
            # Get restaurant
            restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # Get table
            table = db.query(Table).filter(
                Table.id == table_id,
                Table.restaurant_id == restaurant.id
            ).first()
            if not table:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "table_not_found", "detail": "Table not found"}
                )
            
            # Get active session for this table
            session = db.query(TableSession).filter(
                TableSession.table_id == table.id,
                TableSession.state == 'active'
            ).first()
            
            if not session:
                return {
                    "success": True,
                    "table_number": table.number,
                    "table_status": table.status,
                    "session": None,
                    "members": [],
                    "cart_items": [],
                    "orders": []
                }
            
            # Get all members in this session
            members = db.query(Member).filter(Member.session_id == session.id).all()
            member_infos = [
                {
                    "member_pid": m.public_id,
                    "nickname": m.nickname,
                    "is_host": m.is_host,
                    "active": m.active,
                    "device_id": m.device_id
                }
                for m in members
            ]
            
            # Get all pending cart items with detailed customization info
            from sqlalchemy.orm import joinedload
            from models.schema import ItemVariation, CartItemAddon
            
            cart_items = db.query(CartItem).options(
                joinedload(CartItem.menu_item),
                joinedload(CartItem.selected_item_variation).joinedload(ItemVariation.variation),
                joinedload(CartItem.selected_addons).joinedload(CartItemAddon.addon_item),
                joinedload(CartItem.member)
            ).filter(
                CartItem.session_id == session.id,
                CartItem.state == 'pending'
            ).all()
            
            cart_item_infos = []
            for cart_item in cart_items:
                # Calculate final price with variations and addons
                final_price = cart_item.menu_item.price
                
                # Add variation details
                selected_variation = None
                if cart_item.selected_item_variation:
                    final_price = cart_item.selected_item_variation.price  # Use absolute price
                    selected_variation = {
                        "variation_name": cart_item.selected_item_variation.variation.name,
                        "group_name": cart_item.selected_item_variation.variation.group_name,
                        "price": cart_item.selected_item_variation.price
                    }
                
                # Add addon details
                selected_addons = []
                for cart_addon in cart_item.selected_addons:
                    addon_total = cart_addon.addon_item.price * cart_addon.quantity
                    final_price += addon_total
                    
                    selected_addons.append({
                        "name": cart_addon.addon_item.name,
                        "addon_group_name": cart_addon.addon_item.addon_group.name,
                        "quantity": cart_addon.quantity,
                        "price": cart_addon.addon_item.price,
                        "total_price": addon_total,
                        "tags": cart_addon.addon_item.tags or []
                    })
                
                cart_item_infos.append({
                    "public_id": cart_item.public_id,
                    "member_pid": cart_item.member.public_id,
                    "menu_item_name": cart_item.menu_item.name,
                    "base_price": cart_item.menu_item.price,
                    "final_price": final_price,
                    "qty": cart_item.qty,
                    "note": cart_item.note or "",
                    "version": cart_item.version,
                    "image_url": f"image_data/{restaurant.slug}/{cart_item.menu_item.image_path}" if cart_item.menu_item.image_path else None,
                    "veg_flag": cart_item.menu_item.veg_flag,
                    "selected_variation": selected_variation,
                    "selected_addons": selected_addons
                })
            
            # Get orders for this session with enhanced item details
            orders = db.query(Order).filter(Order.session_id == session.id).all()
            order_infos = []
            for order in orders:
                # Enhance order items with detailed customization info 
                enhanced_items = []
                for item in order.payload or []:
                    enhanced_items.append({
                        "name": item.get("name", ""),
                        "qty": item.get("qty", 1),
                        "unit_price": item.get("unit_price", 0),
                        "final_price": item.get("final_price", 0),
                        "total": item.get("total", 0),
                        "note": item.get("note", ""),
                        "selected_variation": item.get("selected_variation"),
                        "selected_addons": item.get("selected_addons", [])
                    })
                
                order_infos.append({
                    "order_id": order.public_id,
                    "total_amount": order.total_amount,
                    "status": order.status,
                    "created_at": order.created_at.isoformat() if order.created_at else None,
                    "confirmed_at": order.confirmed_at.isoformat() if hasattr(order, 'confirmed_at') and order.confirmed_at else None,
                    "items": enhanced_items
                })
            
            # Calculate totals
            cart_total = sum(item["final_price"] * item["qty"] for item in cart_item_infos)
            orders_total = sum(order["total_amount"] for order in order_infos)
            
            return {
                "success": True,
                "table_number": table.number,
                "table_status": table.status,
                "session": {
                    "session_pid": session.public_id,
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "last_activity_at": session.last_activity_at.isoformat() if session.last_activity_at else None,
                    "state": session.state,
                    "pass_validated": session.pass_validated if hasattr(session, 'pass_validated') else True
                },
                "members": member_infos,
                "cart_items": cart_item_infos,
                "orders": order_infos,
                "totals": {
                    "cart_total": cart_total,
                    "orders_total": orders_total,
                    "grand_total": cart_total + orders_total
                },
                "member_count": len(member_infos),
                "active_member_count": len([m for m in member_infos if m["active"]])
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting session details: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )


@router.get("/api/waiter_requests", response_model=List[dict], deprecated=True)
def get_waiter_requests_for_restaurant(
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Get all pending waiter requests for the restaurant
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard which sends 'pending_waiter_requests' message on connect.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Get all pending waiter requests for this restaurant
    requests = db.query(WaiterRequest, Table, Member).join(
        Table, WaiterRequest.table_id == Table.id
    ).join(
        Member, WaiterRequest.member_id == Member.id
    ).filter(
        Table.restaurant_id == restaurant.id,
        WaiterRequest.status == "pending"
    ).order_by(WaiterRequest.created_at.desc()).all()
    
    result = []
    for waiter_request, table, member in requests:
        result.append({
            "id": waiter_request.public_id,
            "table_id": table.id,
            "table_number": table.number,
            "request_type": waiter_request.request_type,
            "message": waiter_request.message,
            "member_name": member.nickname,
            "created_at": waiter_request.created_at.isoformat(),
            "time_ago": idle_time(waiter_request.created_at.isoformat() + "Z")
        })
    
    return result


@router.post("/api/waiter_request/{request_id}/resolve", response_model=StandardResponse, deprecated=True)
def resolve_waiter_request(
    request_id: str,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Mark a waiter request as resolved
    
    DEPRECATED: Use WebSocket endpoint /admin/ws/dashboard with action 'resolve_waiter_request' instead.
    """
    restaurant_slug = auth_data["restaurant_slug"]
    restaurant = get_restaurant_by_slug(db, restaurant_slug)
    
    # Find the waiter request
    waiter_request = db.query(WaiterRequest).join(
        Table, WaiterRequest.table_id == Table.id
    ).filter(
        WaiterRequest.public_id == request_id,
        Table.restaurant_id == restaurant.id,
        WaiterRequest.status == "pending"
    ).first()
    
    if not waiter_request:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "code": "request_not_found", "detail": "Waiter request not found or already resolved"}
        )
    
    # Mark as resolved
    waiter_request.status = "resolved"
    waiter_request.resolved_at = datetime.utcnow()
    waiter_request.resolved_by = "admin"  # Could be enhanced to track specific admin user
    
    db.commit()
    
    # Broadcast removal to all admin dashboards for this restaurant
    try:
        from .dashboard_ws import dashboard_manager
        
        notification_message = {
            "type": "waiter_request_resolved",
            "request_id": request_id
        }
        
        # Use asyncio to call the async function
        import asyncio
        asyncio.create_task(dashboard_manager.broadcast_to_session(restaurant_slug, notification_message))
        
    except Exception as e:
        # Log error but don't fail the request
        print(f"Failed to broadcast waiter request resolution: {e}")
    
    return StandardResponse(
        success=True,
        data={"message": "Waiter request resolved successfully"}
    )


# ------------------------------------------------------------------------------------
# QR Code URL generator endpoint
# ------------------------------------------------------------------------------------

# This endpoint returns a QR code URL for a specific table. The URL format is:
# FRONTEND_URL + "/" + "t=<public_id>&token=<qr_token>"

@router.get("/api/table/{table_id}/qr")
async def get_table_qr(
    table_id: int,
    authorization: str = Header(None)
):
    """Return a QR-ready URL for the given table (admin only)."""

    # --------------------------------------
    # Auth – same logic as get_session_details
    # --------------------------------------
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "code": "missing_auth", "detail": "Authorization header required"}
        )

    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization.split()[1]

    restaurant_slug: Optional[str] = None

    jwt_data = decode_admin_jwt_token(token)
    if jwt_data:
        restaurant_slug = jwt_data["restaurant_slug"]
    else:
        restaurant_slug = validate_api_key(token)

    if not restaurant_slug:
        raise HTTPException(
            status_code=403,
            detail={"success": False, "code": "invalid_auth", "detail": "Invalid API key or token"}
        )

    with SessionLocal() as db:
        restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
        if not restaurant:
            raise HTTPException(
                status_code=404,
                detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
            )

        table = db.query(Table).filter(
            Table.id == table_id,
            Table.restaurant_id == restaurant.id
        ).first()

        if not table:
            raise HTTPException(
                status_code=404,
                detail={"success": False, "code": "table_not_found", "detail": "Table not found"}
            )

        url = FRONTEND_URL if DEBUG_MODE else f"https://{restaurant.slug}.aglioapp.com"

        qr_url = f"{url}/?t={table.public_id}&token={table.qr_token}"

        return {
            "success": True,
            "table_number": table.number,
            "url": qr_url
        } 