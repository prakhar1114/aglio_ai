import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.schema import SessionLocal, WaiterRequest, Session as TableSession, Table, Restaurant, Member
from utils.jwt_utils import decode_ws_token


router = APIRouter()


class WaiterRequestCreate(BaseModel):
    request_type: str  # 'call_waiter' or 'ask_for_bill'


class WaiterRequestResponse(BaseModel):
    success: bool
    request_id: str
    message: str


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_member(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Get current member from WebSocket token"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"success": False, "code": "missing_auth", "detail": "Authorization header required"}
        )
    
    # Handle both Bearer token format and raw token
    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization.split()[1]
    
    # Decode WebSocket token
    try:
        payload = decode_ws_token(token)
        member_pid = payload.get("sub")
        session_pid = payload.get("sid")
        device_id = payload.get("dev")
        
        if not all([member_pid, session_pid, device_id]):
            raise HTTPException(
                status_code=403,
                detail={"success": False, "code": "invalid_token", "detail": "Invalid token payload"}
            )
        
        # Get member and session from database
        member = db.query(Member).filter(Member.public_id == member_pid).first()
        if not member:
            raise HTTPException(
                status_code=404,
                detail={"success": False, "code": "member_not_found", "detail": "Member not found"}
            )
        
        session = db.query(TableSession).filter(
            TableSession.public_id == session_pid,
            TableSession.state == "active"
        ).first()
        if not session:
            raise HTTPException(
                status_code=410,
                detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
            )
        
        # Verify member belongs to session
        if member.session_id != session.id:
            raise HTTPException(
                status_code=403,
                detail={"success": False, "code": "invalid_session", "detail": "Member not in this session"}
            )
        
        return member, session
        
    except Exception as e:
        raise HTTPException(
            status_code=403,
            detail={"success": False, "code": "invalid_token", "detail": "Invalid or expired token"}
        )


@router.post("/waiter_request", response_model=WaiterRequestResponse)
async def create_waiter_request(
    request_data: WaiterRequestCreate,
    member_and_session: tuple = Depends(get_current_member),
    db: Session = Depends(get_db)
):
    """Create a new waiter request (call waiter or ask for bill)"""
    member, session = member_and_session
    
    # Validate request type
    if request_data.request_type not in ['call_waiter', 'ask_for_bill']:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "code": "invalid_request_type", "detail": "Request type must be 'call_waiter' or 'ask_for_bill'"}
        )
    
    # Get table and restaurant info
    table = db.query(Table).filter(Table.id == session.table_id).first()
    if not table:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "code": "table_not_found", "detail": "Table not found"}
        )
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=404,
            detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
        )
    
    # Check if there's already a pending request of the same type
    existing_request = db.query(WaiterRequest).filter(
        WaiterRequest.session_id == session.id,
        WaiterRequest.request_type == request_data.request_type,
        WaiterRequest.status == "pending"
    ).first()
    
    if existing_request:
        raise HTTPException(
            status_code=409,
            detail={
                "success": False, 
                "code": "request_already_pending", 
                "detail": f"A {request_data.request_type.replace('_', ' ')} request is already pending"
            }
        )
    
    # Create new waiter request
    request_id = f"wr_{uuid.uuid4().hex[:8]}"
    waiter_request = WaiterRequest(
        public_id=request_id,
        session_id=session.id,
        table_id=table.id,
        member_id=member.id,
        request_type=request_data.request_type,
        status="pending",
        created_at=datetime.utcnow()
    )
    
    db.add(waiter_request)
    db.commit()
    
    # Broadcast to admin dashboard
    try:
        # Dynamic import to avoid circular dependency issues
        # (dashboard_ws imports table services which might import this module)
        from urls.admin.dashboard_ws import dashboard_manager
        
        # Create notification message for admin dashboard
        notification_message = {
            "type": "waiter_request",
            "request": {
                "id": waiter_request.public_id,
                "table_id": table.id,
                "table_number": table.number,
                "request_type": request_data.request_type,
                "message": None,
                "member_name": member.nickname,
                "created_at": waiter_request.created_at.isoformat() + "Z"  # Add Z for UTC
            }
        }
        
        # Broadcast to all admin dashboard connections for this restaurant
        await dashboard_manager.broadcast_to_session(restaurant.slug, notification_message)
        
    except Exception as e:
        # Log error but don't fail the request
        print(f"Failed to broadcast waiter request to admin dashboard: {e}")
    
    # Generate response message
    if request_data.request_type == "call_waiter":
        response_message = "Your waiter has been notified and will be with you shortly."
    else:  # ask_for_bill
        response_message = "Your bill request has been sent to staff."
    
    return WaiterRequestResponse(
        success=True,
        request_id=request_id,
        message=response_message
    )


 