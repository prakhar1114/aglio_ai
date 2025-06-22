from fastapi import APIRouter, Header, HTTPException, Path
from pydantic import BaseModel
from typing import List
from sqlalchemy import func, and_, case

from models.schema import SessionLocal, Restaurant, MenuItem as MenuItemModel

router = APIRouter()

class Category(BaseModel):
    group_category: str
    category_brief: str
    total_count: int = 0
    veg_count: int = 0

def get_all_categories(restaurant_id: int) -> List[Category]:
    """Get all categories for a specific restaurant with counts"""
    with SessionLocal() as db:
        # Query to get category combinations with counts
        query = db.query(
            MenuItemModel.group_category,
            MenuItemModel.category_brief,
            func.count().label('total_count'),
            func.sum(case((MenuItemModel.veg_flag == True, 1), else_=0)).label('veg_count')
        ).filter(
            and_(
                MenuItemModel.restaurant_id == restaurant_id,
                MenuItemModel.group_category.isnot(None),
                MenuItemModel.category_brief.isnot(None)
            )
        ).group_by(
            MenuItemModel.group_category,
            MenuItemModel.category_brief
        ).all()
        
        categories = [
            Category(
                group_category=row.group_category,
                category_brief=row.category_brief,
                total_count=row.total_count,
                veg_count=row.veg_count or 0
            )
            for row in query
        ]
        
        return categories

@router.get("/restaurants/{restaurant_slug}/categories/", response_model=List[Category], summary="Get all categories", response_description="List of unique (group_category, category_brief) pairs")
def read_categories(
    restaurant_slug: str = Path(..., description="Restaurant slug"),
    session_id: str = Header(..., alias="x-session-id")
):
    """Retrieve all unique (group_category, category_brief) pairs for a restaurant."""
    try:
        with SessionLocal() as db:
            # Look up restaurant by slug
            restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            return get_all_categories(restaurant.id)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )
