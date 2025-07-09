import asyncio
from pprint import pprint
import httpx
from typing import Dict, List, Optional, Any, Set
from openai import NoneType
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import uuid4
import sys, os
from pathlib import Path

# Add parent directory to path to import config and models
sys.path.append(str(Path(__file__).parent.parent.parent))
from config import logger, BACKEND_URL
from .interface import POSInterface
from models.schema import (
    POSSystem, Order, CartItem, MenuItem, Variation, AddonGroup, 
    AddonGroupItem, ItemVariation, ItemAddon
)


class PetPoojaIntegration(POSInterface):
    """PetPooja POS system integration following new simplified architecture"""
    
    def __init__(self, pos_system: POSSystem):
        self.pos_system = pos_system
        self.config = pos_system.config
        self.restaurant_id = self.config.get("restaurant_id")
        self.app_key = self.config.get("app_key")
        self.app_secret = self.config.get("app_secret")
        self.access_token = self.config.get("app_token")
        # self.base_url = self.config.get("base_url", "https://api.petpooja.com")
        self.save_order_url = self.config.get("apis", {}).get("saveorder")
        self.fetch_menu_url = self.config.get("apis", {}).get("fetchmenu")
        self.restaurant_slug = pos_system.restaurant.slug  # Will be set by the calling code
        self.callback_url = os.path.join(str(BACKEND_URL), "pp_callback", self.restaurant_slug) + "/"
        
        # Initialize tax and discount configurations
        self.tax_config = self.config.get("taxes", [])
        self.discount_config = self.config.get("discounts", [])
        
        logger.info(f"PetPooja integration initialized with {len(self.tax_config)} tax rules and {len(self.discount_config)} discount rules")

    async def sync_menu(self, db: Session) -> Dict[str, Any]:
        """Sync menu from PetPooja API following the new architecture"""
        try:
            # Fetch menu data from PetPooja
            menu_data = await self._fetch_menu_data()
            
            result = {
                "success": True,
                "variations_synced": 0,
                "addon_groups_synced": 0,
                "addon_items_synced": 0,
                "items_synced": 0,
                "item_variations_synced": 0,
                "item_addons_synced": 0,
                "errors": []
            }
            
            # Step 1: Create global variations first
            result["variations_synced"] = await self._sync_global_variations(db, menu_data.get("variations", []))
            

            
            # Step 2: Create items and their relationships
            attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_data.get("attributes", [])}
            categories_map = {cat["categoryid"]: cat["categoryname"] for cat in menu_data.get("categories", [])}

            # Step 3: Create global addon groups and items
            addon_groups_data = menu_data.get("addongroups", [])
            result["addon_groups_synced"], result["addon_items_synced"] = await self._sync_global_addon_groups(db, addon_groups_data, attributes_map)


            items_result = await self._sync_items_with_relationships(db, menu_data, attributes_map, categories_map)
            result["items_synced"] = items_result["items_synced"]
            result["item_variations_synced"] = items_result["item_variations_synced"]
            result["item_addons_synced"] = items_result["item_addons_synced"]
            
            db.commit()
            return result
            
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e),
                "variations_synced": 0,
                "addon_groups_synced": 0,
                "addon_items_synced": 0,
                "items_synced": 0,
                "item_variations_synced": 0,
                "item_addons_synced": 0
            }

    async def _fetch_menu_data(self) -> Dict[str, Any]:
        """Fetch menu data from PetPooja API"""
        headers = {
            "Content-Type": "application/json",
            "app-key": self.app_key,
            "app-secret": self.app_secret,
            "access-token": self.access_token
        }
        
        body = {"restID": self.restaurant_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.fetch_menu_url,
                headers=headers,
                json=body,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def _sync_global_variations(self, db: Session, variations_data: List[Dict]) -> int:
        """Create global variation entities"""
        synced_count = 0
        
        for var_data in variations_data:
            # Check if variation exists
            existing_variation = db.execute(
                select(Variation).where(
                    Variation.pos_system_id == self.pos_system.id,
                    Variation.external_variation_id == var_data["variationid"]
                )
            ).scalar_one_or_none()
            
            if existing_variation:
                # Update existing variation
                setattr(existing_variation, 'name', var_data["name"])
                setattr(existing_variation, 'display_name', var_data["name"])
                setattr(existing_variation, 'group_name', var_data["groupname"])
                setattr(existing_variation, 'is_active', var_data["status"] == "1")
                setattr(existing_variation, 'external_data', var_data)
            else:
                # Create new variation
                variation = Variation(
                    name=var_data["name"],
                    display_name=var_data["name"],
                    group_name=var_data["groupname"],
                    is_active=var_data["status"] == "1",
                    external_variation_id=var_data["variationid"],
                    external_data=var_data,
                    pos_system_id=self.pos_system.id
                )
                db.add(variation)
            
            synced_count += 1
        
        return synced_count

    async def _sync_global_addon_groups(self, db: Session, addon_groups_data: List[Dict], attributes_map: Dict) -> tuple[int, int]:
        """Create global addon group entities and their items"""
        groups_synced = 0
        items_synced = 0
        
        for group_data in addon_groups_data:
            # Check if addon group exists
            existing_group = db.execute(
                select(AddonGroup).where(
                    AddonGroup.pos_system_id == self.pos_system.id,
                    AddonGroup.external_group_id == group_data["addongroupid"]
                )
            ).scalar_one_or_none()
            
            if existing_group:
                # Update existing group
                setattr(existing_group, 'name', group_data["addongroup_name"])
                setattr(existing_group, 'display_name', group_data["addongroup_name"])
                setattr(existing_group, 'is_active', group_data["active"] == "1")
                setattr(existing_group, 'priority', int(group_data.get("addongroup_rank", 0)))
                setattr(existing_group, 'external_data', group_data)
                addon_group = existing_group
            else:
                # Create new addon group
                addon_group = AddonGroup(
                    name=group_data["addongroup_name"],
                    display_name=group_data["addongroup_name"],
                    is_active=group_data["active"] == "1",
                    priority=int(group_data.get("addongroup_rank", 0)),
                    external_group_id=group_data["addongroupid"],
                    external_data=group_data,
                    pos_system_id=self.pos_system.id
                )
                db.add(addon_group)
            
            groups_synced += 1
            
            # Sync addon group items
            for item_data in group_data.get("addongroupitems", []):
                # Check if addon item exists
                existing_item = db.execute(
                    select(AddonGroupItem).where(
                        AddonGroupItem.addon_group_id == addon_group.id,
                        AddonGroupItem.external_addon_id == item_data["addonitemid"]
                    )
                ).scalar_one_or_none()
                
                tags = self._get_item_tags_from_attributes(attributes_map, item_data.get("attributes", ""))
                
                if existing_item:
                    # Update existing item
                    setattr(existing_item, 'name', item_data["addonitem_name"])
                    setattr(existing_item, 'display_name', item_data["addonitem_name"])
                    setattr(existing_item, 'price', float(item_data["addonitem_price"]))
                    setattr(existing_item, 'is_active', item_data["active"] == "1")
                    setattr(existing_item, 'priority', int(item_data.get("addonitem_rank", 0)))
                    setattr(existing_item, 'tags', tags)
                    setattr(existing_item, 'external_data', item_data)
                else:
                    # Create new addon item
                    addon_item = AddonGroupItem(
                        addon_group_id=addon_group.id,
                        name=item_data["addonitem_name"],
                        display_name=item_data["addonitem_name"],
                        price=float(item_data["addonitem_price"]),
                        is_active=item_data["active"] == "1",
                        priority=int(item_data.get("addonitem_rank", 0)),
                        tags=tags,
                        external_addon_id=item_data["addonitemid"],
                        external_data=item_data
                    )
                    db.add(addon_item)
                
                items_synced += 1
        
        return groups_synced, items_synced

    async def _sync_items_with_relationships(self, db: Session, menu_data: Dict, attributes_map: Dict, categories_map: Dict) -> Dict[str, int]:
        """Sync menu items and create their relationships"""
        items_data = menu_data.get("items", [])
        items_synced = 0
        item_variations_synced = 0
        item_addons_synced = 0
        
        for item_data in items_data:
            # Create or update the main menu item
            menu_item = await self._sync_menu_item(db, item_data, attributes_map, categories_map)
            items_synced += 1
            
            # Create item-variation relationships if allowed and present
            if getattr(menu_item, 'itemallowvariation') and item_data.get("variation"):
                item_variations_synced += await self._sync_item_variations(db, item_data, menu_item)
            
            # Create item-addon relationships if allowed and present
            if getattr(menu_item, 'itemallowaddon') and item_data.get("addon"):
                item_addons_synced += await self._sync_item_addons(db, item_data, menu_item)
        
        return {
            "items_synced": items_synced,
            "item_variations_synced": item_variations_synced,
            "item_addons_synced": item_addons_synced
        }

    async def _sync_menu_item(self, db: Session, item_data: Dict, attributes_map: Dict, categories_map: Dict) -> MenuItem:
        """Create or update a menu item"""
        # Check if item exists
        existing_item = db.execute(
            select(MenuItem).where(
                MenuItem.restaurant_id == self.pos_system.restaurant_id,
                MenuItem.external_id == item_data["itemid"]
            )
        ).scalar_one_or_none()
        
        # Get item tags
        tags = item_data.get("item_tags", [])
        if item_data.get("item_attributeid"):
            attr_name = attributes_map.get(item_data["item_attributeid"])
            if attr_name:
                tags.append(attr_name)
        
        # Get category name
        category_name = categories_map.get(item_data["item_categoryid"], "")
        
        if existing_item:
            # Update existing item
            setattr(existing_item, 'name', item_data["itemname"])
            setattr(existing_item, 'category_brief', category_name)
            setattr(existing_item, 'group_category', category_name)
            setattr(existing_item, 'description', item_data.get("itemdescription", ""))
            setattr(existing_item, 'price', float(item_data["price"]))
            setattr(existing_item, 'image_path', item_data.get("item_image_url", ""))
            setattr(existing_item, 'veg_flag', item_data.get("item_attributeid") == "1")
            setattr(existing_item, 'is_active', item_data["active"] == "1")
            setattr(existing_item, 'tags', tags)
            setattr(existing_item, 'priority', int(item_data.get("itemrank", 0)))
            setattr(existing_item, 'external_data', item_data)
            setattr(existing_item, 'itemallowvariation', item_data.get("itemallowvariation", "0") == "1")
            setattr(existing_item, 'itemallowaddon', item_data.get("itemallowaddon", "0") == "1")
            return existing_item
        else:
            # Create new item
            menu_item = MenuItem(
                public_id=str(uuid4())[0:8],
                restaurant_id=self.pos_system.restaurant_id,
                name=item_data["itemname"],
                category_brief=category_name,
                group_category=category_name,
                description=item_data.get("itemdescription", ""),
                price=float(item_data["price"]),
                image_path=item_data.get("item_image_url", ""),
                veg_flag=item_data.get("item_attributeid") == "1",
                is_active=item_data["active"] == "1",
                tags=tags,
                priority=int(item_data.get("itemrank", 0)),
                external_id=item_data["itemid"],
                external_data=item_data,
                itemallowvariation=item_data.get("itemallowvariation", "0") == "1",
                itemallowaddon=item_data.get("itemallowaddon", "0") == "1",
                pos_system_id=self.pos_system.id
            )
            db.add(menu_item)
            return menu_item

    async def _sync_item_variations(self, db: Session, item_data: Dict, menu_item: MenuItem) -> int:
        """Create item-variation relationships"""
        synced_count = 0
        
        for var_data in item_data["variation"]:
            # Find the global variation by external_variation_id
            global_variation = db.execute(
                select(Variation).where(
                    Variation.pos_system_id == self.pos_system.id,
                    Variation.external_variation_id == var_data["variationid"]
                )
            ).scalar_one_or_none()
            
            if not global_variation:
                print(f"Warning: Global variation {var_data['variationid']} not found for item {menu_item.name}")
                continue
            
            # Check if item-variation relationship exists
            existing_item_variation = db.execute(
                select(ItemVariation).where(
                    ItemVariation.menu_item_id == menu_item.id,
                    ItemVariation.variation_id == global_variation.id
                )
            ).scalar_one_or_none()
            
            if existing_item_variation:
                # Update existing relationship
                setattr(existing_item_variation, 'price', float(var_data["price"]))
                setattr(existing_item_variation, 'is_active', var_data["active"] == "1")
                setattr(existing_item_variation, 'priority', int(var_data.get("variationrank", 0)))
                setattr(existing_item_variation, 'external_id', var_data["id"])  # variation.id for orders
                setattr(existing_item_variation, 'external_data', var_data)
            else:
                # Create new item-variation relationship
                item_variation = ItemVariation(
                    menu_item_id=menu_item.id,
                    variation_id=global_variation.id,
                    price=float(var_data["price"]),
                    is_active=var_data["active"] == "1",
                    priority=int(var_data.get("variationrank", 0)),
                    external_id=var_data["id"],  # variation.id for orders
                    external_data=var_data
                )
                db.add(item_variation)
            
            synced_count += 1
        
        return synced_count

    async def _sync_item_addons(self, db: Session, item_data: Dict, menu_item: MenuItem) -> int:
        """Create item-addon relationships"""
        synced_count = 0
        
        for addon_ref in item_data["addon"]:
            addon_group_id = addon_ref["addon_group_id"]
            
            # Find the global addon group by external_group_id
            global_addon_group = db.execute(
                select(AddonGroup).where(
                    AddonGroup.pos_system_id == self.pos_system.id,
                    AddonGroup.external_group_id == addon_group_id
                )
            ).scalar_one_or_none()
            
            if not global_addon_group:
                print(f"Warning: Global addon group {addon_group_id} not found for item {menu_item.name}")
                continue
            
            # Check if item-addon relationship exists
            existing_item_addon = db.execute(
                select(ItemAddon).where(
                    ItemAddon.menu_item_id == menu_item.id,
                    ItemAddon.addon_group_id == global_addon_group.id
                )
            ).scalar_one_or_none()
            
            if existing_item_addon:
                # Update existing relationship
                setattr(existing_item_addon, 'min_selection', int(addon_ref.get("addon_item_selection_min", 0)))
                setattr(existing_item_addon, 'max_selection', int(addon_ref.get("addon_item_selection_max", 999)))
                setattr(existing_item_addon, 'is_active', True)
            else:
                # Create new item-addon relationship
                item_addon = ItemAddon(
                    menu_item_id=menu_item.id,
                    addon_group_id=global_addon_group.id,
                    min_selection=int(addon_ref.get("addon_item_selection_min", 0)),
                    max_selection=int(addon_ref.get("addon_item_selection_max", 999)),
                    is_active=True,
                    priority=0
                )
                db.add(item_addon)
            
            synced_count += 1
        
        return synced_count

    def _get_item_tags_from_attributes(self, attributes_map: Dict, attributes_str: str) -> List[str]:
        """Convert PetPooja attributes to tags"""
        if not attributes_str:
            return []
        
        tags = []
        for attr_id in attributes_str.split(","):
            attr_id = attr_id.strip()
            if attr_id in attributes_map:
                tags.append(attributes_map[attr_id])
        
        return tags

    async def place_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Place an order with PetPooja"""
        try:
            # Extract data
            order = order_data["order"]
            session = order_data["session"] 
            member = order_data["member"]
            table_number = order_data["table_number"]
            
            # Transform to PetPooja format
            petpooja_order = self._transform_order_to_petpooja(order, session, member, table_number, self.restaurant_slug)
            
            # Log the payload for debugging
            logger.debug(f"PetPooja order payload for order {order.public_id}: {petpooja_order}")
            
            # Prepare API call
            headers = {
                "Content-Type": "application/json",
                "app-key": self.app_key,
                "app-secret": self.app_secret, 
                "access-token": self.access_token
            }
            
            if not self.save_order_url:
                raise Exception("Order endpoint not configured in POS system config")
            
            logger.debug(f"save_order_url: {self.save_order_url}")
            logger.debug(f"petpooja_order: {petpooja_order}")
            logger.debug(f"headers: {headers}")
            pprint(petpooja_order)

            # Make API call to PetPooja
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.save_order_url,
                    headers=headers,
                    json=petpooja_order,
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()

                
                logger.info(f"PetPooja response for order {order.public_id}: {result}")
                
                # Check if PetPooja considers this successful
                if result.get("success") == "1" or result.get("status") == "success":
                    return {
                        "success": True,
                        "pos_order_id": result.get("orderID", order.public_id),
                        "api_response": result
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Unknown PetPooja error"),
                        "pos_order_id": None,
                        "api_response": result
                    }
                
        except httpx.HTTPStatusError as e:
            logger.error(f"PetPooja HTTP error for order {order.public_id}: {e.response.status_code} - {e.response.text}")
            return {
                "success": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
                "pos_order_id": None
            }
        except Exception as e:
            logger.error(f"PetPooja order submission failed for order {order.public_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "pos_order_id": None
            }

    def _calculate_taxes(self, amount: float, tax_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Calculate taxes based on configuration
        
        Args:
            amount (float): Base amount to calculate taxes on
            
        Returns:
            Dict containing tax calculations with structure:
            {
                "total_tax_amount": float,
                "tax_details": [
                    {
                        "id": str,
                        "title": str,
                        "type": str,
                        "rate": float,
                        "percentage": str,
                        "tax_amount": float,
                        "restaurant_liable_amt": float
                    }
                ]
            }
        """
        # Helper containers
        total_tax_amount: float = 0.0
        tax_details: List[Dict[str, Any]] = []

        # Build a quick-lookup set for the tax ids that are applicable for this calculation
        applicable_ids: Optional[Set[str]] = None
        if tax_ids is not None:
            applicable_ids = {str(tid) for tid in tax_ids}
            # If an explicit but empty list is provided, no taxes apply
            if not applicable_ids:
                print(f"No applicable tax ids found")
                return {"total_tax_amount": 0.0, "tax_details": []}

        for tax in self.tax_config:
            # Consider only active percentage type (taxtype == "1") taxes
            if not tax.get("active"):
                continue
            if str(tax.get("taxtype", "1")) != "1":
                continue

            tax_id = str(tax.get("taxid", ""))
            if applicable_ids is not None and tax_id not in applicable_ids:
                continue

            rate = float(tax.get("tax", 0) or 0)
            tax_amount = amount * (rate / 100)
            total_tax_amount += tax_amount

            tax_details.append({
                "id": tax_id,
                "title": tax.get("taxname", ""),
                "type": "P",
                "rate": rate,
                "percentage": f"{rate}",
                "tax_amount": tax_amount,
                "restaurant_liable_amt": tax_amount,
            })
        
        return {
            "total_tax_amount": total_tax_amount,
            "tax_details": tax_details
        }
    
    def _calculate_discounts(self, cart_items: List, subtotal: float) -> Dict[str, Any]:
        """Calculate discounts based on configuration and cart items
        
        Args:
            cart_items (List): List of cart items
            subtotal (float): Subtotal amount before discounts
            
        Returns:
            Dict containing discount calculations with structure:
            {
                "total_discount_amount": float,
                "discount_details": [
                    {
                        "id": str,
                        "name": str,
                        "type": str,  # "percentage", "fixed", "item_based"
                        "amount": float,
                        "description": str
                    }
                ]
            }
        """
        # START NEW DISCOUNT LOGIC IMPLEMENTATION
        # If there is no discount configuration, or the first one is inactive, return zeros
        if not self.discount_config:
            return {"total_discount_amount": 0.0, "discount_details": []}

        discount_cfg = self.discount_config[0]  # only the first discount considered
        if str(discount_cfg.get("active", "0")) != "1":
            return {"total_discount_amount": 0.0, "discount_details": []}

        # Helper conversions
        def _to_float(val: Any, default: float = 0.0) -> float:
            try:
                if val is None or val == "":
                    return default
                return float(val)
            except (ValueError, TypeError):
                return default

        discount_type_raw = str(discount_cfg.get("discounttype"))
        if discount_type_raw == "1":
            is_percentage = True
        elif discount_type_raw == "2":
            is_percentage = False
        else:
            raise ValueError(f"Unsupported discount type: {discount_type_raw}")

        discount_value = _to_float(discount_cfg.get("discount"))  # percentage OR flat value

        # Scope of items – if empty applies to all
        item_scope: Set[str] = set()
        scope_raw = (discount_cfg.get("discountcategoryitemids") or "").strip()
        if scope_raw:
            item_scope = {itm_id.strip() for itm_id in scope_raw.split(",") if itm_id.strip()}

        # Min / Max amount applicability criteria
        min_amount_req = _to_float(discount_cfg.get("discountminamount"))
        max_amount_req = _to_float(discount_cfg.get("discountmaxamount"), default=0.0)
        if max_amount_req == 0.0:
            max_amount_req = None  # treat 0 / empty as not provided

        # Global discount cap across the whole cart
        global_cap_raw = _to_float(discount_cfg.get("discountmaxlimit"))
        global_cap: Optional[float] = None if global_cap_raw == 0.0 else global_cap_raw
        remaining_cap = global_cap

        total_discount_amount = 0.0
        discount_details: List[Dict[str, Any]] = []

        # Helper to compute addon total for a cart item
        def _addon_total(ci) -> float:
            total = 0.0
            selected_addon_rows = ci.selected_variation_addons if ci.selected_variation_addons else ci.selected_addons
            if selected_addon_rows:
                for ad in selected_addon_rows:
                    total += ad.addon_item.price * ad.quantity
            return total

        # Iterate cart items sequentially – order matters for cap enforcement
        for cart_item in cart_items:
            # Compute base amount (price + addons) * qty
            base_price = cart_item.menu_item.price
            if cart_item.selected_item_variation:
                base_price = cart_item.selected_item_variation.price
            item_total = (base_price + _addon_total(cart_item)) * cart_item.qty

            # Applicability checks
            if item_scope and str(cart_item.menu_item.external_id) not in item_scope:
                continue
            if min_amount_req and item_total < min_amount_req:
                continue
            if max_amount_req is not None and item_total > max_amount_req:
                continue
            if remaining_cap is not None and remaining_cap <= 0:
                break  # cap exhausted

            # Draft discount amount
            raw_discount = (item_total * discount_value / 100.0) if is_percentage else discount_value
            discount_amt = min(raw_discount, item_total)  # cannot exceed line total
            if remaining_cap is not None:
                discount_amt = min(discount_amt, remaining_cap)
            if discount_amt <= 0:
                continue

            # Record detail
            discount_details.append({
                "cart_item_id": cart_item.id,
                "discount_id": str(discount_cfg.get("discountid", "")),
                "name": discount_cfg.get("discountname", ""),
                "type": "percentage" if is_percentage else "flat",
                "base_amount": item_total,
                "discount_amount": discount_amt,
                "final_amount": item_total - discount_amt,
                "description": discount_cfg.get("description", "")
            })

            total_discount_amount += discount_amt
            if remaining_cap is not None:
                remaining_cap -= discount_amt

        return {
            "total_discount_amount": total_discount_amount,
            "discount_details": discount_details,
            "discount_type": "P" if is_percentage else "F"
        }

    def _transform_order_to_petpooja(self, order, session, member, table_number, restaurant_slug: str) -> Dict[str, Any]:
        """Transform our order format to PetPooja API format"""
        from datetime import datetime
        
        # Calculate subtotal (already without taxes)
        subtotal = order.total_amount
        
        # Calculate discounts (placeholder for future use)
        discount_calculation = self._calculate_discounts(order.cart_items, subtotal)
        # APPLY PER-ITEM DISCOUNT IF ANY
        item_discount_map = {d["cart_item_id"]: d["discount_amount"] for d in discount_calculation["discount_details"]}
        discount_amount = discount_calculation["total_discount_amount"]
        
        # Apply discounts to subtotal
        subtotal_after_discount = subtotal - discount_amount
        
        # Initialise container to accumulate tax across all items
        order_tax_totals: Dict[str, Dict[str, Any]] = {}
        
        # Transform cart items to PetPooja order items
        order_items = []
        for cart_item in order.cart_items:
            # Calculate base price (menu item or variation price)
            base_price = cart_item.menu_item.price
            if cart_item.selected_item_variation:
                base_price = cart_item.selected_item_variation.price
            
            # Calculate addon total
            addon_total = 0
            addon_items = []
            # Prefer variation-specific addons if they exist (variation override)
            selected_addon_rows = (
                cart_item.selected_variation_addons
                if cart_item.selected_variation_addons
                else cart_item.selected_addons
            )

            if selected_addon_rows:
                for addon in selected_addon_rows:
                    addon_price = addon.addon_item.price * addon.quantity
                    addon_total += addon_price
                    addon_items.append({
                        "id": addon.addon_item.external_addon_id,
                        "name": addon.addon_item.name,
                        "price": f"{addon.addon_item.price:.2f}",
                        "quantity": str(addon.quantity)
                    })
            
            # Calculate final price (base price + addons)
            unit_price_with_addons = base_price + addon_total 
            final_price = unit_price_with_addons * cart_item.qty
            
            # APPLY PER-ITEM DISCOUNT IF ANY
            discount_for_item = item_discount_map.get(cart_item.id, 0.0)
            discounted_total = final_price - discount_for_item
            
            # Determine applicable tax IDs for this item
            item_tax_ids_str = ""
            if cart_item.menu_item.external_data and isinstance(cart_item.menu_item.external_data, dict):
                item_tax_ids_str = cart_item.menu_item.external_data.get("item_tax", "")
            item_tax_ids = [tid.strip() for tid in item_tax_ids_str.split(",") if tid.strip()]

            # Calculate item-level taxes using configuration. If no specific IDs, pass None to apply all taxes.
            applicable_tax_ids = item_tax_ids if item_tax_ids else None
            print(f"applicable_tax_ids: {applicable_tax_ids}")
            item_tax_calculation = self._calculate_taxes(discounted_total, applicable_tax_ids)
            item_tax_details = item_tax_calculation["tax_details"]

            # Aggregate taxes at order level
            for tax_detail in item_tax_details:
                t_id = tax_detail["id"]
                if t_id not in order_tax_totals:
                    order_tax_totals[t_id] = tax_detail.copy()
                else:
                    order_tax_totals[t_id]["tax_amount"] += tax_detail["tax_amount"]
                    order_tax_totals[t_id]["restaurant_liable_amt"] += tax_detail["restaurant_liable_amt"]

            item_id = cart_item.selected_item_variation.external_id if cart_item.selected_item_variation else cart_item.menu_item.external_id

            # Build item tax array for PetPooja format
            item_tax_array = []
            for tax_detail in item_tax_details:
                item_tax_array.append({
                    "id": tax_detail["id"],
                    "name": tax_detail["title"],
                    "price": tax_detail["percentage"],
                    "amount": f"{tax_detail['tax_amount']:.2f}"
                })

            item_data = {
                "id": item_id,
                "name": cart_item.menu_item.name,
                "price": f"{unit_price_with_addons:.2f}",
                "final_price": f"{discounted_total:.2f}",
                "quantity": str(cart_item.qty),
                "gst_liability": "restaurant",
                "item_discount": f"{discount_for_item:.2f}" if discount_for_item else "",
                "variation_id": cart_item.selected_item_variation.variation.external_variation_id if cart_item.selected_item_variation else "",
                "variation_name": cart_item.selected_item_variation.variation.name if cart_item.selected_item_variation else "",
                "item_tax": item_tax_array,
                "AddonItem": {
                    "details": addon_items
                }
            }
            
            order_items.append(item_data)
        
        # Current date/time for order
        now_dt = datetime.utcnow()
        now = now_dt.isoformat() + "Z"
        order_date = now_dt.strftime("%Y-%m-%d")
        order_time = now_dt.strftime("%H:%M:%S")
        created_on = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        
        # Build consolidated order-level tax details
        order_tax_details: List[Dict[str, Any]] = []
        for tax_detail in order_tax_totals.values():
            order_tax_details.append({
                "id": tax_detail["id"],
                "title": tax_detail["title"],
                "type": tax_detail["type"],
                "price": tax_detail["percentage"],
                "tax": f"{tax_detail['tax_amount']:.2f}",
                "restaurant_liable_amt": f"{tax_detail['restaurant_liable_amt']:.2f}",
            })

        # Final totals
        tax_amount_total = sum(t["tax_amount"] for t in order_tax_totals.values())
        total_with_taxes = subtotal_after_discount + tax_amount_total
        
        # Build PetPooja order structure
        petpooja_order = {
            "app_key": self.app_key,
            "app_secret": self.app_secret,
            "access_token": self.access_token,
            "orderinfo": {
                "OrderInfo": {
                    "Restaurant": {
                        "details": {
                            "res_name": "AglioAI - DineIn",
                            "restID": self.restaurant_id,
                        }
                    },
                    "Customer": {
                        "details": {
                            "name": member.nickname,
                            "email": "",
                            "phone": ""
                        }
                    },
                    "Order": {
                        "details": {
                            "orderID": order.public_id,
                            "preorder_date": order_date,
                            "preorder_time": order_time,
                            "advanced_order": "N",
                            "order_type": "D",  # Dine-in
                            "total": f"{total_with_taxes:.2f}",
                            "tax_total": f"{tax_amount_total:.2f}",
                            "description": "",  # Special instructions (optional)
                            "created_on": created_on,
                            "payment_type": "COD",  # Cash on Delivery
                            "enable_delivery": "1",  # Restaurant delivery
                            "table_no": str(table_number),
                            "callback_url": self.callback_url,  # PetPooja status callback endpoint
                            "service_charge": "0",
                            "delivery_charges": "0", 
                            "packing_charges": "0",
                            "discount_total": f"{discount_amount:.2f}",
                            "discount_type": discount_calculation["discount_type"]
                        }
                    },
                    "OrderItem": {
                        "details": order_items
                    },
                    "Tax": {
                        "details": order_tax_details
                    }
                }
            },
            "device_type": "Web"
        }
        
        return petpooja_order

    async def get_order_status(self, external_order_id: str) -> Dict[str, Any]:
        """Get order status from PetPooja"""
        # Implementation for getting order status
        return {"success": False, "error": "Not implemented"}
    
    async def cancel_order(self, external_order_id: str) -> Dict[str, Any]:
        """Cancel order in PetPooja"""
        # Implementation for canceling order
        return {"success": False, "error": "Not implemented"}
    
    def fetch_menu(self) -> Dict:
        """Fetch menu from PetPooja POS system
        
        Returns:
            Dict: Raw menu data from PetPooja
        """
        # This is typically done during onboarding, not real-time
        # Return empty dict for now as menu sync is handled separately
        return {"success": True, "message": "Menu fetch handled during onboarding"}
    
    def sync_menu_to_internal(self, pos_menu: Dict) -> None:
        """Transform and sync PetPooja menu to internal structure
        
        Args:
            pos_menu (Dict): Raw menu data from PetPooja
        """
        # This is handled by the onboarding scripts
        # Menu sync is done via the onboarding process, not real-time
        logger.info("Menu sync handled during restaurant onboarding process")
        pass
    
    def transform_cart_for_pos(self, cart_items: List[CartItem]) -> Dict:
        """Transform internal cart to PetPooja-specific format
        
        Args:
            cart_items (List[CartItem]): Internal cart items with variations/addons
            
        Returns:
            Dict: PetPooja-formatted order data
        """
        # This functionality is handled within place_order method
        # via _transform_order_to_petpooja method
        return {"success": True, "message": "Cart transformation handled in place_order"} 