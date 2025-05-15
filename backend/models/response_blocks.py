from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import date
from recommender import DishCard, TextBlock, DishCarouselBlock, QuickRepliesBlock

# Extended DishCard with all fields needed for frontend rendering
class ResponseDishCard(DishCard):
    """Extended DishCard model that includes all fields needed for rendering in the frontend"""
    description: Optional[str] = ""
    price: float
    image_url: Optional[str] = None
    tags: List[str] = []
    veg_flag: bool = False
    insta_id: Optional[str] = None

# Extended DishCarouselBlock that uses ResponseDishCard
class ResponseDishCarouselBlock(BaseModel):
    """Extended DishCarouselBlock model that uses ResponseDishCard"""
    title: Optional[str] = ""
    type: Literal["dish_carousal", "story_carousal"]
    options: List[ResponseDishCard]

class ResponseBlocks(BaseModel):
    """Base response model for API endpoints that return blocks format"""
    blocks: List[TextBlock | ResponseDishCarouselBlock | QuickRepliesBlock | ResponseDishCard]

class PreviousOrderBlock(BaseModel):
    """Extended ResponseDishCarouselBlock model for previous orders"""
    options: List[ResponseDishCard]
    type: Literal["thumbnail_row"]
    date: date
    title: Optional[str] = ""

class PreviousOrdersResponse(BaseModel):
    """Response model for previous orders"""
    blocks: List[PreviousOrderBlock]
