#!/usr/bin/env python3
"""
PetPooja Dine-In Integration for KOT (Kitchen Order Token) operations.

This integration handles dine-in specific KOT operations which are simpler than
full order processing - focusing on kitchen notification rather than payment processing.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

sys.path.append(str(Path(__file__).parent.parent.parent))
from config import BACKEND_URL
from .interface import POSInterface


class PetPoojaDiningIntegration(POSInterface):
    """PetPooja Dine-In POS system integration for KOT operations"""
    
    def __init__(self, pos_system):
        """Initialize PetPooja Dine-In integration
        
        Args:
            pos_system: POSSystem instance with dine-in configuration
        """
        self.pos_system = pos_system
        self.config = pos_system.config
        self.restaurant_id = self.config.get("restID")
        self.app_key = self.config.get("app-key") or self.config.get("app_key")
        self.app_secret = self.config.get("app-secret") or self.config.get("app_secret")
        self.access_token = self.config.get("access-token") or self.config.get("app_token")
        
        # Get KOT-specific endpoint
        self.save_kot_url = self.config.get("apis", {}).get("save_kot")
        
        # Build callback URL for KOT status updates
        restaurant_slug = pos_system.restaurant.slug
        self.callback_url = os.path.join(str(BACKEND_URL), "pp_callback", restaurant_slug) + "/"
        
        logger.info(f"PetPooja Dine-In integration initialized for restaurant {self.restaurant_id}")

    async def place_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Place a KOT (Kitchen Order Token) with PetPooja Dine-In
        
        Args:
            order_data: Dictionary containing order, session, member, and table_number
            
        Returns:
            Dict with success status, KOT ID, and API response
        """
        try:
            # Extract data
            order = order_data["order"]
            session = order_data["session"] 
            member = order_data["member"]
            table_number = order_data["table_number"]
            
            # Transform to PetPooja KOT format
            kot_payload = self._transform_order_to_kot(order, session, member, table_number)
            
            # Log the payload for debugging
            logger.debug(f"PetPooja KOT payload for order {order.public_id}: {kot_payload}")
            
            # Prepare API call
            headers = {
                "Content-Type": "application/json",
                "app-key": self.app_key,
                "app-secret": self.app_secret, 
                "access-token": self.access_token
            }
            
            if not self.save_kot_url:
                raise Exception("KOT endpoint not configured in POS system config")
            
            logger.debug(f"save_kot_url: {self.save_kot_url}")
            logger.debug(f"headers: {headers}")

            # Make API call to PetPooja
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.save_kot_url,
                    headers=headers,
                    json=kot_payload,
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()

                logger.info(f"PetPooja KOT response for order {order.public_id}: {result}")
                
                # Check if PetPooja considers this successful
                if result.get("success") == "1" or result.get("status") == "success":
                    return {
                        "success": True,
                        "pos_order_id": result.get("kotID", order.public_id),
                        "api_response": result
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Unknown PetPooja KOT error"),
                        "pos_order_id": None,
                        "api_response": result
                    }
                
        except httpx.HTTPStatusError as e:
            logger.error(f"PetPooja KOT HTTP error for order {order.public_id}: {e.response.status_code} - {e.response.text}")
            return {
                "success": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
                "pos_order_id": None
            }
        except Exception as e:
            logger.error(f"PetPooja KOT submission failed for order {order.public_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "pos_order_id": None
            }

    def _transform_order_to_kot(self, order, session, member, table_number) -> Dict[str, Any]:
        """Transform our order format to PetPooja KOT format
        
        Args:
            order: Order instance
            session: Session instance  
            member: Member instance
            table_number: Table number for dine-in
            
        Returns:
            Dict: PetPooja KOT payload
        """
        # Get current timestamp
        now = datetime.utcnow()
        created_on = now.strftime("%Y-%m-%d %H:%M:%S")
        
        # Get table number - prefer external table ID if available
        table_no = self._get_table_number(session, table_number)
        
        # Transform cart items to KOT items
        kot_items = self._build_kot_items(order.cart_items)
        
        # Build KOT payload
        kot_payload = {
            "app_key": self.app_key,
            "app_secret": self.app_secret,
            "access_token": self.access_token,
            "restID": self.restaurant_id,
            "kotinfo": {
                "Restaurant": {
                    "restID": self.restaurant_id
                },
                "Customer": {
                    "name": member.nickname or "",
                    "mobile": "",
                    "address": ""
                },
                "Kot": {
                    "uniqueID": order.public_id,
                    "order_type": "D",  # D for Dine In
                    "table_no": table_no,
                    "no_of_persons": "",
                    "created_on": created_on,
                    "callback_url": self.callback_url
                },
                "KotItem": kot_items
            }
        }
        
        return kot_payload

    def _get_table_number(self, session, fallback_table_number) -> str:
        """Get table number for KOT
        
        Args:
            session: Session instance with table info
            fallback_table_number: Fallback table number
            
        Returns:
            str: Table number for PetPooja
        """
        # Try to get from external table data first
        if session.table.external_table_id:
            return str(session.table.external_table_id)
        
        # Try to get from external_data
        if session.table.external_data and isinstance(session.table.external_data, dict):
            table_no = session.table.external_data.get("table_no")
            if table_no:
                return str(table_no)
        
        # Fallback to table number
        return str(fallback_table_number)

    def _build_kot_items(self, cart_items) -> List[Dict[str, Any]]:
        """Transform cart items to KOT items format
        
        Args:
            cart_items: List of cart items
            
        Returns:
            List[Dict]: KOT items in PetPooja format
        """
        kot_items = []
        
        for cart_item in cart_items:
            # Determine item name and ID
            if cart_item.selected_item_variation:
                # Variation item: "ItemName (VariationName)"
                item_name = f"{cart_item.menu_item.name} ({cart_item.selected_item_variation.variation.name})"
                item_id = cart_item.selected_item_variation.external_id
            else:
                # Simple item
                item_name = cart_item.menu_item.name
                item_id = cart_item.menu_item.external_id
            
            # Build addon string
            addon_string = self._format_addon_string(cart_item)
            
            # Create KOT item
            kot_item = {
                "name": item_name,
                "quantity": cart_item.qty,
                "specialnotes": "",  # Placeholder for future special instructions
                "id": str(item_id),
                "AddonItem": addon_string,
                "fixed_per": "0"
            }
            
            kot_items.append(kot_item)
        
        return kot_items

    def _format_addon_string(self, cart_item) -> str:
        """Format addon selections as JSON string for PetPooja
        
        Args:
            cart_item: Cart item with potential addon selections
            
        Returns:
            str: JSON string of addon selections or empty string
        """
        # Get addon selections - prefer variation-specific if available
        selected_addon_rows = (
            cart_item.selected_variation_addons
            if cart_item.selected_variation_addons
            else cart_item.selected_addons
        )
        
        if not selected_addon_rows:
            return ""
        
        addon_items = []
        for addon in selected_addon_rows:
            addon_item = {
                "group_id": addon.addon_item.addon_group.external_group_id,
                "group_name": addon.addon_item.addon_group.name,
                "id": addon.addon_item.external_addon_id,
                "name": addon.addon_item.name,
                "price": str(addon.addon_item.price),
                "quantity": addon.quantity
            }
            addon_items.append(addon_item)
        
        return json.dumps(addon_items) if addon_items else ""

    # Placeholder methods for POSInterface compliance
    async def sync_menu(self, db) -> Dict[str, Any]:
        """Menu sync is handled during onboarding for dine-in"""
        return {
            "success": True,
            "message": "Menu sync handled during restaurant onboarding process"
        }
    
    async def get_order_status(self, external_order_id: str) -> Dict[str, Any]:
        """Get KOT status from PetPooja (not typically needed for KOT)"""
        return {"success": False, "error": "KOT status tracking not implemented"}
    
    async def cancel_order(self, external_order_id: str) -> Dict[str, Any]:
        """Cancel KOT in PetPooja (not typically supported)"""
        return {"success": False, "error": "KOT cancellation not supported"}
    
    def fetch_menu(self) -> Dict:
        """Menu fetch handled during onboarding"""
        return {"success": True, "message": "Menu fetch handled during onboarding"}
    
    def sync_menu_to_internal(self, pos_menu: Dict) -> None:
        """Menu sync handled during onboarding"""
        logger.info("Menu sync handled during restaurant onboarding process")
    
    def transform_cart_for_pos(self, cart_items) -> Dict:
        """Cart transformation handled within place_order method"""
        logger.info("Cart transformation handled within place_order method")
        return {"success": True} 