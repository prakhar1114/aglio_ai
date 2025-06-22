from fastapi import APIRouter, Header, Query, HTTPException, Path
from pydantic import BaseModel
from typing import List, Optional
import random
from sqlalchemy.orm import joinedload
from sqlalchemy import and_, or_

from models.schema import SessionLocal, Restaurant, MenuItem as MenuItemModel
from config import rdb

router = APIRouter()

class MenuItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    veg_flag: bool
    image_url: Optional[str]
    category_brief: Optional[str]

class MenuResponse(BaseModel):
    items: List[MenuItem]
    nextCursor: Optional[int] = None
    

@router.get("/restaurants/{restaurant_slug}/menu/", response_model=MenuResponse, summary="Get menu items", response_description="List of menu items with optional filters and pagination")
def read_menu(
    restaurant_slug: str = Path(..., description="Restaurant slug"),
    session_id: str = Header(..., alias="x-session-id"),
    cursor: Optional[int] = Query(None, description="Pagination cursor (offset)"),
    group_category: Optional[list[str]] = Query(None),
    category_brief: Optional[list[str]] = Query(None),
    is_veg: Optional[bool] = None,
    price_cap: Optional[float] = None,
) -> MenuResponse:
    """Retrieve menu items with optional filters: group_category, category_brief, is_veg, price_cap."""
    try:
        with SessionLocal() as db:
            # 1. Look up restaurant by slug
            restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # 2. Build filters for the query
            filter_conditions = [MenuItemModel.restaurant_id == restaurant.id]
            
            if group_category:
                if len(group_category) == 1:
                    filter_conditions.append(MenuItemModel.group_category == group_category[0])
                else:
                    filter_conditions.append(MenuItemModel.group_category.in_(group_category))
                    
            if category_brief:
                if len(category_brief) == 1:
                    filter_conditions.append(MenuItemModel.category_brief == category_brief[0])
                else:
                    filter_conditions.append(MenuItemModel.category_brief.in_(category_brief))
                    
            if is_veg is not None and is_veg:
                filter_conditions.append(MenuItemModel.veg_flag == True)
                
            if price_cap is not None:
                filter_conditions.append(MenuItemModel.price <= price_cap)
            
            # 3. Convert cursor to offset
            offset = cursor if cursor else 0
            limit = 500  # Keep the large batch size for masonry grid
            
            # 4. Handle first request - fetch promoted items first
            if cursor is None or cursor == 0:
                # First request - get promoted items
                promoted_query = db.query(MenuItemModel).filter(
                    and_(MenuItemModel.promote == True, *filter_conditions)
                ).limit(500)  # Get all promoted items
                
                promoted_items_db = promoted_query.all()
                
                promoted_items = [
                    MenuItem(
                        id=item.public_id,
                        name=item.name,
                        description=item.description,
                        price=item.price,
                        veg_flag=item.veg_flag,
                        image_url=f"image_data/{restaurant.slug}/{item.image_path}" if item.image_path else None,
                        category_brief="Recommendations"  # Set category as Recommendations for promoted items
                    )
                    for item in promoted_items_db
                ]
                
                # Shuffle promoted items among themselves
                random.shuffle(promoted_items)
                
                # Then fetch regular items (excluding promoted ones)
                regular_query = db.query(MenuItemModel).filter(
                    *filter_conditions
                ).order_by(MenuItemModel.id).limit(limit)
                
                regular_items_db = regular_query.all()
                
                regular_items = [
                    MenuItem(
                        id=item.public_id,
                        name=item.name,
                        description=item.description,
                        price=item.price,
                        veg_flag=item.veg_flag,
                        image_url=f"image_data/{restaurant.slug}/{item.image_path}" if item.image_path else None,
                        category_brief=item.category_brief
                    )
                    for item in regular_items_db
                ]
                
                # Combine promoted items at the top
                items = promoted_items + regular_items
                
                # Check if there are more regular items for pagination
                total_regular_count = db.query(MenuItemModel).filter(
                    *filter_conditions
                ).count()
                
                next_cursor = limit if total_regular_count > limit else None
                
            else:
                # Subsequent requests - just fetch regular items with offset
                regular_query = db.query(MenuItemModel).filter(
                    *filter_conditions
                ).order_by(MenuItemModel.id).offset(offset).limit(limit)
                
                items_db = regular_query.all()
                
                items = [
                    MenuItem(
                        id=item.public_id,
                        name=item.name,
                        description=item.description,
                        price=item.price,
                        veg_flag=item.veg_flag,
                        image_url=f"image_data/{restaurant.slug}/{item.image_path}" if item.image_path else None,
                        category_brief=item.category_brief
                    )
                    for item in items_db
                ]
                
                # Check if there are more items for pagination
                next_cursor = offset + limit if len(items) == limit else None
            
            return MenuResponse(items=items, nextCursor=next_cursor)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )
