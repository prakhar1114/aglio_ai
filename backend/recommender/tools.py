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
from typing import List, Dict, Any, Tuple, Optional

import numpy as np
from sentence_transformers import SentenceTransformer
import os
import pickle
from rank_bm25 import BM25Okapi

from config import qd, logger
from models.schema import SessionLocal, MenuItem


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


def _get_collection_name(restaurant_slug: str) -> str:
    """Get Qdrant collection name for a restaurant."""
    return f"{restaurant_slug}_qdb"


def _get_menu_items_by_public_ids(public_ids: List[str], restaurant_slug: str) -> Dict[str, Dict[str, Any]]:
    """Fetch menu items from PostgreSQL by public_ids."""
    if not public_ids:
        return {}
    
    with SessionLocal() as db:
        # Get restaurant_id from slug
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return {}
        
        # Fetch menu items
        menu_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.public_id.in_(public_ids)
        ).all()
        
        # Convert to dict keyed by public_id
        result = {}
        for item in menu_items:
            result[item.public_id] = {
                "id": item.id,
                "public_id": item.public_id,
                "name": item.name,
                "description": item.description,
                "category_brief": item.category_brief,
                "group_category": item.group_category,
                "price": float(item.price),
                "image_path": item.image_path,
                "veg_flag": item.veg_flag,
                "is_bestseller": item.is_bestseller,
                "is_recommended": item.is_recommended,
                "kind": item.kind,
                "priority": item.priority,
                "promote": item.promote
            }
        return result


