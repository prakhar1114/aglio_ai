from fastapi import APIRouter, HTTPException, Request, Depends, Header, WebSocket, WebSocketDisconnect
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from datetime import datetime, timezone, date
import uuid
import json
import hashlib
from loguru import logger

from models.schema import SessionLocal, Restaurant, Table, Session, Member, RestaurantHours, DailyPass, CartItem, MenuItem
from models.table_session_models import (
    TableSessionRequest, TableSessionResponse, 
    TokenRefreshRequest, TokenRefreshResponse,
    MemberUpdateRequest, MemberUpdateResponse,
    ValidatePassRequest, ValidatePassResponse,
    ErrorResponse, MemberJoinEvent, MemberInfo
)
from models.cart_models import (
    CartMutateEvent, CartUpdateEvent, CartErrorEvent, CartItemResponse
)
from utils.jwt_utils import (
    encode_ws_token, decode_ws_token, is_token_near_expiry, verify_qr_token
)
from utils.nickname_generator import generate_nickname
from websocket.manager import connection_manager

# Import dashboard manager for admin notifications
from urls.admin.dashboard_ws import dashboard_manager

router = APIRouter()

def get_current_time(tz: str) -> datetime:
    """Get current time in restaurant timezone"""
    import pytz
    try:
        timezone_obj = pytz.timezone(tz)
        return datetime.now(timezone_obj)
    except:
        return datetime.now(timezone.utc)

def is_restaurant_open(restaurant: Restaurant, current_time: datetime) -> bool:
    """Check if restaurant is currently open"""
    current_day = current_time.weekday()  # 0=Monday, 6=Sunday
    # Convert to 0=Sunday, 6=Saturday to match database
    day_of_week = (current_day + 1) % 7
    
    with SessionLocal() as db:
        hours = db.query(RestaurantHours).filter(
            RestaurantHours.restaurant_id == restaurant.id,
            RestaurantHours.day == day_of_week
        ).first()
        
        if not hours:
            return False
            
        current_time_only = current_time.time()
        return hours.opens_at <= current_time_only <= hours.closes_at

@router.post("/table_session", response_model=TableSessionResponse)
async def create_table_session(
    request: Request,
    data: TableSessionRequest
):
    """
    Validate QR code and create or fetch active session for table
    """
    try:
        with SessionLocal() as db:
            # 1. Look up table and restaurant
            table = db.query(Table).filter(Table.public_id == data.table_pid).first()
            if not table:
                raise HTTPException(
                    status_code=404, 
                    detail={"success": False, "code": "table_not_found", "detail": "Table not found"}
                )
            
            restaurant = db.query(Restaurant).filter(Restaurant.id == table.restaurant_id).filter(Restaurant.slug == data.restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # 2. Verify QR token
            if not verify_qr_token(restaurant.id, table.number, data.token):
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "bad_token", "detail": "Invalid QR token"}
                )
            
            # 3. Check if restaurant is open
            current_time = get_current_time(restaurant.tz)
            if not is_restaurant_open(restaurant, current_time):
                raise HTTPException(
                    status_code=423,
                    detail={"success": False, "code": "restaurant_closed", "detail": "Restaurant is closed"}
                )
            
            # 4. Check if table is disabled
            if table.status == 'disabled':
                raise HTTPException(
                    status_code=423,
                    detail={"success": False, "code": "table_disabled", "detail": "Table is disabled"}
                )
            
            # 5. Session UPSERT - find or create active session
            session = db.query(Session).filter(
                Session.table_id == table.id,
                Session.state == 'active'
            ).first()
            
            is_new_session = False
            if not session:
                # Create new session
                is_new_session = True
                session_pid = f"s_{uuid.uuid4().hex[:6]}"
                session = Session(
                    public_id=session_pid,
                    restaurant_id=restaurant.id,
                    table_id=table.id,
                    state='active',
                    created_at=datetime.utcnow(),
                    last_activity_at=datetime.utcnow()
                )
                db.add(session)
                db.flush()  # Get the ID
            else:
                # Update existing session activity
                session.last_activity_at = datetime.utcnow()
                session_pid = session.public_id
            
            # 6. Member UPSERT - find or create member for this device
            member = db.query(Member).filter(
                Member.session_id == session.id,
                Member.device_id == data.device_id
            ).first()
            
            if not member:
                # Check if this is the first member (becomes host)
                existing_members_count = db.query(Member).filter(
                    Member.session_id == session.id
                ).count()
                
                is_host = existing_members_count == 0
                
                # Create new member
                member_pid = f"m_{uuid.uuid4().hex[:6]}"
                nickname = generate_nickname()
                
                member = Member(
                    public_id=member_pid,
                    session_id=session.id,
                    device_id=data.device_id,
                    nickname=nickname,
                    is_host=is_host,
                    active=True
                )
                db.add(member)
                db.flush()
            else:
                # Reactivate existing member
                member.active = True
                member_pid = member.public_id
                nickname = member.nickname
                is_host = member.is_host
            
            # 7. Determine session validation status
            session_validated = True
            if restaurant.require_pass:
                session_validated = session.pass_validated
            
            # 8. Generate WebSocket token
            ws_token = encode_ws_token(member.public_id, session.public_id, data.device_id)
            
            # 9. Commit all changes
            db.commit()
            
            # 10. Broadcast member_join event to existing WebSocket connections
            if session_pid in connection_manager.connections:
                member_info = MemberInfo(
                    member_pid=member.public_id,
                    nickname=member.nickname,
                    is_host=member.is_host
                )
                join_event = MemberJoinEvent(member=member_info)
                await connection_manager.broadcast_to_session(
                    session_pid, 
                    join_event.model_dump()
                )
            
            # 11. Notify admin dashboards of table update (if new session was created)
            if is_new_session:
                # Get updated table info for admin notification
                updated_table = db.query(Table).filter(Table.id == table.id).first()
                if updated_table:
                    from services.table_service import TableInfo
                    table_info = TableInfo.from_table(updated_table, db)
                    await dashboard_manager.broadcast_table_update(
                        restaurant.slug, 
                        table_info.to_dict()
                    )
            
            return TableSessionResponse(
                session_pid=session.public_id,
                member_pid=member.public_id,
                nickname=member.nickname,
                is_host=member.is_host,
                ws_token=ws_token,
                restaurant_name=restaurant.name,
                table_number=table.number,
                session_validated=session_validated
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating table session: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.post("/session/token_refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    authorization: str = Header(..., alias="Authorization")
):
    """
    Refresh WebSocket token if it's near expiry
    """
    try:
        # Extract token from Bearer header
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail={"success": False, "code": "invalid_token", "detail": "Invalid authorization header"}
            )
        
        token = authorization[7:]  # Remove "Bearer "
        
        # Decode and verify token
        payload = decode_ws_token(token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail={"success": False, "code": "invalid_token", "detail": "Invalid or expired token"}
            )
        
        # Check if token needs refresh (expires in ≤15 min)
        if not is_token_near_expiry(token, minutes=15):
            raise HTTPException(
                status_code=409,
                detail={"success": False, "code": "not_needed", "detail": "Token does not need refresh yet"}
            )
        
        # Generate new token with same payload
        new_token = encode_ws_token(
            payload["sub"],  # member_pid
            payload["sid"],  # session_pid
            payload["dev"]   # device_id
        )
        
        return TokenRefreshResponse(ws_token=new_token)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.patch("/member/{member_pid}", response_model=MemberUpdateResponse)
