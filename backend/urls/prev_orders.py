from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import List, Optional, Literal

from config import qd, qd_collection_name
from recommender import TextBlock
from models import ResponseBlocks, ResponseDishCard, ResponseDishCarouselBlock

router = APIRouter()

@router.get("/", response_model=ResponseBlocks, summary="Get previous orders", response_description="Previous orders in dish_carousal format")
def read_prev_orders(
    session_id: str = Header(..., alias="x-session-id"),
) -> ResponseBlocks:
    """
    Retrieve dishes from previous orders with specific IDs.
    
    - **session_id**: Required session identifier
    - **Returns**: List of complete dish payloads for dish_id in [1, 6, 38]
    """
    # Specific dish IDs for previous orders
    dish_ids = [1, 6, 38]
    
    # Retrieve dishes by IDs
    points = qd.retrieve(
        collection_name=qd_collection_name,
        ids=dish_ids,
        with_payload=True,
        with_vectors=False,
    )
    
    # Create dish cards for each previous order
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
        for p in points
    ]
    
    # Create intro text block
    intro_text = TextBlock(
        type="text",
        markdown="## Your Previous Orders"
    )
    
    # Create dish carousel block
    carousel_block = ResponseDishCarouselBlock(
        type="dish_carousal",
        options=dish_cards
    )
    
    # Construct the final blocks response
    response = ResponseBlocks(blocks=[intro_text, carousel_block])
    
    return response.model_dump()