def _qdrant_to_menu_item(point, menu_items_dict: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Convert Qdrant point + PostgreSQL data to menu item dict."""
    public_id = point.payload.get("public_id")
    if not public_id or public_id not in menu_items_dict:
        return None
    
    pg_data = menu_items_dict[public_id]
    return {
        "id": pg_data["id"],  # PostgreSQL ID for describe_dish compatibility
        "public_id": public_id,
        "name": pg_data["name"],
        "description": pg_data["description"],
        "category": pg_data["category_brief"],
        "group_category": pg_data["group_category"],
        "price": pg_data["price"],
        "image_path": pg_data["image_path"],
        "veg": pg_data["veg_flag"],
        "is_bestseller": pg_data["is_bestseller"],
        "is_recommended": pg_data["is_recommended"],
        "kind": pg_data["kind"],
        "priority": pg_data["priority"],
        "promote": pg_data["promote"]
    }


def _apply_pg_filters(query, filters: Dict[str, Any]):
    """Apply filters to PostgreSQL MenuItem query."""
    if filters.get("isVeg") is True:
        query = query.filter(MenuItem.veg_flag == True)
    if filters.get("priceEnabled") and (priceRange := filters.get("priceRange")):
        query = query.filter(MenuItem.price <= float(priceRange[1]))
    if categories := filters.get("category"):
        if isinstance(categories, list):
            query = query.filter(MenuItem.category_brief.in_(categories))
        else:
            query = query.filter(MenuItem.category_brief == categories)
    return query


# ------------------------------------------------------------------#
# BM25 Index Loader
# ------------------------------------------------------------------#
_bm25_indexes = {}
_bm25_index_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'bm25_indexes')
if os.path.exists(_bm25_index_dir):
    for fname in os.listdir(_bm25_index_dir):
        if fname.endswith('_bm25.pkl'):
            slug = fname.replace('_bm25.pkl', '')
            try:
                with open(os.path.join(_bm25_index_dir, fname), 'rb') as f:
                    data = pickle.load(f)
                    _bm25_indexes[slug] = data
            except Exception as e:
                pass  # Could log error if needed

def _get_bm25_index(restaurant_slug):
    return _bm25_indexes.get(restaurant_slug)


# ------------------------------------------------------------------#
# Public API (exposed to the LLM) - now tenant-aware
# ------------------------------------------------------------------#
def search_menu(restaurant_slug: str,
                query: str,
                filters: Dict[str, Any] | None = None,
                limit: int = 10) -> List[Dict[str, Any]]:
    """Free‑text semantic search across name + description using embeddings and BM25."""
    # --- Qdrant semantic search ---
    collection_name = _get_collection_name(restaurant_slug)
    vec = _embed(query).tolist()
    limit = min(limit, 10)
    points = qd.search(
        collection_name=collection_name,
        query_vector=vec,
        limit=limit,
        with_payload=True
    )
    qdrant_public_ids = [p.payload.get("public_id") for p in points if p.payload.get("public_id")]

    # --- BM25 search ---
    bm25_data = _get_bm25_index(restaurant_slug)
    bm25_public_ids = []
    if bm25_data:
        bm25 = bm25_data['bm25']
        id_map = bm25_data['id_map']
        tokenized_query = query.lower().split()
        scores = bm25.get_scores(tokenized_query)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        for idx, score in ranked[:10]:
            bm25_public_ids.append(id_map[idx])

    logger.debug(f"Qdrant public ids: {qdrant_public_ids}")
    logger.debug(f"BM25 public ids: {bm25_public_ids}")

    # --- Merge and deduplicate ---
    all_public_ids = []
    seen = set()
    for pid in qdrant_public_ids + bm25_public_ids:
        if pid and pid not in seen:
            all_public_ids.append(pid)
            seen.add(pid)

    # --- Fetch from Postgres ---
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        query_obj = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.public_id.in_(all_public_ids),
            MenuItem.is_active == True,
            MenuItem.show_on_menu == True
        )
        query_obj = _apply_pg_filters(query_obj, filters or {})
        menu_items = query_obj.limit(20).all()
        # Convert to result format
        result = []
        for item in menu_items:
            result.append({
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
            })
        # print(f"Result: {result}")
        return result


def get_chefs_picks(restaurant_slug: str,
                    filters: Dict[str, Any] | None = None,
                    limit: int = 6) -> List[Dict[str, Any]]:
    """Return dishes flagged as chef‑recommended (or bestsellers as fallback)."""
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        
        # Try chef recommended first
        query_obj = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_recommended == True
        )
        query_obj = _apply_pg_filters(query_obj, filters or {})
        items = query_obj.limit(limit).all()
        
        # Fallback to bestsellers if needed
        if len(items) < limit:
            bestseller_query = db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant.id,
                MenuItem.is_bestseller == True
            )
            bestseller_query = _apply_pg_filters(bestseller_query, filters or {})
            extra_items = bestseller_query.limit(limit - len(items)).all()
            items.extend(extra_items)
        
        # Convert to result format
        result = []
        for item in items[:limit]:
            result.append({
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
                "reason": "Chef's Pick" if item.is_recommended else "Bestseller"
            })
        
        return result


def list_all_items(restaurant_slug: str,
                   filters: Dict[str, Any] | None = None,
                   page: int = 1,
                   page_size: int = 12) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Paginated full‑menu listing.
    Returns (items, has_more).
    """
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return [], False
        
        query_obj = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id)
        query_obj = _apply_pg_filters(query_obj, filters or {})
        
        offset = (page - 1) * page_size
        items = query_obj.offset(offset).limit(page_size + 1).all()  # +1 to check has_more
        
        has_more = len(items) > page_size
        if has_more:
            items = items[:-1]  # Remove the extra item
        
        # Convert to result format
        result = []
        for item in items:
            result.append({
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
            })
        
        return result, has_more


def find_similar_items(restaurant_slug: str,
                       dish_id: int,
                       filters: Dict[str, Any] | None = None,
                       limit: int = 6) -> List[Dict[str, Any]]:
    """Return dishes with embedding‑space proximity to a reference dish."""
    collection_name = _get_collection_name(restaurant_slug)
    
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        
        # First, get the public_id of the reference dish from PostgreSQL
        ref_dish = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.id == dish_id
        ).first()
        
        if not ref_dish:
            return []
        
        ref_public_id = ref_dish.public_id
    
    # Find the Qdrant point with this public_id and get its vector
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        ref_points = qd.scroll(
            collection_name=collection_name,
            scroll_filter=Filter(
                must=[FieldCondition(key="public_id", match=MatchValue(value=ref_public_id))]
            ),
            with_vectors=True,
            limit=1
        )[0]
        
        if not ref_points or not ref_points[0].vector:
            return []
        
        ref_vector = ref_points[0].vector
        
    except Exception:
        return []
    
    # Search for similar vectors
    points = qd.search(
        collection_name=collection_name,
        query_vector=list(ref_vector),
        limit=limit + 1,  # +1 to account for excluding reference
        with_payload=True
    )
    
    # Filter out the reference dish and extract public_ids
    public_ids = []
    for p in points:
        p_public_id = p.payload.get("public_id")
        if p_public_id and p_public_id != ref_public_id:
            public_ids.append(p_public_id)
    
    # Get filtered results from PostgreSQL
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        
        query_obj = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.public_id.in_(public_ids[:limit])
        )
        query_obj = _apply_pg_filters(query_obj, filters or {})
        items = query_obj.limit(limit).all()
        
        # Convert to result format
        result = []
        for item in items:
            result.append({
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
                "reason": "Similar taste profile"
            })
        
        return result


