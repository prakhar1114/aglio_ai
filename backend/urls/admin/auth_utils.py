import hmac
import secrets
from typing import Dict, Optional
from datetime import datetime, timedelta

from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session

from models.schema import Restaurant, SessionLocal
from utils.jwt_utils import encode_ws_token, decode_ws_token


def generate_api_key() -> str:
    """Generate a 12-character hexadecimal API key."""
    return secrets.token_hex(6)  # 6 bytes = 12 hex characters


def get_restaurant_api_keys() -> Dict[str, str]:
    """Get all restaurant slugs and their API keys from database."""
    db = SessionLocal()
    try:
        restaurants = db.query(Restaurant).filter(Restaurant.api_key.isnot(None)).all()
        return {restaurant.slug: restaurant.api_key for restaurant in restaurants}
    finally:
        db.close()


def auth(authorization: str = Header(None)) -> Dict[str, str]:
    """
    Authenticate admin API requests using Bearer token.
    
    Args:
        authorization: Authorization header containing Bearer token
        
    Returns:
        Dict containing restaurant_slug if authentication is successful
        
    Raises:
        HTTPException: 401 if no token provided, 403 if invalid token
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split()[1]
    
    # Get current API keys from database
    api_keys = get_restaurant_api_keys()
    
    # Compare token against stored API keys using timing-safe comparison
    for slug, key in api_keys.items():
        if hmac.compare_digest(token, key):
            return {"restaurant_slug": slug}
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid API key"
    )


def generate_and_assign_api_key(restaurant_slug: str) -> str:
    """
    Generate a new API key and assign it to a restaurant.
    
    Args:
        restaurant_slug: The slug of the restaurant to assign the API key to
        
    Returns:
        The generated API key
        
    Raises:
        ValueError: If restaurant not found
    """
    db = SessionLocal()
    try:
        restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
        if not restaurant:
            raise ValueError(f"Restaurant with slug '{restaurant_slug}' not found")
        
        # Generate new API key
        api_key = generate_api_key()
        
        # Ensure uniqueness
        while db.query(Restaurant).filter(Restaurant.api_key == api_key).first():
            api_key = generate_api_key()
        
        # Assign to restaurant
        restaurant.api_key = api_key
        db.commit()
        
        return api_key
    finally:
        db.close()


def validate_api_key(api_key: str) -> Optional[str]:
    """
    Validate API key and return restaurant slug if valid.
    
    Args:
        api_key: The API key to validate
        
    Returns:
        Restaurant slug if valid, None if invalid
    """
    api_keys = get_restaurant_api_keys()
    
    for slug, key in api_keys.items():
        if hmac.compare_digest(api_key, key):
            return slug
    
    return None


def create_admin_jwt_token(restaurant_slug: str, hours: int = 24) -> str:
    """
    Create a JWT token for admin dashboard access.
    
    Args:
        restaurant_slug: Restaurant slug for the token
        hours: Token validity in hours (default 24)
        
    Returns:
        JWT token string
    """
    # Use the existing JWT utility but adapt for admin use
    # We'll use restaurant_slug as both member_pid and session_pid for admin tokens
    return encode_ws_token(
        member_pid=f"admin:{restaurant_slug}",
        session_pid=restaurant_slug,
        device_id="dashboard",
        hours=hours
    )


def decode_admin_jwt_token(token: str) -> Optional[Dict[str, str]]:
    """
    Decode admin JWT token and extract restaurant slug.
    
    Args:
        token: JWT token string
        
    Returns:
        Dict with restaurant_slug if valid, None if invalid
    """
    payload = decode_ws_token(token)
    if not payload:
        return None
    
    # Extract restaurant slug from the session_pid field
    restaurant_slug = payload.get("sid")
    if not restaurant_slug:
        return None
    
    # Verify this is an admin token
    member_pid = payload.get("sub", "")
    if not member_pid.startswith("admin:"):
        return None
    
    return {"restaurant_slug": restaurant_slug}