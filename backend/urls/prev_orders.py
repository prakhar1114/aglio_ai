# from fastapi import APIRouter, Header, Request
# from pydantic import BaseModel
# from typing import List, Optional, Literal
# from datetime import date

# from config import qd
# from middleware.tenant_resolver import get_qdrant_collection
# from recommender import TextBlock
# from models import ResponseBlocks, ResponseDishCard, PreviousOrderBlock, PreviousOrdersResponse

# router = APIRouter()

# @router.get("/", response_model=PreviousOrdersResponse, summary="Get previous orders", response_description="Previous orders in dish_carousal format")
# def read_prev_orders(
#     request: Request,
#     session_id: str = Header(..., alias="x-session-id"),
# ) -> PreviousOrdersResponse:
#     """
#     Retrieve previous orders for the current user.
    
#     - **session_id**: Required session identifier
#     - **Returns**: List of previous orders, each as a block containing a date and a carousel of dish cards for that order.
#     """
#     # Get tenant-specific collection name
#     collection_name = get_qdrant_collection(request)
    
#     # in descending order of dates
#     blocks = []    

#     # Create dish carousel block
#     carousel_block_2 = create_prev_order_block(collection_name, date="2025-05-15", dish_ids=[2, 7, 39])
#     blocks.append(carousel_block_2)

#     # Create dish carousel block
#     carousel_block_1 = create_prev_order_block(collection_name, date="2025-03-01", dish_ids=[1, 6, 38])
#     blocks.append(carousel_block_1)

#     # Construct the final blocks response
#     response = PreviousOrdersResponse(blocks=blocks)
    
#     return response.model_dump()


# def create_prev_order_block(collection_name: str, date: date, dish_ids: list[int]) -> PreviousOrderBlock:
#     # Retrieve dishes by IDs
#     points = qd.retrieve(
#         collection_name=collection_name,
#         ids=dish_ids,
#         with_payload=True,
#         with_vectors=False,
#     )
    
#     # Create dish cards for each previous order
#     dish_cards = [
#         ResponseDishCard(
#             type="dish_card",
#             id=p.id,
#             name=(p.payload or {}).get("name"),
#             description=(p.payload or {}).get("description", ""),
#             price=(p.payload or {}).get("price"),
#             image_url=(p.payload or {}).get("image_path"),
#             # tags=[(p.payload or {}).get("category_brief")] if (p.payload or {}).get("category_brief") else [],
#             veg_flag=bool((p.payload or {}).get("veg_flag")),
#             insta_id=(p.payload or {}).get("insta_id")
#         )
#         for p in points
#     ]

#     block = PreviousOrderBlock(
#         type="thumbnail_row",
#         options=dish_cards,
#         date=date
#     )
#     return block

        