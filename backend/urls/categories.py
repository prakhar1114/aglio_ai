from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import List

from config import rdb, qd, qd_collection_name

router = APIRouter()

class Category(BaseModel):
    group_category: str
    category_brief: str
    total_count: int = 0
    veg_count: int = 0

def get_all_categories() -> List[Category]:
    all_points = []
    limit = 100
    offset = None  # Start with None for the first request
    while True:
        points, next_offset = qd.scroll(
            collection_name=qd_collection_name,
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=False
        )
        
        if not points:
            break
            
        all_points.extend(points)
        
        if next_offset is None:
            # No more points to scroll
            break
            
        offset = next_offset

    # Create a dictionary to store category counts
    category_counts = {}
    for p in all_points:
        if not (getattr(p, "payload", None) and 
                p.payload.get("group_category") is not None and 
                p.payload.get("category_brief") is not None):
            continue
            
        key = (p.payload.get("group_category"), p.payload.get("category_brief"))
        if key not in category_counts:
            category_counts[key] = {"total": 0, "veg": 0}
            
        category_counts[key]["total"] += 1
        if p.payload.get("veg_flag"):
            category_counts[key]["veg"] += 1
    
    # Create response objects with counts
    categories = [
        Category(
            group_category=g,
            category_brief=b,
            total_count=counts["total"],
            veg_count=counts["veg"]
        ) 
        for (g, b), counts in category_counts.items()
    ]
    
    return categories

@router.get("/", response_model=List[Category], summary="Get all categories", response_description="List of unique (group_category, category_brief) pairs")
def read_categories(session_id: str = Header(..., alias="x-session-id")):
    """Retrieve all unique (group_category, category_brief) pairs."""
    return get_all_categories()
