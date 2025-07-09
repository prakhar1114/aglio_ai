from fastapi import APIRouter, Header, Query, HTTPException, Path
from pydantic import BaseModel
from typing import List, Optional
import random
from sqlalchemy.orm import joinedload
from sqlalchemy import and_, or_

from models.schema import (
    SessionLocal, Restaurant, MenuItem as MenuItemModel,
    ItemVariation, Variation, AddonGroup, AddonGroupItem, ItemAddon, ItemVariationAddon
)
from config import rdb, DEBUG_MODE

router = APIRouter()

class AddonItemResponse(BaseModel):
    id: int
    name: str
    display_name: str
    price: float
    tags: List[str]

class AddonGroupResponse(BaseModel):
    id: int
    name: str
    display_name: str
    min_selection: int
    max_selection: int
    addons: List[AddonItemResponse]

class VariationResponse(BaseModel):
    id: int
    name: str
    display_name: str
    price: float
    group_name: str
    tags: List[str] = []
    # Optional variation-specific addon groups. Populated only when a variation
    # overrides the base-item addon groups.
    addon_groups: List[AddonGroupResponse] = []

class VariationGroup(BaseModel):
    group_name: str
    display_name: str
    variations: List[VariationResponse]

class MenuItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    base_price: float
    veg_flag: bool
    image_url: Optional[str]
    cloudflare_image_id: Optional[str]
    cloudflare_video_id: Optional[str]
    category_brief: Optional[str]
    group_category: Optional[str]
    tags: List[str]
    is_bestseller: bool
    variation_groups: List[VariationGroup]
    addon_groups: List[AddonGroupResponse]

class MenuResponse(BaseModel):
    items: List[MenuItem]

@router.get("/restaurants/{restaurant_slug}/menu/item/{item_id}/", response_model=MenuItem, summary="Get single menu item", response_description="Single menu item with variations and addons")
def read_menu_item(
    restaurant_slug: str = Path(..., description="Restaurant slug"),
    item_id: str = Path(..., description="Menu item public ID"),
    session_id: str = Header(..., alias="x-session-id"),
) -> MenuItem:
    """Retrieve a single menu item by its public ID with variations and addons."""
    try:
        with SessionLocal() as db:
            # 1. Look up restaurant by slug
            restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # 2. Look up menu item by public_id and restaurant_id
            menu_item = db.query(MenuItemModel).options(
                joinedload(MenuItemModel.item_variations)
                    .joinedload(ItemVariation.variation)
                    .joinedload(ItemVariation.variation_addons)
                    .joinedload(ItemVariationAddon.addon_group)
                    .joinedload(AddonGroup.addon_items),
                joinedload(MenuItemModel.item_addons).joinedload(ItemAddon.addon_group).joinedload(AddonGroup.addon_items)
            ).filter(
                and_(
                    MenuItemModel.public_id == item_id,
                    MenuItemModel.restaurant_id == restaurant.id,
                    MenuItemModel.is_active == True
                )
            ).first()
            
            if not menu_item:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "menu_item_not_found", "detail": "Menu item not found"}
                )
            
            # 3. Build and return the menu item response
            return _build_menu_item_response(menu_item, restaurant_slug)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )
    

@router.get("/restaurants/{restaurant_slug}/menu/", response_model=MenuResponse, summary="Get menu items", response_description="List of menu items with optional filters and pagination")
def read_menu(
    restaurant_slug: str = Path(..., description="Restaurant slug"),
    session_id: str = Header(..., alias="x-session-id"),
    group_category: Optional[list[str]] = Query(None),
    category_brief: Optional[list[str]] = Query(None),
    is_veg: Optional[bool] = None,
    price_cap: Optional[float] = None,
) -> MenuResponse:
    """Retrieve menu items with optional filters: group_category, category_brief, is_veg, price_cap."""
    try:
        with SessionLocal() as db:
            # 1. Look up restaurant by slug
            restaurant = db.query(Restaurant).filter(Restaurant.slug == restaurant_slug).first()
            if not restaurant:
                raise HTTPException(
                    status_code=404,
                    detail={"success": False, "code": "restaurant_not_found", "detail": "Restaurant not found"}
                )
            
            # 2. Build filters for the query - only include active items
            filter_conditions = [
                MenuItemModel.restaurant_id == restaurant.id,
                MenuItemModel.is_active == True
            ]
            
            if group_category:
                if len(group_category) == 1:
                    filter_conditions.append(MenuItemModel.group_category == group_category[0])
                else:
                    filter_conditions.append(MenuItemModel.group_category.in_(group_category))
                    
            if category_brief:
                if len(category_brief) == 1:
                    filter_conditions.append(MenuItemModel.category_brief == category_brief[0])
                else:
                    filter_conditions.append(MenuItemModel.category_brief.in_(category_brief))
                    
            if is_veg is not None and is_veg:
                filter_conditions.append(MenuItemModel.veg_flag == True)
                
            if price_cap is not None:
                filter_conditions.append(MenuItemModel.price <= price_cap)
            
            # 3. Fetch promoted items first, then the rest (no pagination)
            promoted_query = db.query(MenuItemModel).options(
                # Load variations and their base Variation entity
                joinedload(MenuItemModel.item_variations)
                    .joinedload(ItemVariation.variation),

                # Load variation-specific addon groups and their nested addon items
                joinedload(MenuItemModel.item_variations)
                    .joinedload(ItemVariation.variation_addons)
                    .joinedload(ItemVariationAddon.addon_group)
                    .joinedload(AddonGroup.addon_items),

                # Load base-item addon groups and their items
                joinedload(MenuItemModel.item_addons)
                    .joinedload(ItemAddon.addon_group)
                    .joinedload(AddonGroup.addon_items)
            ).filter(
                and_(MenuItemModel.promote == True, *filter_conditions)
            )
            promoted_items_db = promoted_query.all()

            promoted_items = [
                _build_menu_item_response(item, restaurant_slug, "Recommendations")
                for item in promoted_items_db
            ]

            random.shuffle(promoted_items)

            # Fetch all other items excluding promoted ones
            regular_query = db.query(MenuItemModel).options(
                joinedload(MenuItemModel.item_variations)
                    .joinedload(ItemVariation.variation),

                joinedload(MenuItemModel.item_variations)
                    .joinedload(ItemVariation.variation_addons)
                    .joinedload(ItemVariationAddon.addon_group)
                    .joinedload(AddonGroup.addon_items),

                joinedload(MenuItemModel.item_addons)
                    .joinedload(ItemAddon.addon_group)
                    .joinedload(AddonGroup.addon_items)
            ).filter(
                and_(*filter_conditions)
            ).order_by(MenuItemModel.id)

            regular_items_db = regular_query.all()

            regular_items = [
                _build_menu_item_response(item, restaurant_slug)
                for item in regular_items_db
            ]

            items = promoted_items + regular_items

            return MenuResponse(items=items)
            
    except HTTPException:
        raise
    except Exception as e:
        if DEBUG_MODE:
            raise e
        raise HTTPException(
            status_code=500,
            detail={"success": False, "code": "internal_error", "detail": "Internal server error"}
        )


