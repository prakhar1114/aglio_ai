import jwt
import hmac
import hashlib
import pytz
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from config import JWT_SECRET

def encode_ws_token(member_pid: str, session_pid: str, device_id: str, hours: int = 3) -> str:
    """
    Create a WebSocket JWT token
    
    Args:
        member_pid: Member public ID
        session_pid: Session public ID  
        device_id: Device identifier
        hours: Token expiry in hours (default 3)
    
    Returns:
        JWT token string
    """        
    now = datetime.now(pytz.timezone("Asia/Kolkata"))
    payload = {
        "sub": member_pid,
        "sid": session_pid, 
        "dev": device_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=hours)).timestamp())
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_ws_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a WebSocket JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload dict if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        return None

def is_token_near_expiry(token: str, minutes: int = 15) -> bool:
    """
    Check if token expires within specified minutes
    
    Args:
        token: JWT token string
        minutes: Minutes threshold (default 15)
        
    Returns:
        True if token expires within threshold
    """
    payload = decode_ws_token(token)
    if not payload:
        return True
        
    exp = payload.get("exp", 0)
    now = datetime.utcnow().timestamp()
    
    return (exp - now) <= (minutes * 60)

def create_qr_token(restaurant_id: int, table_id: int) -> str:
    """
    Create HMAC token for QR code validation
    
    Args:
        restaurant_id: Restaurant ID
        table_id: Table ID
        
    Returns:
        HMAC token string
    """
    message = f"{restaurant_id}:{table_id}"
    return hmac.new(
        JWT_SECRET.encode('utf-8'), 
        message.encode('utf-8'), 
        hashlib.sha256
    ).hexdigest()

def verify_qr_token(restaurant_id: int, table_id: int, token: str) -> bool:
    """
    Verify HMAC token from QR code
    
    Args:
        restaurant_id: Restaurant ID
        table_id: Table ID
        token: Token to verify
        
    Returns:
        True if token is valid
    """
    expected_token = create_qr_token(restaurant_id, table_id)
    return hmac.compare_digest(expected_token, token) 