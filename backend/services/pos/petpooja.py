import asyncio
from pprint import pprint
import httpx
from typing import Dict, List, Optional, Any
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
        self.callback_url = os.path.join(str(BACKEND_URL), "pp_callback", self.restaurant_slug, "/")
        
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
            # pprint(petpooja_order)

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

    def _calculate_taxes(self, amount: float) -> Dict[str, Any]:
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
        total_tax_amount = 0.0
        tax_details = []
        
        for tax in self.tax_config:
            if not tax.get("active", False):
                continue
                
            rate = float(tax.get("tax", 0))
            tax_amount = amount * (rate / 100)
            total_tax_amount += tax_amount
            
            tax_detail = {
                "id": tax.get("taxid", ""),
                "title": tax.get("taxname", ""),
                "type": "P",  # Percentage
                "rate": rate,
                "percentage": f"{rate}",
                "tax_amount": tax_amount,
                "restaurant_liable_amt": tax_amount
            }
            tax_details.append(tax_detail)
        
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
        # Placeholder implementation for future discount logic
        # This can be extended based on specific discount rules like:
        # - Item-based discounts
        # - Cart value based discounts
        # - Time-based discounts
        # - Category-based discounts
        # - Combo offers
        
        total_discount_amount = 0.0
        discount_details = []
        
        for discount in self.discount_config:
            if not discount.get("active", False):
                continue
            
            # Example discount logic (to be implemented based on requirements)
            # if discount.get("type") == "percentage":
            #     if subtotal >= discount.get("minimum_amount", 0):
            #         discount_amount = subtotal * (discount.get("rate", 0) / 100)
            #         total_discount_amount += discount_amount
            #         discount_details.append({
            #             "id": discount.get("id", ""),
            #             "name": discount.get("name", ""),
            #             "type": discount.get("type", ""),
            #             "amount": discount_amount,
            #             "description": discount.get("description", "")
            #         })
            
            pass  # Placeholder for future implementation
        
        return {
            "total_discount_amount": total_discount_amount,
            "discount_details": discount_details
        }

    def _transform_order_to_petpooja(self, order, session, member, table_number, restaurant_slug: str) -> Dict[str, Any]:
        """Transform our order format to PetPooja API format"""
        from datetime import datetime
        
        # Calculate subtotal (already without taxes)
        subtotal = order.total_amount
        
        # Calculate discounts (placeholder for future use)
        discount_calculation = self._calculate_discounts(order.cart_items, subtotal)
        discount_amount = discount_calculation["total_discount_amount"]
        
        # Apply discounts to subtotal
        subtotal_after_discount = subtotal - discount_amount
        
        # Calculate taxes based on configuration
        tax_calculation = self._calculate_taxes(subtotal_after_discount)
        tax_amount = tax_calculation["total_tax_amount"]
        tax_details = tax_calculation["tax_details"]
        
        # Calculate final total
        total_with_taxes = subtotal_after_discount + tax_amount
        
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
            if cart_item.selected_addons:
                for addon in cart_item.selected_addons:
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
            
            # Calculate item-level taxes using configuration
            item_tax_calculation = self._calculate_taxes(final_price)
            item_tax_details = item_tax_calculation["tax_details"]

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
                "final_price": f"{final_price:.2f}",
                "quantity": str(cart_item.qty),
                "gst_liability": "restaurant",
                "item_discount": "",
                "variation_id": cart_item.selected_item_variation.external_id if cart_item.selected_item_variation else "",
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
        
        # Build order-level tax details for PetPooja format
        order_tax_details = []
        for tax_detail in tax_details:
            order_tax_details.append({
                "id": tax_detail["id"],
                "title": tax_detail["title"],
                "type": tax_detail["type"],
                "price": tax_detail["percentage"],
                "tax": f"{tax_detail['tax_amount']:.2f}",
                "restaurant_liable_amt": f"{tax_detail['restaurant_liable_amt']:.2f}"
            })
        
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
                            "tax_total": f"{tax_amount:.2f}",
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
                            "discount_type": ""
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