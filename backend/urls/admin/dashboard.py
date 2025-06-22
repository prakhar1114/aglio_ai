from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.schema import SessionLocal, Restaurant, Table, Session as TableSession
from .auth_utils import auth, get_restaurant_api_keys

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
    # Validate API key
    api_keys = get_restaurant_api_keys()
    
    restaurant_slug = None
    for slug, key in api_keys.items():
        if api_key == key:
            restaurant_slug = slug
            break
    
    if not restaurant_slug:
        return templates.TemplateResponse(
            "admin/login.html", 
            {"request": request, "error": "Invalid API Key"}
        )
    
    # Get restaurant info
    db = SessionLocal()
    try:
        restaurant = get_restaurant_by_slug(db, restaurant_slug)
        return templates.TemplateResponse(
            "admin/dashboard.html", 
            {
                "request": request, 
                "restaurant_name": restaurant.name,
                "api_key": api_key
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


def toast_response(success: bool, message: str, code: str = None):
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


@router.post("/table/{table_id}/close")
def close_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Close active session and mark table dirty."""
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


@router.post("/table/{table_id}/disable")
def disable_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Disable table (only when free)."""
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


@router.post("/table/{table_id}/enable")
def enable_table(
    table_id: int,
    request: Request,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Re-open a disabled table or clean a dirty table."""
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


@router.post("/table/{table_id}/restore", response_model=StandardResponse)
def restore_table(
    table_id: int,
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Reopen the most recent closed/expired session."""
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


@router.post("/table/{table_id}/move")
def move_table(
    table_id: int,
    request: Request,
    target: int = Form(...),
    auth_data: dict = Depends(auth),
    db: Session = Depends(get_db)
):
    """Move current party to another empty table."""
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