def budget_friendly_options(restaurant_slug: str,
                            priceCap: float,
                            filters: Dict[str, Any] | None = None,
                            limit: int = 8) -> List[Dict[str, Any]]:
    """Return dishes whose price <= priceCap, plus user filters."""
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        
        query_obj = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.price <= float(priceCap)
        )
        query_obj = _apply_pg_filters(query_obj, filters or {})
        items = query_obj.limit(limit).all()
        
        # Convert to result format
        result = []
        for item in items:
            result.append({
                "id": item.id,
                "public_id": item.public_id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
                "price": float(item.price),
                "veg": item.veg_flag,
                "reason": f"₹{item.price} only"
            })
        
        return result


def describe_dish(restaurant_slug: str,
                  dish_id: int) -> Dict[str, Any] | None:
    """Return detailed info about a specific dish."""
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return None
        
        # dish_id is the PostgreSQL MenuItem.id
        item = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.id == dish_id
        ).first()
        
        if not item:
            return None
        
        return {
            "id": item.id,
            "public_id": item.public_id,
            "name": item.name,
            "description": item.description,
            "category": item.category_brief,
            "group_category": item.group_category,
            "price": float(item.price),
            "veg": item.veg_flag,
            "image_path": item.image_path,
            "is_bestseller": item.is_bestseller,
            "is_recommended": item.is_recommended
        }


def get_cart_pairings(restaurant_slug: str,
                      cart: List[Dict[str, Any]],
                      filters: Dict[str, Any] | None = None,
                      limit: int = 6) -> List[Dict[str, Any]]:
    """
    Recommend dishes that complement items in the cart.
    Uses embeddings to find semantically related dishes.
    """
    if not cart:
        return []

    collection_name = _get_collection_name(restaurant_slug)
    
    # Extract dish IDs from cart (these should be PostgreSQL MenuItem.id values)
    cart_dish_ids = [item["id"] for item in cart if "id" in item]
    if not cart_dish_ids:
        return []
    
    # Get public_ids for cart items from PostgreSQL
    with SessionLocal() as db:
        from models.schema import Restaurant
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return []
        
        cart_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.id.in_(cart_dish_ids)
        ).all()
        
        cart_public_ids = [item.public_id for item in cart_items]
    
    if not cart_public_ids:
        return []
    
    # Find Qdrant point IDs for cart items
    try:
        # We need to find the Qdrant point IDs that correspond to these public_ids
        # This is a bit tricky - we'll search for exact matches by public_id
        cart_vectors = []
        for public_id in cart_public_ids:
            # Search for the exact public_id in Qdrant
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            points = qd.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="public_id", match=MatchValue(value=public_id))]
                ),
                with_vectors=True,
                limit=1
            )[0]
            
            if points and points[0].vector:
                cart_vectors.append(np.array(points[0].vector))
        
        if not cart_vectors:
            return []
        
        # Calculate average vector
        avg_vec = np.mean(cart_vectors, axis=0)
        
        # Search for similar items
        points = qd.search(
            collection_name=collection_name,
            query_vector=avg_vec.tolist(),
            limit=limit * 2,  # Get more to filter out cart items
            with_payload=True
        )
        
        # Extract public_ids, excluding cart items
        public_ids = []
        for p in points:
            p_id = p.payload.get("public_id")
            if p_id and p_id not in cart_public_ids:
                public_ids.append(p_id)
        
        # Get filtered results from PostgreSQL
        query_obj = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.public_id.in_(public_ids[:limit])
        )
        query_obj = _apply_pg_filters(query_obj, filters or {})
        items = query_obj.limit(limit).all()
        
        # Convert to result format
        result = []
        for item in items:
            result.append({
                "id": item.id,
                "public_id": item.public_id,
                "name": item.name,
                "description": item.description,
                "category": item.category_brief,
                "group_category": item.group_category,
                "price": float(item.price),
                "veg": item.veg_flag,
                "reason": "Pairs well with your cart"
            })
        
        return result
        
    except Exception:
        return []


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
