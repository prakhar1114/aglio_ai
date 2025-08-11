from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from loguru import logger

from models.schema import SessionLocal, Restaurant
from urls.admin.auth_utils import validate_api_key

router = APIRouter()

security = HTTPBearer()

class LoginRequest(BaseModel):
    restaurant_slug: str
    api_key: str

class LoginResponse(BaseModel):
    success: bool
    restaurant_name: str
    restaurant_slug: str
    message: str

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """Login using restaurant slug and API key"""
    try:
        with SessionLocal() as db:
            # Find restaurant by slug
            restaurant = db.query(Restaurant).filter(
                Restaurant.slug == request.restaurant_slug
            ).first()
            
            if not restaurant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Restaurant not found"
                )
            
            # Validate API key
            if request.restaurant_slug != validate_api_key(request.api_key):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid API key"
                )
            
            logger.info(f"✅ Menu login successful for restaurant: {restaurant.name}")
            
            return LoginResponse(
                success=True,
                restaurant_name=restaurant.name,
                restaurant_slug=restaurant.slug,
                message="Login successful"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Menu login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

def get_restaurant_from_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Restaurant:
    """Get restaurant from Authorization header"""
    try:
        api_key = credentials.credentials
        
        with SessionLocal() as db:
            restaurant = db.query(Restaurant).filter(
                Restaurant.api_key == api_key
            ).first()
            
            if not restaurant:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid API key"
                )
            
            return restaurant
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        ) 