async def update_member_nickname(
    member_pid: str,
    data: MemberUpdateRequest,
    authorization: str = Header(..., alias="Authorization")
):
    """
    Update member nickname (member can update own nickname, host can update any)
    """
    try:
        # Extract and verify token
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail={"success": False, "code": "invalid_token", "detail": "Invalid authorization header"}
            )
        
        token = authorization[7:]
        payload = decode_ws_token(token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail={"success": False, "code": "invalid_token", "detail": "Invalid or expired token"}
            )
        
        requester_member_pid = payload["sub"]
        session_pid = payload["sid"]
        
        with SessionLocal() as db:
            # Get the session
            session = db.query(Session).filter(Session.public_id == session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            # Get the requester member
            requester = db.query(Member).filter(
                Member.public_id == requester_member_pid,
                Member.session_id == session.id
            ).first()
            
            if not requester:
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "not_authorised", "detail": "Member not found in session"}
                )
            
            # Get the target member
            target_member = db.query(Member).filter(
                Member.public_id == member_pid,
                Member.session_id == session.id
            ).first()
            
            if not target_member:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "member_not_found", "detail": "Target member not found"}
                )
            
            # Authorization check: member can update own nickname, host can update any
            if requester_member_pid != member_pid and not requester.is_host:
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "not_authorised", "detail": "Not authorized to update this member"}
                )
            
            # Update nickname
            target_member.nickname = data.nickname
            session.last_activity_at = datetime.utcnow()
            
            db.commit()
            
            # Broadcast member_join event with updated info
            member_info = MemberInfo(
                member_pid=target_member.public_id,
                nickname=target_member.nickname,
                is_host=target_member.is_host
            )
            join_event = MemberJoinEvent(member=member_info)
            await connection_manager.broadcast_to_session(
                session_pid,
                join_event.dict()
            )
            
            return MemberUpdateResponse(nickname=target_member.nickname)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member nickname: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )

@router.post("/session/validate_pass", response_model=ValidatePassResponse)
async def validate_pass(data: ValidatePassRequest):
    """
    Validate daily password and unblock cart mutations
    """
    try:
        with SessionLocal() as db:
            # Get session
            session = db.query(Session).filter(Session.public_id == data.session_pid).first()
            if not session or session.state != 'active':
                raise HTTPException(
                    status_code=410,
                    detail={"success": False, "code": "session_closed", "detail": "Session is closed"}
                )
            
            # Check if already validated
            if session.pass_validated:
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "already_validated", "detail": "Session already validated"}
                )
            
            # Get restaurant
            restaurant = db.query(Restaurant).filter(Restaurant.id == session.restaurant_id).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # Check if restaurant requires password
            if not restaurant.require_pass:
                raise HTTPException(
                    status_code=409,
                    detail={"success": False, "code": "pass_not_required", "detail": "Password not required for this restaurant"}
                )
            
            # Get today's daily pass
            today = date.today()
            daily_pass = db.query(DailyPass).filter(
                DailyPass.restaurant_id == restaurant.id,
                DailyPass.valid_date == today
            ).first()
            
            # If no daily pass exists, create one with default "coffee"
            if not daily_pass:
                word_hash = hashlib.sha256("coffee".encode()).hexdigest()
                daily_pass = DailyPass(
                    public_id=f"dp_{uuid.uuid4().hex[:6]}",
                    restaurant_id=restaurant.id,
                    word_hash=word_hash,
                    valid_date=today
                )
                db.add(daily_pass)
                db.flush()
            
            # Validate the provided word
            provided_hash = hashlib.sha256(data.word.encode()).hexdigest()
            if provided_hash != daily_pass.word_hash:
                raise HTTPException(
                    status_code=403,
                    detail={"success": False, "code": "wrong_word", "detail": "Incorrect password"}
                )
            
            # Update session as validated
            session.pass_validated = True
            session.last_activity_at = datetime.utcnow()
            
            db.commit()
            
            return ValidatePassResponse(session_validated=True)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating password: {e}")
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )
