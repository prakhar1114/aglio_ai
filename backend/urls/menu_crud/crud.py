from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from loguru import logger
import uuid
import re

from models.schema import SessionLocal, MenuItem, Restaurant
from .auth import get_restaurant_from_auth

router = APIRouter()

# Pydantic models for API
class MenuItemBase(BaseModel):
    name: str
    category_brief: Optional[str] = None
    group_category: Optional[str] = None
    description: Optional[str] = None
    price: float
    image_path: Optional[str] = None
    cloudflare_image_id: Optional[str] = None
    cloudflare_video_id: Optional[str] = None
    veg_flag: bool = False
    is_bestseller: bool = False
    is_recommended: bool = False
    # kind: str = "food"
    priority: int = 0
    promote: bool = False
    show_on_menu: bool = True
    tags: List[str] = []
    timing_start: Optional[str] = None
    timing_end: Optional[str] = None

class MenuItemCreate(MenuItemBase):
    pass

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category_brief: Optional[str] = None
    group_category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_path: Optional[str] = None
    cloudflare_image_id: Optional[str] = None
    cloudflare_video_id: Optional[str] = None
    veg_flag: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_recommended: Optional[bool] = None
    kind: Optional[str] = None
    priority: Optional[int] = None
    promote: Optional[bool] = None
    show_on_menu: Optional[bool] = None
    tags: Optional[List[str]] = None

class MenuItemResponse(MenuItemBase):
    id: int
    public_id: str
    restaurant_id: int
    is_active: bool
    external_id: Optional[str] = None
    itemallowvariation: bool
    itemallowaddon: bool
    # pos_system_id: Optional[int] = None

    model_config = {
        "from_attributes": True
    }

class MenuItemsResponse(BaseModel):
    items: List[MenuItemResponse]
    total: int
    page: int
    per_page: int

def new_id() -> str:
    """Generate 6-char public_id."""
    return uuid.uuid4().hex[:6]

def generate_external_id(name: str) -> str:
    """Generate external_id from name: lowercase, remove punctuation, replace spaces with underscores"""
    # Convert to lowercase
    external_id = name.lower()
    
    # Remove punctuation except underscores and hyphens
    external_id = re.sub(r'[^\w\s-]', '', external_id)
    
    # Replace spaces and hyphens with underscores
    external_id = re.sub(r'[\s-]+', '_', external_id)
    
    # Remove leading/trailing underscores
    external_id = external_id.strip('_')
    
    return external_id

@router.get("/items", response_model=MenuItemsResponse)
def get_menu_items(
    restaurant: Restaurant = Depends(get_restaurant_from_auth),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category_brief: Optional[str] = None,
    group_category: Optional[str] = None,
    is_veg: Optional[bool] = None,
    is_active: Optional[bool] = None,
    promote: Optional[bool] = None,
    is_bestseller: Optional[bool] = None,
    is_recommended: Optional[bool] = None,
    search: Optional[str] = None
):
    """Get menu items with pagination and filters"""
    logger.info(f"🔍 get_menu_items called with: promote={promote}, is_bestseller={is_bestseller}, is_recommended={is_recommended}, is_active={is_active}, is_veg={is_veg}")
    try:
        with SessionLocal() as db:
            query = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id)
            
            # Apply filters
            if category_brief and category_brief != "":
                query = query.filter(MenuItem.category_brief == category_brief)
            if group_category and group_category != "":
                query = query.filter(MenuItem.group_category == group_category)
            if is_veg is not None and is_veg != "null":
                # Convert string "true"/"false" to boolean
                if isinstance(is_veg, str):
                    is_veg_bool = is_veg.lower() == "true"
                else:
                    is_veg_bool = bool(is_veg)
                query = query.filter(MenuItem.veg_flag == is_veg_bool)
            if is_active is not None and is_active != "null":
                # Convert string "true"/"false" to boolean
                if isinstance(is_active, str):
                    is_active_bool = is_active.lower() == "true"
                else:
                    is_active_bool = bool(is_active)
                query = query.filter(MenuItem.is_active == is_active_bool)
            if promote is not None and promote != "null":
                # Convert string "true"/"false" to boolean
                if isinstance(promote, str):
                    promote_bool = promote.lower() == "true"
                else:
                    promote_bool = bool(promote)
                logger.info(f"🔍 Applying promote filter: {promote} -> {promote_bool}")
                query = query.filter(MenuItem.promote == promote_bool)
            if is_bestseller is not None and is_bestseller != "null":
                # Convert string "true"/"false" to boolean
                if isinstance(is_bestseller, str):
                    is_bestseller_bool = is_bestseller.lower() == "true"
                else:
                    is_bestseller_bool = bool(is_bestseller)
                logger.info(f"🔍 Applying is_bestseller filter: {is_bestseller} -> {is_bestseller_bool}")
                query = query.filter(MenuItem.is_bestseller == is_bestseller_bool)
            if is_recommended is not None and is_recommended != "null":
                # Convert string "true"/"false" to boolean
                if isinstance(is_recommended, str):
                    is_recommended_bool = is_recommended.lower() == "true"
                else:
                    is_recommended_bool = bool(is_recommended)
                logger.info(f"🔍 Applying is_recommended filter: {is_recommended} -> {is_recommended_bool}")
                query = query.filter(MenuItem.is_recommended == is_recommended_bool)
            if search:
                query = query.filter(
                    MenuItem.name.ilike(f"%{search}%") | 
                    MenuItem.description.ilike(f"%{search}%")
                )
            
            # Get total count
            total = query.count()
            
            # Apply pagination
            offset = (page - 1) * per_page
            items = query.offset(offset).limit(per_page).all()
            
            # Convert MenuItem objects to MenuItemResponse objects
            response_items = []
            for item in items:
                response_items.append(MenuItemResponse.model_validate(item))
            
            return MenuItemsResponse(
                items=response_items,
                total=total,
                page=page,
                per_page=per_page
            )
            
    except Exception as e:
        logger.error(f"❌ Error getting menu items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/items/{public_id}", response_model=MenuItemResponse)
