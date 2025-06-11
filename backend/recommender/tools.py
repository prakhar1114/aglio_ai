"""
tools.py – Utility layer that backs the LLM "function‑calling" interface.

Each public function matches the names you registered with OpenAI:
    search_menu
    get_chefs_picks
    get_category_items
    list_all_items
    find_similar_items
    budget_friendly_options
    describe_dish
    get_cart_pairings
    validate_blocks

Internal helpers (prefixed with "_") keep the code DRY.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Dict, Any, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer

from config import qd


# ------------------------------------------------------------------#
# Embedding helpers
# ------------------------------------------------------------------#
@lru_cache(maxsize=1)
def _txt_model() -> SentenceTransformer:
    """Lazy‑load the sentence‑transformer used in 01_build_embeddings.py."""
    return SentenceTransformer("all-mpnet-base-v2")


def _embed(text: str) -> np.ndarray:
    """Encode text into the same vector space as stored dish embeddings."""
    # get text embedding
    t_vec = _txt_model().encode(text)
    # pad with zeros for image embedding
    i_vec = np.zeros(512)
    return np.concatenate([t_vec, i_vec])


def _payload_to_item(point) -> Dict[str, Any]:
    """Convert a Qdrant point to the dict schema used in chat "dish_carousal"."""
    pl = point.payload or {}
    return {
        "id": point.id,
        "name": pl.get("name"),
        "description": pl.get("description"),
        "category": pl.get("category_brief"),
    }


def _apply_filters(filters: Dict[str, Any]) -> List[Dict]:
    """Translate UI filters into Qdrant 'must' clauses."""
    must = []
    if filters.get("veg") is True:
        must.append({"key": "veg_flag", "match": {"value": 1}})
    if price := filters.get("priceCap"):
        must.append({"key": "price", "range": {"lte": float(price)}})
    if cat := filters.get("category_brief"):
        must.append({"key": "category_brief", "match": {"any": cat}})
    return must


# ------------------------------------------------------------------#
# Public API (exposed to the LLM) - now tenant-aware
# ------------------------------------------------------------------#
def search_menu(collection_name: str,
                query: str,
                filters: Dict[str, Any] | None = None,
                limit: int = 8) -> List[Dict[str, Any]]:
    """Free‑text semantic search across name + description using embeddings."""
    vec = _embed(query).tolist()
    must = _apply_filters(filters or {})
    points = qd.search(
        collection_name,
        query_vector=vec,
        query_filter={"must": must} if must else None,
        limit=limit,
    )
    return [_payload_to_item(p) for p in points]


def get_chefs_picks(collection_name: str,
                    filters: Dict[str, Any] | None = None,
                    limit: int = 6) -> List[Dict[str, Any]]:
    """Return dishes flagged as chef‑recommended (or bestsellers as fallback)."""
    base = [
        {"key": "is_chef_recommended", "match": {"value": 1}},
    ]
    alt  = [
        {"key": "is_bestseller", "match": {"value": 1}},
    ]
    base.extend(_apply_filters(filters or {}))
    alt.extend(_apply_filters(filters or {}))

    points = qd.scroll(
        collection_name,
        scroll_filter={"must": base},
        with_payload=True,
        with_vectors=False,
        limit=limit,
    )[0]

    # top‑up with bestsellers if needed
    if len(points) < limit:
        extra = qd.scroll(
            collection_name,
            scroll_filter={"must": alt},
            with_payload=True,
            with_vectors=False,
            limit=limit - len(points),
        )[0]
        points.extend(extra)

    items = [_payload_to_item(p) for p in points[:limit]]
    return items



def list_all_items(collection_name: str,
                   filters: Dict[str, Any] | None = None,
                   page: int = 1,
                   page_size: int = 12) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Paginated full‑menu listing.
    Returns (items, has_more).
    """
    must = _apply_filters(filters or {})
    offset = (page - 1) * page_size
    points = qd.scroll(
        collection_name,
        scroll_filter={"must": must} if must else None,
        with_payload=True,
        with_vectors=False,
        offset=offset,
        limit=page_size,
    )[0]
    items = [_payload_to_item(p) for p in points]
    has_more = len(points) == page_size
    return items, has_more


