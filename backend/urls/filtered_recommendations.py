# from fastapi import APIRouter, Header, Request
# import numpy as np
# from typing import Optional

# from config import rdb, qd
# from middleware.tenant_resolver import get_qdrant_collection

# router = APIRouter()

# def get_user_vec(tenant_id: str, sess_id: str):
#     """Get user vector for tenant-aware session"""
#     DIM = 1280
#     key = f"{tenant_id}:vec:{sess_id}"
#     raw = rdb.get(key)
#     if raw:
#         return np.frombuffer(raw, dtype=np.float32)
#     else:
#         # cold-start tiny random vector
#         return np.random.normal(0, 0.01, DIM).astype(np.float32)

# @router.get("/")
# def filtered_recommendations(
#     request: Request,
#     session_id: str = Header(..., alias="x-session-id"),
#     is_veg: Optional[bool] = None,
#     price_cap: Optional[int] = None,
#     group_category: Optional[str] = None,
# ):
#     # Get tenant-specific collection name and tenant ID
#     collection_name = get_qdrant_collection(request)
#     tenant_id = request.state.tenant_id
    
#     # prepare user vector and filters
#     user_vec = get_user_vec(tenant_id, session_id)
#     filters = []
#     if group_category is not None:
#         filters.append({"key": "group_category", "match": {"value": group_category}})
#     if is_veg is not None:
#         filters.append({"key": "veg_flag", "match": {"value": 1 if is_veg else 0}})
#     if price_cap is not None:
#         filters.append({"key": "price", "range": {"lte": price_cap}})

#     # vector search with filters
#     res = qd.search(
#         collection_name,
#         user_vec.tolist(),
#         query_filter={"must": filters} if filters else None,
#         limit=10,
#     )
#     ## Complete this API call
#     return res