def get_menu_item(
    public_id: str,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Get a single menu item by public_id"""
    try:
        with SessionLocal() as db:
            item = db.query(MenuItem).filter(
                MenuItem.public_id == public_id,
                MenuItem.restaurant_id == restaurant.id
            ).first()
            
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu item not found"
                )
            
            return MenuItemResponse.model_validate(item)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting menu item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/items", response_model=MenuItemResponse)
def create_menu_item(
    item_data: MenuItemCreate,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Create a new menu item"""
    try:
        with SessionLocal() as db:
            # Generate public_id
            public_id = new_id()
            
            # Generate external_id from name
            external_id = generate_external_id(item_data.name)
            
            # Create menu item
            menu_item = MenuItem(
                public_id=public_id,
                restaurant_id=restaurant.id,
                external_id=external_id,
                **item_data.model_dump()
            )
            
            db.add(menu_item)
            db.commit()
            db.refresh(menu_item)
            
            logger.info(f"✅ Created menu item: {menu_item.name} (ID: {public_id}, External ID: {external_id})")
            
            return MenuItemResponse.model_validate(menu_item)
            
    except Exception as e:
        logger.error(f"❌ Error creating menu item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/items/{public_id}", response_model=MenuItemResponse)
def update_menu_item(
    public_id: str,
    item_data: MenuItemUpdate,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Update a menu item"""
    try:
        with SessionLocal() as db:
            # Find the menu item
            menu_item = db.query(MenuItem).filter(
                MenuItem.public_id == public_id,
                MenuItem.restaurant_id == restaurant.id
            ).first()
            
            if not menu_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu item not found"
                )
            
            # Update fields (only non-None values)
            update_data = item_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(menu_item, field, value)
            
            db.commit()
            
            logger.info(f"✅ Updated menu item: {menu_item.name} (ID: {public_id})")
            
            return MenuItemResponse.model_validate(menu_item)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating menu item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.patch("/items/{public_id}/toggle-active")
def toggle_menu_item_active(
    public_id: str,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Toggle menu item active status"""
    try:
        with SessionLocal() as db:
            # Find the menu item
            menu_item = db.query(MenuItem).filter(
                MenuItem.public_id == public_id,
                MenuItem.restaurant_id == restaurant.id
            ).first()
            
            if not menu_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu item not found"
                )
            
            # Toggle active status
            menu_item.is_active = not menu_item.is_active
            db.commit()
            
            status_msg = "activated" if menu_item.is_active else "deactivated"
            logger.info(f"✅ {status_msg.capitalize()} menu item: {menu_item.name} (ID: {public_id})")
            
            return {
                "success": True, 
                "message": f"Menu item {status_msg} successfully",
                "is_active": menu_item.is_active
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error toggling menu item active status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
