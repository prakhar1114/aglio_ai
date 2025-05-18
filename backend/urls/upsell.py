import random
from fastapi import APIRouter, Header, Query, Body
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import json

from config import qd, qd_collection_name
from recommender import DishCard, TextBlock, Blocks, DishCarouselBlock
from common.utils import enrich_blocks

router = APIRouter()

@router.get("/", summary="Get upsell recommendations", response_description="Upsell recommendations based on cart and filters")
def get_upsell_recommendations(
    session_id: str = Header(..., alias="x-session-id"),
    cart: Optional[str] = Query(None, description="JSON string of cart items"),
    is_veg: Optional[bool] = Query(None, description="Filter for vegetarian items"),
    price_cap: Optional[int] = Query(None, description="Maximum price filter"),
    category: Optional[str] = Query(None, description="Category filter")
) -> Dict[str, Any]:
    """
    Get upsell recommendations based on cart and filters.
    
    - **session_id**: Required session identifier
    - **cart**: JSON string representing the current cart items
    - **is_veg**: Optional filter for vegetarian items
    - **price_cap**: Optional maximum price filter
    - **category**: Optional category filter
    - **Returns**: Upsell recommendations
    """
    # Parse cart items if provided
    cart_items = []
    cart_item_ids = set()
    if cart:
        try:
            cart_items = json.loads(cart)
            # Extract item IDs from cart
            cart_item_ids = {item.get('id') for item in cart_items if item.get('id') is not None}
        except json.JSONDecodeError:
            pass
    
    # Build filter for Qdrant query
    filters = [
        {"key": "is_high_margin", "match": {"value": 1}},
        {"key": "group_category", "match": {"value": "Appetizers"}} ###### REMOVE THIS LATER
    ]
    if is_veg:
        filters.append({"key": "veg_flag", "match": {"value": 1}})
    
    # Fetch high-margin items from Qdrant
    limit = 10
    offset = 0
    high_margin_items = []
    
    points, next_offset = qd.scroll(
        collection_name=qd_collection_name,
        limit=limit,
        offset=offset,
        with_payload=True,
        with_vectors=False,
        scroll_filter={"must": filters} if filters else None,
    )
    
    if points:
        high_margin_items = points
    
    # Convert to DishCard format and exclude items already in cart
    dish_cards = []
    for item in high_margin_items:
        # Skip if the item is already in the cart
        if item.id in cart_item_ids:
            continue
            
        dish_cards.append(
            DishCard(
                type="dish_card",
                id=item.id,
                name=(item.payload or {}).get("name")
            )
        )
    
    # Randomly select 3 items from dish_cards
    dish_cards = random.sample(dish_cards, min(3, len(dish_cards)))
    
    # Create text block
    text_block = TextBlock(
        type="text",
        markdown="This goes amazing with your cart. Add this to your cart to complete your meal."
    )
    
    # Create a dish carousel block instead of individual dish cards
    dish_carousel = DishCarouselBlock(
        type="dish_carousal",  # Note: API uses 'carousal' spelling
        options=dish_cards,
        title="Recommended For You"
    )
    
    # Prepare the blocks for the response
    blocks = [text_block, dish_carousel]
    
    # Create Blocks object and enrich with additional data
    response_blocks = Blocks(blocks=blocks)
    enriched_blocks = enrich_blocks(response_blocks)
    
    return {
        "status": "success",
        "message": "Upsell recommendations",
        "blocks": enriched_blocks["blocks"],
        "data": {
            "cart_items_count": len(cart_items),
            "recommendations_count": len(dish_cards)
        }
    }
