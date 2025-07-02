#!/usr/bin/env python3
"""
Generate menu.csv from PetPooja menu.json for manual editing before onboarding.

Usage:
    python generate_menu_csv.py /path/to/restaurant_folder
"""

import json
import csv
import sys
import uuid
from pathlib import Path
from loguru import logger


def new_id() -> str:
    """Generate 6‑char public_id."""
    return uuid.uuid4().hex[:6]


def extract_menu_items_from_json(menu_json_path: Path) -> list:
    """Extract core menu item data from PetPooja menu.json"""
    
    with open(menu_json_path, 'r') as f:
        menu_data = json.load(f)
    
    # Create category mapping
    categories_map = {
        cat["categoryid"]: cat["categoryname"] 
        for cat in menu_data.get("categories", [])
    }
    
    # Create attributes mapping
    attributes_map = {
        attr["attributeid"]: attr["attribute"] 
        for attr in menu_data.get("attributes", [])
    }
    
    menu_items = []
    
    for item_data in menu_data.get("items", []):
        # Get category name
        category_name = categories_map.get(item_data.get("item_categoryid", ""), "Uncategorized")
        
        # Determine veg flag from attributes
        veg_flag = item_data.get("item_attributeid") == "1"  # "1" typically means veg in PetPooja
        
        # Extract tags
        tags = item_data.get("item_tags", [])
        if item_data.get("item_attributeid") and item_data["item_attributeid"] in attributes_map:
            tags.append(attributes_map[item_data["item_attributeid"]])
        
        # Create menu item record
        menu_item = {
            "external_id": item_data["itemid"],
            "name": item_data["itemname"],
            "category_brief": category_name,
            "group_category": category_name,
            "description": item_data.get("itemdescription", ""),
            "price": float(item_data["price"]),
            "image_path": "",  # To be filled manually
            "veg_flag": veg_flag,
            "is_bestseller": False,  # To be set manually
            "is_recommended": False,  # To be set manually
            "kind": "food",
            "priority": int(item_data.get("itemrank", 0)),
            "promote": False,  # To be set manually
            "public_id": new_id(),
            "cloudflare_image_id": "",  # To be filled after image upload
            "cloudflare_video_id": ""   # To be filled if applicable
        }
        
        menu_items.append(menu_item)
    
    return menu_items


def generate_csv_file(menu_items: list, output_path: Path):
    """Generate menu.csv file from extracted menu items"""
    
    # Define CSV column order
    fieldnames = [
        "external_id",
        "name", 
        "category_brief",
        "group_category",
        "description",
        "price",
        "image_path",
        "veg_flag",
        "is_bestseller",
        "is_recommended", 
        "kind",
        "priority",
        "promote",
        "public_id",
        "cloudflare_image_id",
        "cloudflare_video_id"
    ]
    
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(menu_items)
    
    logger.success(f"✅ Generated menu.csv with {len(menu_items)} items at: {output_path}")


def analyze_petpooja_data(menu_json_path: Path):
    """Analyze PetPooja data and provide summary"""
    
    with open(menu_json_path, 'r') as f:
        menu_data = json.load(f)
    
    items = menu_data.get("items", [])
    variations = menu_data.get("variations", [])
    addon_groups = menu_data.get("addongroups", [])
    
    # Count items with variations and addons
    items_with_variations = sum(1 for item in items if item.get("itemallowvariation") == "1")
    items_with_addons = sum(1 for item in items if item.get("itemallowaddon") == "1")
    
    total_addon_items = sum(len(group.get("addongroupitems", [])) for group in addon_groups)
    
    logger.info("📊 PetPooja Data Analysis:")
    logger.info(f"   Total Items: {len(items)}")
    logger.info(f"   Items with Variations: {items_with_variations}")
    logger.info(f"   Items with Addons: {items_with_addons}")
    logger.info(f"   Global Variations: {len(variations)}")
    logger.info(f"   Addon Groups: {len(addon_groups)}")
    logger.info(f"   Total Addon Items: {total_addon_items}")
    
    # Show items that need attention
    logger.info("\n🔍 Items that will have variations/addons:")
    for item in items:
        features = []
        if item.get("itemallowvariation") == "1":
            variation_count = len(item.get("variation", []))
            features.append(f"{variation_count} variations")
        if item.get("itemallowaddon") == "1":
            addon_count = len(item.get("addon", []))
            features.append(f"{addon_count} addon groups")
        
        if features:
            logger.info(f"   - {item['itemname']} ({item['itemid']}): {', '.join(features)}")


def main():
    if len(sys.argv) != 2:
        print("Usage: python generate_menu_csv.py /path/to/restaurant_folder")
        sys.exit(1)
    
    folder = Path(sys.argv[1]).expanduser().resolve()
    if not folder.is_dir():
        logger.error("❌ Provided path is not a directory")
        sys.exit(1)
    
    menu_json_path = folder / "menu.json"
    if not menu_json_path.exists():
        logger.error("❌ menu.json not found in the provided folder")
        sys.exit(1)
    
    try:
        logger.info(f"🔍 Processing menu.json from: {folder}")
        
        # Analyze the PetPooja data first
        analyze_petpooja_data(menu_json_path)
        
        # Extract menu items
        menu_items = extract_menu_items_from_json(menu_json_path)
        
        # Generate CSV
        csv_output_path = folder / "menu.csv"
        generate_csv_file(menu_items, csv_output_path)
        
        logger.success(f"🎉 Menu CSV generated successfully!")
        logger.info("\n📝 Next steps:")
        logger.info("1. Edit the generated menu.csv to:")
        logger.info("   - Add image_path for each item")
        logger.info("   - Set is_bestseller/is_recommended flags")
        logger.info("   - Adjust names/descriptions if needed")
        logger.info("   - Update cloudflare_image_id if images already uploaded")
        logger.info("2. Run the onboarding script:")
        logger.info(f"   python 1_onboard_restaurants.py {folder}")
        
    except Exception as e:
        logger.error(f"❌ Error generating CSV: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()