#!/usr/bin/env python3
"""
PetPooja dine-in integration onboarding utilities.

This module contains functions for onboarding PetPooja dine-in restaurants.
"""

import sys
import uuid
from pathlib import Path
from loguru import logger

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from models.schema import (
    POSSystem, Variation, AddonGroup, AddonGroupItem, 
    ItemVariation, ItemAddon, ItemVariationAddon, MenuItem, Table
)
from utils.jwt_utils import create_qr_token


def new_id() -> str:
    """Generate 6‑char public_id."""
    return uuid.uuid4().hex[:6]


def process_dinein_tables_from_areas(areas_data: dict, restaurant_id: int, db):
    """Create or update tables from areas.json data with external_data for dine-in"""
    logger.info("🏢 Processing tables from areas data...")
    
    tables_data = areas_data.get("tables", [])
    tables_created = 0
    tables_updated = 0
    
    for table_data in tables_data:
        table_no_str = table_data.get("table_no", "")
        table_id = table_data.get("id", "")
        
        # Try to find existing table by external_table_id
        existing_table = db.query(Table).filter_by(
            restaurant_id=restaurant_id,
            external_table_id=table_no_str
        ).first()
        
        if existing_table:
            # Update existing table
            existing_table.external_data = table_data
            logger.debug(f"🔄 Updated table {table_no_str} with new external data")
            tables_updated += 1
        else:
            # Create new table
            # Find next available table number
            max_table_number = db.query(Table).filter_by(
                restaurant_id=restaurant_id
            ).count()
            table_number = max_table_number + 1
            
            table = Table(
                public_id=new_id(),
                restaurant_id=restaurant_id,
                number=table_number,
                external_table_id=table_no_str,
                external_data=table_data,  # Store complete table info including area references
                qr_token=create_qr_token(restaurant_id, table_number)
            )
            db.add(table)
            logger.debug(f"✅ Created new table {table_no_str} with number {table_number}")
            tables_created += 1
    
    logger.success(f"✅ Processed {len(tables_data)} tables: {tables_created} created, {tables_updated} updated")
    return tables_created + tables_updated


def create_dummy_variations_for_dinein_items(menu_data: dict, pos_system_id: int, db) -> dict:
    """Create dummy variations from item-embedded variation data"""
    logger.info("🔄 Creating dummy variations for dine-in items...")
    
    created_variations = {}
    variations_created = 0
    
    for item in menu_data.get("items", []):
        if item.get("itemallowvariation") == "1" and item.get("variation"):
            for var_data in item["variation"]:
                # Create dummy external_variation_id using variationid
                dummy_var_id = f"dinein_var_{var_data['variationid']}"
                
                if dummy_var_id not in created_variations:
                    # Check if variation already exists
                    existing_variation = db.query(Variation).filter_by(
                        external_variation_id=dummy_var_id,
                        pos_system_id=pos_system_id
                    ).first()
                    
                    if not existing_variation:
                        variation = Variation(
                            name=var_data["name"],
                            display_name=var_data["name"],
                            group_name="",  # Default group name for dine-in
                            is_active=var_data["active"] == "1",
                            external_variation_id=dummy_var_id,
                            external_data=var_data,
                            pos_system_id=pos_system_id
                        )
                        db.add(variation)
                        db.flush()
                        created_variations[dummy_var_id] = variation
                        variations_created += 1
                    else:
                        created_variations[dummy_var_id] = existing_variation
    
    logger.success(f"✅ Created {variations_created} dummy variations for dine-in")
    return created_variations


def create_pos_system_for_dinein(restaurant_id: int, pos_config: dict, menu_api_data: dict, areas_data: dict, db):
    """Create POS system record with complete config from meta.json for dine-in"""
    logger.info("🔧 Creating POS system for dine-in...")
    
    # Check if POS system already exists
    pos_system = db.query(POSSystem).filter_by(
        restaurant_id=restaurant_id,
        name="petpooja_dinein"
    ).first()
    
    # Directly use pos_config from meta.json and normalize key names
    enhanced_config = pos_config.copy()
    
    # Normalize key names to match what the APIs expect
    if "app_key" in enhanced_config:
        enhanced_config["app-key"] = enhanced_config.pop("app_key")
    if "app_secret" in enhanced_config:
        enhanced_config["app-secret"] = enhanced_config.pop("app_secret")
    if "app_token" in enhanced_config:
        enhanced_config["access-token"] = enhanced_config.pop("app_token")
    if "restaurant_id" in enhanced_config:
        enhanced_config["restID"] = enhanced_config.pop("restaurant_id")
    
    # Add areas data for future reference
    enhanced_config["areas_data"] = areas_data
    
    if not pos_system:
        pos_system = POSSystem(
            restaurant_id=restaurant_id,
            name="petpooja_dinein",  # Distinct from regular "petpooja"
            config=enhanced_config,
            is_active=True,
        )
        db.add(pos_system)
        db.flush()
        logger.success(f"✅ Created POS system for dine-in with enhanced config")
    else:
        # Update existing config
        pos_system.config = enhanced_config
        db.flush()
        logger.success(f"🔄 Updated existing POS system config for dine-in")
    
    return pos_system