def find_similar_items(collection_name: str,
                       dish_id: int,
                       filters: Dict[str, Any] | None = None,
                       limit: int = 6) -> List[Dict[str, Any]]:
    """Return dishes with embedding‑space proximity to a reference dish."""
    ref = qd.retrieve(collection_name, ids=[dish_id], with_vectors=True)[0]
    must = _apply_filters(filters or {})
    must.append({"key": "id", "match": {"not": {"value": dish_id}}})
    pts = qd.search(
        collection_name,
        query_vector=list(ref.vector),
        query_filter={"must": must} if must else None,
        limit=limit,
    )
    items = [_payload_to_item(p) for p in pts]
    for it in items:
        it["reason"] = "Similar taste profile"
    return items


def budget_friendly_options(collection_name: str,
                            priceCap: float,
                            filters: Dict[str, Any] | None = None,
                            limit: int = 8) -> List[Dict[str, Any]]:
    """Return dishes whose price <= priceCap, plus user filters."""
    must = _apply_filters(filters or {})
    must.append({"key": "price", "range": {"lte": float(priceCap)}})
    pts = qd.scroll(
        collection_name,
        scroll_filter={"must": must},
        with_payload=True,
        with_vectors=False,
        limit=limit,
    )[0]
    items = [_payload_to_item(p) for p in pts]
    for it in items:
        it["reason"] = f"₹{it['price']} only"
    return items


def describe_dish(collection_name: str,
                  dish_id: int) -> Dict[str, Any] | None:
    """Return detailed info about a specific dish."""
    try:
        point = qd.retrieve(collection_name, ids=[dish_id], with_payload=True)[0]
        pl = point.payload or {}
        return {
            "id": point.id,
            "name": pl.get("name"),
            "description": pl.get("description"),
            "category": pl.get("category_brief"),
            "price": pl.get("price"),
            "veg": bool(pl.get("veg_flag")),
        }
    except Exception:
        return None


def get_cart_pairings(collection_name: str,
                      cart: List[Dict[str, Any]],
                      filters: Dict[str, Any] | None = None,
                      limit: int = 6) -> List[Dict[str, Any]]:
    """
    Recommend dishes that complement items in the cart.
    Uses embeddings to find semantically related dishes.
    """
    if not cart:
        return []

    ids_in_cart = [item["id"] for item in cart if "id" in item]
    if not ids_in_cart:
        return []

    # get embeddings for cart items
    recs = qd.retrieve(collection_name, ids=ids_in_cart, with_vectors=True)
    cart_vecs = [np.array(rec.vector) for rec in recs]
    avg_vec = np.mean(cart_vecs, axis=0)

    must = _apply_filters(filters or {})
    must.append({"key": "id", "match": {"not": {"any": ids_in_cart}}})
    pts = qd.search(
        collection_name,
        query_vector=avg_vec.tolist(),
        query_filter={"must": must} if must else None,
        limit=limit,
    )
    items = [_payload_to_item(p) for p in pts]
    for it in items:
        it["reason"] = "Pairs well with your cart"
    return items


# # ------------------------------------------------------------------#
# #  Schema validator
# # ------------------------------------------------------------------#
# def validate_blocks(response: Dict[str, Any]) -> bool:
#     """
#     Lightweight runtime check to ensure LLM output conforms to the
#     agreed client schema.
#     """
#     if not isinstance(response, dict) or "blocks" not in response:
#         return False
#     blocks = response["blocks"]
#     if not isinstance(blocks, list):
#         return False

#     for blk in blocks:
#         if not isinstance(blk, dict) or "type" not in blk:
#             return False
#         t = blk["type"]

#         if t == "text":
#             if "markdown" not in blk:
#                 return False

#         elif t == "dish_carousal":
#             opts = blk.get("options")
#             if not isinstance(opts, list):
#                 return False
#             for opt in opts:
#                 if (
#                     not isinstance(opt, dict)
#                     or "id" not in opt
#                     or "reason" not in opt
#                 ):
#                     return False

#         elif t == "quick_replies":
#             if not isinstance(blk.get("options"), list):
#                 return False

#         else:
#             return False

#     return True