def _build_menu_item_response(item: MenuItemModel, restaurant_slug: str, override_category: Optional[str] = None) -> MenuItem:
    """Build MenuItem response with variations and addons based on item flags"""
    
    # ------------------------------------------------------------------
    # Build base-item addon groups FIRST (needed for variation fallback)
    # ------------------------------------------------------------------
    base_addon_groups: List[AddonGroupResponse] = []
    if item.itemallowaddon is True:
        for item_addon in item.item_addons:
            if item_addon.is_active and item_addon.addon_group.is_active:
                base_items_tmp = [
                    AddonItemResponse(
                        id=ai.id,
                        name=ai.name,
                        display_name=ai.display_name,
                        price=ai.price,
                        tags=ai.tags or [],
                    )
                    for ai in item_addon.addon_group.addon_items if ai.is_active
                ]
                if base_items_tmp:
                    base_addon_groups.append(
                        AddonGroupResponse(
                            id=item_addon.addon_group.id,
                            name=item_addon.addon_group.name,
                            display_name=item_addon.addon_group.display_name,
                            min_selection=item_addon.min_selection,
                            max_selection=item_addon.max_selection,
                            addons=base_items_tmp,
                        )
                    )

    # Will be used for MenuItem-level field (backwards compatibility)
    addon_groups: List[AddonGroupResponse] = base_addon_groups.copy()

    # ------------------------------------------------------------------
    # Build variations (may override addon groups)
    # ------------------------------------------------------------------
    variation_groups: List[VariationGroup] = []
    if item.itemallowvariation is True:
        # Build variation groups from item variations
        variation_groups_dict = {}
        for item_variation in item.item_variations:
            if item_variation.is_active and item_variation.variation.is_active:
                group_name = item_variation.variation.group_name
                
                if group_name not in variation_groups_dict:
                    variation_groups_dict[group_name] = {
                        "group_name": group_name,
                        "display_name": group_name,
                        "variations": []
                    }
                
                # Determine addon groups for this variation (override logic)
                if item_variation.variation_addons:
                    var_addon_groups: List[AddonGroupResponse] = []
                    for iva in item_variation.variation_addons:
                        if iva.is_active and iva.addon_group.is_active:
                            addons_items_var = [
                                AddonItemResponse(
                                    id=ai.id,
                                    name=ai.name,
                                    display_name=ai.display_name,
                                    price=ai.price,
                                    tags=ai.tags or [],
                                )
                                for ai in iva.addon_group.addon_items if ai.is_active
                            ]
                            if addons_items_var:
                                var_addon_groups.append(
                                    AddonGroupResponse(
                                        id=iva.addon_group.id,
                                        name=iva.addon_group.name,
                                        display_name=iva.addon_group.display_name,
                                        min_selection=iva.min_selection,
                                        max_selection=iva.max_selection,
                                        addons=addons_items_var,
                                    )
                                )
                else:
                    var_addon_groups = []

                variation_groups_dict[group_name]["variations"].append(
                    VariationResponse(
                        id=item_variation.id,
                        name=item_variation.variation.name,
                        display_name=item_variation.variation.display_name,
                        price=item_variation.price,
                        group_name=group_name,
                        tags=[],
                        addon_groups=var_addon_groups,
                    )
                )
        
        variation_groups = [
            VariationGroup(**group_data) 
            for group_data in variation_groups_dict.values()
        ]
    
    return MenuItem(
        id=item.public_id,
        name=item.name,
        description=item.description,
        base_price=item.price,
        veg_flag=item.veg_flag,
        image_url=f"image_data/{restaurant_slug}/{item.image_path}" if item.image_path is not None else None,
        cloudflare_image_id=item.cloudflare_image_id,
        cloudflare_video_id=item.cloudflare_video_id,
        category_brief=override_category or item.category_brief,
        group_category=override_category or item.group_category,
        tags=item.tags or [],
        is_bestseller=item.is_bestseller,
        variation_groups=variation_groups,
        addon_groups=addon_groups
        )
