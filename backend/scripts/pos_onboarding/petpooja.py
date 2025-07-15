#!/usr/bin/env python3
"""
PetPooja delivery integration onboarding utilities.

This module contains functions for onboarding regular PetPooja delivery restaurants.
"""

import sys
from pathlib import Path
from loguru import logger

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from models.schema import (
    POSSystem, Variation, AddonGroup, AddonGroupItem, 
    ItemVariation, ItemAddon, MenuItem
)


def process_petpooja_data(menu_api_data: dict, restaurant_id: int, pos_config: dict | None, db) -> dict:
    """Process PetPooja menu.json data to create variations and addons"""
    logger.info("🔗 Processing PetPooja variations and addons...")
    
    try:
        # Extract taxes from PetPooja menu data
        taxes_data = menu_api_data.get("taxes", [])
        discount_data = menu_api_data.get("discounts", [])
        logger.info(f"Found {len(taxes_data)} tax rules in PetPooja data")
        
        # Process taxes to make them active and usable
        processed_taxes = []
        for tax in taxes_data:
            processed_tax = {
                "taxid": tax.get("taxid", ""),
                "taxname": tax.get("taxname", ""),
                "tax": tax.get("tax", "0"),
                "taxtype": tax.get("taxtype", "1"),
                "tax_ordertype": tax.get("tax_ordertype", ""),
                "active": True,  # Make taxes active by default
                "tax_coreortotal": tax.get("tax_coreortotal", "2"),
                "tax_taxtype": tax.get("tax_taxtype", "1"),
                "rank": tax.get("rank", "1"),
                "consider_in_core_amount": tax.get("consider_in_core_amount", "0"),
                "description": tax.get("description", "")
            }
            processed_taxes.append(processed_tax)
        
        # Create placeholder discount configuration
        discount_config = discount_data
        
        # Create or get POS system record
        pos_system = db.query(POSSystem).filter_by(
            restaurant_id=restaurant_id,
            name="petpooja"
        ).first()
        
        # Merge taxes and discounts with existing config
        enhanced_config = pos_config.copy() if pos_config else {}
        enhanced_config["taxes"] = processed_taxes
        enhanced_config["discounts"] = discount_config
        
        if not pos_system:
            # Insert a new POSSystem row with the enhanced config
            pos_system = POSSystem(
                restaurant_id=restaurant_id,
                name="petpooja",
                config=enhanced_config,
                is_active=True,
            )
            db.add(pos_system)
            db.flush()
            logger.success(
                f"✅ Created POS system record for restaurant {restaurant_id} with enhanced config including {len(processed_taxes)} tax rules"
            )
        else:
            # Record exists – update the config with taxes and discounts
            pos_system.config = enhanced_config.copy()
            db.flush()
            logger.success(
                f"🔄 Updated existing POS system config for restaurant {restaurant_id} with {len(processed_taxes)} tax rules and {len(discount_config)} discount placeholders"
            )
        
        # Build attributes mapping for tags
        attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_api_data.get("attributes", [])}
        logger.info(f"Attributes map: {attributes_map}")
        
        # Process global variations
        variations_synced = 0
        for var_data in menu_api_data.get("variations", []):
            existing_variation = db.query(Variation).filter_by(
                external_variation_id=var_data["variationid"],
                pos_system_id=pos_system.id
            ).first()
            
            if not existing_variation:
                variation = Variation(
                    name=var_data["name"],
                    display_name=var_data["name"],
                    group_name=var_data["groupname"],
                    is_active=var_data["status"] == "1",
                    external_variation_id=var_data["variationid"],
                    external_data=var_data,
                    pos_system_id=pos_system.id
                )
                db.add(variation)
                variations_synced += 1
        
        # Process global addon groups
        addon_groups_synced = 0
        addon_items_synced = 0
        
        for addon_group_data in menu_api_data.get("addongroups", []):
            existing_group = db.query(AddonGroup).filter_by(
                external_group_id=addon_group_data["addongroupid"],
                pos_system_id=pos_system.id
            ).first()
            
            if not existing_group:
                addon_group = AddonGroup(
                    name=addon_group_data["addongroup_name"],
                    display_name=addon_group_data["addongroup_name"],
                    is_active=addon_group_data["active"] == "1",
                    priority=int(addon_group_data.get("addongroup_rank", 0)),
                    external_group_id=addon_group_data["addongroupid"],
                    external_data=addon_group_data,
                    pos_system_id=pos_system.id
                )
                db.add(addon_group)
                db.flush()
                addon_groups_synced += 1
                
                # Process addon items for this group
                for addon_item_data in addon_group_data.get("addongroupitems", []):
                    # Get tags from attributes
                    tags = []
                    if addon_item_data.get("attributes"):
                        for attr_id in addon_item_data["attributes"].split(","):
                            attr_id = attr_id.strip()
                            if attr_id in attributes_map:
                                tags.append(attributes_map[attr_id])
                    
                    addon_item = AddonGroupItem(
                        addon_group_id=addon_group.id,
                        name=addon_item_data["addonitem_name"],
                        display_name=addon_item_data["addonitem_name"],
                        price=float(addon_item_data["addonitem_price"]),
                        is_active=addon_item_data["active"] == "1",
                        priority=int(addon_item_data.get("addonitem_rank", 0)),
                        tags=tags,
                        external_addon_id=addon_item_data["addonitemid"],
                        external_data=addon_item_data
                    )
                    db.add(addon_item)
                    addon_items_synced += 1
        
        result = {
            "success": True,
            "pos_system_id": pos_system.id,
            "variations_synced": variations_synced,
            "addon_groups_synced": addon_groups_synced,
            "addon_items_synced": addon_items_synced,
            "taxes_processed": len(processed_taxes),
            "discounts_configured": len(discount_config),
        }
        
        logger.success(f"✅ PetPooja data processed: {variations_synced} variations, {addon_groups_synced} addon groups, {addon_items_synced} addon items, {len(processed_taxes)} tax rules, {len(discount_config)} discount rules")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error processing PetPooja data: {e}")
        return {
            "success": False,
            "error": str(e),
            "pos_system_id": None,
            "variations_synced": 0,
            "addon_groups_synced": 0,
            "addon_items_synced": 0,
            "taxes_processed": 0,
            "discounts_configured": 0
        }


