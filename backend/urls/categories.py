from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import List

from config import rdb, qd, qd_collection_name

router = APIRouter()

class Category(BaseModel):
    group_category: str
    category_brief: str

def get_all_categories() -> List[Category]:
    all_points = []
    limit = 100
    offset = 0
    while True:
        points = qd.scroll(
            collection_name=qd_collection_name,
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=False
        )
        if not points or not points[0]:
            break
        all_points.extend(points[0])
        offset += limit

    unique_pairs = {
        (p.payload.get("group_category"), p.payload.get("category_brief"))
        for p in all_points
        if getattr(p, "payload", None) and p.payload.get("group_category") is not None and p.payload.get("category_brief") is not None
    }

    categories = [Category(group_category=g, category_brief=b) for g, b in unique_pairs]
    return categories

@router.get("/", response_model=List[Category], summary="Get all categories", response_description="List of unique (group_category, category_brief) pairs")
def read_categories(session_id: str = Header(..., alias="x-session-id")):
    """Retrieve all unique (group_category, category_brief) pairs."""
    return get_all_categories()
