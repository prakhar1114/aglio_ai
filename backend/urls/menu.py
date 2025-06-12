from fastapi import APIRouter, Header, Query, Request
from pydantic import BaseModel
from typing import List, Optional

from config import qd
from middleware.tenant_resolver import get_tenant_from_request

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
    

@router.get("/", response_model=MenuResponse, summary="Get menu items", response_description="List of menu items with optional filters and pagination")
def read_menu(
    request: Request,
    session_id: str = Header(..., alias="x-session-id"),
    cursor: Optional[int] = Query("", description="Pagination cursor"),
    group_category: Optional[str] = None,
    category_brief: Optional[list[str]] = Query(None),
    is_veg: Optional[bool] = None,
    price_cap: Optional[float] = None,
) -> MenuResponse:
    """Retrieve menu items with optional filters: group_category, category_brief, is_veg, price_cap."""
    # Get tenant-specific collection name
    tenant_info = get_tenant_from_request(request)
    image_base_dir = tenant_info["image_directory"].split("/")[-1]
    collection_name = tenant_info["qdrant_db_name"]
    
    filters = []
    print(category_brief)
    if category_brief:
        if len(category_brief) == 1:
            filters.append({"key": "category_brief", "match": {"value": category_brief[0]}})
        else:
            filters.append({"key": "category_brief", "match": {"any": category_brief}})
    # elif group_category is not None:
    #     filters.append({"key": "category_brief", "match": {"value": group_category}})
    if is_veg is not None and is_veg:
        filters.append({"key": "veg_flag", "match": {"value": 1}})
    if price_cap is not None:
        filters.append({"key": "price", "range": {"lte": price_cap}})

    # Convert cursor to offset - cursor can be string, None, or empty string
    # For first request, cursor is empty string, which we treat as None
    offset = cursor if cursor else None

    limit = 20  # Reasonable page size for infinite scroll
    
    points, next_offset = qd.scroll(
        collection_name=collection_name,
        limit=limit,
        offset=offset,
        with_payload=True,
        with_vectors=False,
        scroll_filter={"must": filters} if filters else None,
    )
    
    items = [
        MenuItem(
            id=(p.payload or {}).get("public_id"),
            name=(p.payload or {}).get("name"),
            description=(p.payload or {}).get("description"),
            price=(p.payload or {}).get("price"),
            veg_flag=bool((p.payload or {}).get("veg_flag")),
            image_url="image_data/" + image_base_dir + "/" + (p.payload or {}).get("image_path") if (p.payload or {}).get("image_path") else None,
            category_brief=(p.payload or {}).get("category_brief"),
        )
        for p in points
    ]
    
    # Set nextCursor - if there are more items, provide the next offset
    next_cursor = next_offset if next_offset is not None else None
    
    return MenuResponse(items=items, nextCursor=next_cursor)