def create_item_relationships(df_menu, menu_api_data: dict, restaurant_id: int, pos_system_id: int, db):
    """Create item-variation and item-addon relationships from PetPooja data"""
    logger.info("🔗 Creating item relationships...")
    
    # Create lookup maps
    petpooja_items = {item["itemid"]: item for item in menu_api_data.get("items", [])}
    
    # Get existing variations and addon groups
    variations_map = {v.external_variation_id: v for v in db.query(Variation).filter_by(pos_system_id=pos_system_id).all()}
    addon_groups_map = {ag.external_group_id: ag for ag in db.query(AddonGroup).filter_by(pos_system_id=pos_system_id).all()}
    
    relationships_created = 0
    
    for idx, row in df_menu.iterrows():
        external_id = str(row.get("id", "")).strip()
        if not external_id or external_id not in petpooja_items:
            continue
            
        # Get the menu item from database
        menu_item = db.query(MenuItem).filter_by(
            restaurant_id=restaurant_id,
            external_id=external_id
        ).first()
        
        if not menu_item:
            continue
            
        petpooja_item = petpooja_items[external_id]
        
        # Create item-variation relationships
        if petpooja_item.get("itemallowvariation") == "1" and petpooja_item.get("variation"):
            for var_data in petpooja_item["variation"]:
                variation_id = var_data["variationid"]
                if variation_id in variations_map:
                    # Check if relationship already exists
                    existing = db.query(ItemVariation).filter_by(
                        menu_item_id=menu_item.id,
                        variation_id=variations_map[variation_id].id
                    ).first()
                    
                    if not existing:
                        item_variation = ItemVariation(
                            menu_item_id=menu_item.id,
                            variation_id=variations_map[variation_id].id,
                            price=float(var_data["price"]),
                            is_active=var_data["active"] == "1",
                            priority=int(var_data.get("variationrank", 0)),
                            variationallowaddon=var_data.get("variationallowaddon", 0) == 1,
                            external_id=var_data["id"],  # variation.id for orders
                            external_data=var_data
                        )
                        db.add(item_variation)
                        relationships_created += 1
        
        # Create item-addon relationships
        if petpooja_item.get("itemallowaddon") == "1" and petpooja_item.get("addon"):
            for addon_data in petpooja_item["addon"]:
                addon_group_id = addon_data["addon_group_id"]
                if addon_group_id in addon_groups_map:
                    # Check if relationship already exists
                    existing = db.query(ItemAddon).filter_by(
                        menu_item_id=menu_item.id,
                        addon_group_id=addon_groups_map[addon_group_id].id
                    ).first()
                    
                    if not existing:
                        item_addon = ItemAddon(
                            menu_item_id=menu_item.id,
                            addon_group_id=addon_groups_map[addon_group_id].id,
                            min_selection=int(addon_data.get("addon_item_selection_min", 0)),
                            max_selection=int(addon_data.get("addon_item_selection_max", 1)),
                            is_active=True,
                            priority=0
                        )
                        db.add(item_addon)
                        relationships_created += 1
    
    db.flush()
    logger.success(f"✅ Created {relationships_created} item relationships") 