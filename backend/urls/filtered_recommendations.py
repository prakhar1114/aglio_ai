from fastapi import APIRouter, Header
import numpy as np
from typing import Optional

from config import rdb, qd, qd_collection_name

router = APIRouter()

@router.get("/")
def filtered_recommendations(
    session_id: str = Header(..., alias="x-session-id"),
    is_veg: Optional[bool] = None,
    price_cap: Optional[int] = None,
    group_category: Optional[str] = None,
):
    # prepare user vector and filters
    user_vec = get_user_vec(session_id)
    filters = []
    if group_category is not None:
        filters.append({"key": "group_category", "match": {"value": group_category}})
    if is_veg is not None:
        filters.append({"key": "veg_flag", "match": {"value": 1 if is_veg else 0}})
    if price_cap is not None:
        filters.append({"key": "price", "range": {"lte": price_cap}})

    # vector search with filters
    res = qd.search(
        qd_collection_name,
        user_vec.tolist(),
        query_filter={"must": filters} if filters else None,
        limit=10,
    )
    ## Complete this API call
    return res
