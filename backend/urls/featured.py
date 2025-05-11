from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import List, Optional, Literal

from config import qd, qd_collection_name
from recommender import TextBlock
from models import ResponseBlocks, ResponseDishCard, ResponseDishCarouselBlock

router = APIRouter()

@router.get("/", response_model=ResponseBlocks, summary="Get featured dishes", response_description="Featured dishes in dish_carousal format")
def read_featured(
    session_id: str = Header(..., alias="x-session-id"),
) -> ResponseBlocks:
    """
    Retrieve dishes marked as featured.
    
    - **session_id**: Required session identifier
    - **Returns**: List of complete dish payloads marked as featured
    """
    # Query Qdrant for dishes with "featured": True
    filters = [{"key": "featured", "match": {"value": True}}]
    
    limit = 100
    offset = 0
    all_points = []
    
    while True:
        points = qd.scroll(
            collection_name=qd_collection_name,
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=False,
            scroll_filter={"must": filters} if filters else None,
        )
        if not points or not points[0]:
            break
        all_points.extend(points[0])
        offset += limit
    
    # Create dish cards for each featured dish
    dish_cards = [
        ResponseDishCard(
            type="dish_card",
            id=p.id,
            name=(p.payload or {}).get("name"),
            description=(p.payload or {}).get("description", ""),
            price=(p.payload or {}).get("price"),
            image_url=(p.payload or {}).get("image_path"),
            # tags=[(p.payload or {}).get("category_brief")] if (p.payload or {}).get("category_brief") else [],
            veg_flag=bool((p.payload or {}).get("veg_flag")),
            insta_id=(p.payload or {}).get("insta_id")
        )
        for p in all_points
    ]
    
    # Create dish carousel block
    carousel_block = ResponseDishCarouselBlock(
        type="story_carousal",
        title="Featured Dishes you'll love:",
        options=dish_cards
    )
    
    # Construct the final blocks response
    response = ResponseBlocks(blocks=[carousel_block])
    
    return response.model_dump()