def process_dinein_addon_groups(menu_api_data: dict, pos_system_id: int, attributes_map: dict, db):
    """Process addon groups for dine-in"""
    logger.info("🧩 Processing addon groups for dine-in...")
    
    addon_groups_synced = 0
    addon_items_synced = 0
    
    for addon_group_data in menu_api_data.get("addongroups", []):
        existing_group = db.query(AddonGroup).filter_by(
            external_group_id=addon_group_data["addongroupid"],
            pos_system_id=pos_system_id
        ).first()
        
        if not existing_group:
            addon_group = AddonGroup(
                name=addon_group_data["addongroup_name"],
                display_name=addon_group_data["addongroup_name"],
                is_active=addon_group_data["active"] == "1",
                priority=int(addon_group_data.get("addongroup_rank", 0)),
                external_group_id=addon_group_data["addongroupid"],
                external_data=addon_group_data,
                pos_system_id=pos_system_id
            )
            db.add(addon_group)
            db.flush()
            addon_groups_synced += 1
            
            # Process addon items for this group
            for addon_item_data in addon_group_data.get("addongroupitems", []):
                tags = []
                if addon_item_data.get("attributes"):
                    for attr_id in addon_item_data["attributes"].split(","):
                        attr_id = attr_id.strip()
                        if attr_id and attr_id in attributes_map:
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
    
    logger.success(f"✅ Processed {addon_groups_synced} addon groups, {addon_items_synced} addon items for dine-in")
    return addon_groups_synced, addon_items_synced


def create_dinein_item_relationships(df_menu, menu_api_data: dict, restaurant_id: int, pos_system_id: int, variations_map: dict, db):
    """Create item relationships using dummy variations for dine-in items"""
    logger.info("🔗 Creating dine-in item relationships...")
    
    # Create lookup maps
    petpooja_items = {item["itemid"]: item for item in menu_api_data.get("items", [])}
    
    # Get existing addon groups
    addon_groups_map = {ag.external_group_id: ag for ag in db.query(AddonGroup).filter_by(pos_system_id=pos_system_id).all()}
    
    relationships_created = 0
    
    for idx, row in df_menu.iterrows():
        external_id = str(row.get("external_id", "")).strip()
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
        
        # Create item-variation relationships using dummy variations
        if petpooja_item.get("itemallowvariation") == "1" and petpooja_item.get("variation"):
            for var_data in petpooja_item["variation"]:
                dummy_var_id = f"dinein_var_{var_data['variationid']}"
                if dummy_var_id in variations_map:
                    # Check if relationship already exists
                    existing = db.query(ItemVariation).filter_by(
                        menu_item_id=menu_item.id,
                        variation_id=variations_map[dummy_var_id].id
                    ).first()
                    
                    if not existing:
                        item_variation = ItemVariation(
                            menu_item_id=menu_item.id,
                            variation_id=variations_map[dummy_var_id].id,
                            price=float(var_data["price"]),
                            is_active=var_data["active"] == "1",
                            priority=int(var_data.get("variationrank", 0)),
                            external_id=var_data["id"],  # Use var_data["id"] for orders
                            external_data=var_data
                        )
                        db.add(item_variation)
                        db.flush()  # Flush to get the ID for variation addons
                        relationships_created += 1
                        
                        # Create variation-addon relationships if variation allows addons
                        if var_data.get("variationallowaddon") == 1 and var_data.get("addon"):
                            for variation_addon_data in var_data["addon"]:
                                addon_group_id = variation_addon_data["addon_group_id"]
                                if addon_group_id in addon_groups_map:
                                    # Check if variation addon relationship already exists
                                    existing_var_addon = db.query(ItemVariationAddon).filter_by(
                                        item_variation_id=item_variation.id,
                                        addon_group_id=addon_groups_map[addon_group_id].id
                                    ).first()
                                    
                                    if not existing_var_addon:
                                        item_variation_addon = ItemVariationAddon(
                                            item_variation_id=item_variation.id,
                                            addon_group_id=addon_groups_map[addon_group_id].id,
                                            min_selection=int(variation_addon_data.get("addon_item_selection_min", 0)),
                                            max_selection=int(variation_addon_data.get("addon_item_selection_max", 1)),
                                            is_active=True,
                                            priority=0
                                        )
                                        db.add(item_variation_addon)
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
    logger.success(f"✅ Created {relationships_created} dine-in item relationships") 