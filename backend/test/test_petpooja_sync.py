#!/usr/bin/env python3
"""
Test script for PetPooja menu sync validation.
Takes PetPooja fetch menu API response and shows what database structure would be created.
Following PetPooja's architecture with global variations/addons and junction tables.
"""

import ast
import json
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TestItem:
    """Test representation of Item (main menu items)"""
    id: int
    public_id: str
    restaurant_id: int
    name: str
    category_brief: str
    description: str
    price: float
    image_path: str
    veg_flag: bool
    is_active: bool
    tags: List[str]
    priority: int
    # PetPooja Integration fields
    external_id: str  # PetPooja itemid
    external_data: Dict  # Full POS item data
    itemallowvariation: bool = False
    itemallowaddon: bool = False
    pos_system_id: Optional[int] = None


@dataclass
class TestVariation:
    """Test representation of global Variation"""
    id: int
    name: str
    display_name: str
    group_name: str
    is_active: bool
    # PetPooja Integration fields
    external_variation_id: str  # PetPooja variationid
    external_data: Dict


@dataclass
class TestAddonGroup:
    """Test representation of global AddonGroup"""
    id: int
    name: str
    display_name: str
    is_active: bool
    priority: int
    # PetPooja Integration fields
    external_group_id: str  # PetPooja addongroupid
    external_data: Dict


@dataclass
class TestAddonGroupItem:
    """Test representation of global AddonGroupItem"""
    id: int
    addon_group_id: int  # FK to TestAddonGroup
    name: str
    display_name: str
    price: float
    is_active: bool
    priority: int
    tags: List[str]
    # PetPooja Integration fields
    external_addon_id: str  # PetPooja addonitemid
    external_data: Dict


@dataclass
class TestItemVariation:
    """Junction table: Item ←→ Variation with item-specific data"""
    id: int
    item_id: int  # FK to TestItem
    variation_id: int  # FK to TestVariation
    price: float  # Item-specific price for this variation
    is_active: bool
    priority: int
    # PetPooja Integration fields
    external_id: str  # PetPooja variation.id (used for orders)
    external_data: Dict


@dataclass
class TestItemAddon:
    """Junction table: Item ←→ AddonGroup with selection rules"""
    id: int
    item_id: int  # FK to TestItem
    addon_group_id: int  # FK to TestAddonGroup
    min_selection: int
    max_selection: int
    is_active: bool
    priority: int


@dataclass
class TestDatabase:
    """Test database state following PetPooja architecture"""
    # Core entities
    items: List[TestItem] = field(default_factory=list)
    variations: List[TestVariation] = field(default_factory=list)
    addon_groups: List[TestAddonGroup] = field(default_factory=list)
    addon_group_items: List[TestAddonGroupItem] = field(default_factory=list)
    
    # Junction tables
    item_variations: List[TestItemVariation] = field(default_factory=list)
    item_addons: List[TestItemAddon] = field(default_factory=list)
    
    # ID counters
    _next_id: int = 1

    def get_next_id(self) -> int:
        current = self._next_id
        self._next_id += 1
        return current


class PetPoojaSyncTest:
    def __init__(self, restaurant_id: int = 1, pos_system_id: int = 1):
        self.restaurant_id = restaurant_id
        self.pos_system_id = pos_system_id
        self.db = TestDatabase()

    def process_menu_data(self, menu_data: Dict[str, Any]) -> TestDatabase:
        """Process PetPooja menu data following their architecture"""
        
        # Step 1: Create global variations first
        self._create_global_variations(menu_data.get("variations", []))
        
        # Step 2: Create global addon groups and items
        self._create_global_addon_groups(menu_data.get("addongroups", []))
        
        # Step 3: Create items and their relationships
        attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_data.get("attributes", [])}
        categories_map = {cat["categoryid"]: cat["categoryname"] for cat in menu_data.get("categories", [])}
        
        for item_data in menu_data.get("items", []):
            self._process_item(item_data, attributes_map, categories_map)
        
        return self.db

    def _create_global_variations(self, variations_data: List[Dict]):
        """Create global variation entities"""
        for var_data in variations_data:
            variation = TestVariation(
                id=self.db.get_next_id(),
                name=var_data["name"],
                display_name=var_data["name"],
                group_name=var_data["groupname"],
                is_active=var_data["status"] == "1",
                external_variation_id=var_data["variationid"],
                external_data=var_data
            )
            self.db.variations.append(variation)

    def _create_global_addon_groups(self, addon_groups_data: List[Dict]):
        """Create global addon group entities and their items"""
        for group_data in addon_groups_data:
            # Create addon group
            addon_group = TestAddonGroup(
                id=self.db.get_next_id(),
                name=group_data["addongroup_name"],
                display_name=group_data["addongroup_name"],
                is_active=group_data["active"] == "1",
                priority=int(group_data.get("addongroup_rank", 0)),
                external_group_id=group_data["addongroupid"],
                external_data=group_data
            )
            self.db.addon_groups.append(addon_group)
            
            # Create addon group items
            for item_data in group_data.get("addongroupitems", []):
                tags = self._get_item_tags_from_attributes(item_data.get("attributes", ""))
                
                addon_item = TestAddonGroupItem(
                    id=self.db.get_next_id(),
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
                self.db.addon_group_items.append(addon_item)

    def _process_item(self, item_data: Dict, attributes_map: Dict, categories_map: Dict):
        """Process a single menu item and create relationships"""
        
        # Create the main item
        item = self._create_item(item_data, attributes_map, categories_map)
        self.db.items.append(item)
        
        # Create item-variation relationships if allowed and present
        if item.itemallowvariation and item_data.get("variation"):
            self._create_item_variations(item, item_data["variation"])
        
        # Create item-addon relationships if allowed and present
        if item.itemallowaddon and item_data.get("addon"):
            self._create_item_addons(item, item_data["addon"])

    def _create_item(self, item_data: Dict, attributes_map: Dict, categories_map: Dict) -> TestItem:
        """Create a main menu item"""
        
        # Get item tags
        tags = item_data.get("item_tags", [])
        if item_data.get("item_attributeid"):
            attr_name = attributes_map.get(item_data["item_attributeid"])
            if attr_name:
                tags.append(attr_name)
        
        # Get category name
        category_name = categories_map.get(item_data["item_categoryid"], "")
        
        return TestItem(
            id=self.db.get_next_id(),
            public_id=f"item_{item_data['itemid']}",
            restaurant_id=self.restaurant_id,
            name=item_data["itemname"],
            category_brief=category_name,
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
            pos_system_id=self.pos_system_id
        )

    def _create_item_variations(self, item: TestItem, variations_data: List[Dict]):
        """Create item-variation relationships"""
        for var_data in variations_data:
            # Find the global variation by variationid
            global_variation = next(
                (v for v in self.db.variations if v.external_variation_id == var_data["variationid"]),
                None
            )
            
            if not global_variation:
                print(f"Warning: Global variation {var_data['variationid']} not found for item {item.name}")
                continue
            
            # Create item-variation relationship
            item_variation = TestItemVariation(
                id=self.db.get_next_id(),
                item_id=item.id,
                variation_id=global_variation.id,
                price=float(var_data["price"]),
                is_active=var_data["active"] == "1",
                priority=int(var_data.get("variationrank", 0)),
                external_id=var_data["id"],  # variation.id for orders
                external_data=var_data
            )
            self.db.item_variations.append(item_variation)

    def _create_item_addons(self, item: TestItem, addons_data: List[Dict]):
        """Create item-addon relationships"""
        for addon_ref in addons_data:
            addon_group_id = addon_ref["addon_group_id"]
            
            # Find the global addon group by external_group_id
            global_addon_group = next(
                (g for g in self.db.addon_groups if g.external_group_id == addon_group_id),
                None
            )
            
            if not global_addon_group:
                print(f"Warning: Global addon group {addon_group_id} not found for item {item.name}")
                continue
            
            # Create item-addon relationship
            item_addon = TestItemAddon(
                id=self.db.get_next_id(),
                item_id=item.id,
                addon_group_id=global_addon_group.id,
                min_selection=int(addon_ref.get("addon_item_selection_min", 0)),
                max_selection=int(addon_ref.get("addon_item_selection_max", 999)),
                is_active=True,  # Assume active if item references it
                priority=0
            )
            self.db.item_addons.append(item_addon)

    def _get_item_tags_from_attributes(self, attributes_str: str) -> List[str]:
        """Convert PetPooja attributes to tags"""
        if not attributes_str:
            return []
        
        attribute_mapping = {
            "1": "veg",
            "2": "non-veg", 
            "24": "egg"
        }
        
        tags = []
        for attr_id in attributes_str.split(","):
            attr_id = attr_id.strip()
            if attr_id in attribute_mapping:
                tags.append(attribute_mapping[attr_id])
        
        return tags

    def print_results(self):
        """Print the test results in a readable format"""
        print("=== PETPOOJA SYNC TEST RESULTS (CORRECT ARCHITECTURE) ===\n")
        
        print(f"Items ({len(self.db.items)}):")
        for item in self.db.items:
            print(f"  - {item.name} (ID: {item.id}, External ID: {item.external_id})")
            print(f"    Price: ₹{item.price}, Category: {item.category_brief}")
            print(f"    Veg: {item.veg_flag}, Active: {item.is_active}, Tags: {item.tags}")
            print(f"    Allow Variations: {item.itemallowvariation}, Allow Addons: {item.itemallowaddon}")
        print()
        
        print(f"Global Variations ({len(self.db.variations)}):")
        for variation in self.db.variations:
            print(f"  - {variation.name} ({variation.group_name}) - External ID: {variation.external_variation_id}")
        print()
        
        print(f"Global Addon Groups ({len(self.db.addon_groups)}):")
        for group in self.db.addon_groups:
            print(f"  - {group.name} (External ID: {group.external_group_id})")
            items = [i for i in self.db.addon_group_items if i.addon_group_id == group.id]
            for item in items:
                print(f"    * {item.name}: ₹{item.price} (External ID: {item.external_addon_id}, Tags: {item.tags})")
        print()
        
        print(f"Item-Variation Relationships ({len(self.db.item_variations)}):")
        for item_var in self.db.item_variations:
            item = next(i for i in self.db.items if i.id == item_var.item_id)
            variation = next(v for v in self.db.variations if v.id == item_var.variation_id)
            print(f"  - {item.name} → {variation.name}: ₹{item_var.price} (Order ID: {item_var.external_id})")
        print()
        
        print(f"Item-Addon Relationships ({len(self.db.item_addons)}):")
        for item_addon in self.db.item_addons:
            item = next(i for i in self.db.items if i.id == item_addon.item_id)
            addon_group = next(g for g in self.db.addon_groups if g.id == item_addon.addon_group_id)
            print(f"  - {item.name} → {addon_group.name}: Min={item_addon.min_selection}, Max={item_addon.max_selection}")
        print()
        
        # Validation checks
        print("=== VALIDATION CHECKS ===")
        
        # Check variation validation
        print("Variation Validation:")
        for item in self.db.items:
            variations_count = len([iv for iv in self.db.item_variations if iv.item_id == item.id])
            if item.itemallowvariation and variations_count == 0:
                print(f"  ⚠️  {item.name}: allows variations but has none")
            elif not item.itemallowvariation and variations_count > 0:
                print(f"  ❌ {item.name}: doesn't allow variations but has {variations_count}")
            elif item.itemallowvariation and variations_count > 0:
                print(f"  ✅ {item.name}: allows variations and has {variations_count}")
            else:
                print(f"  ✅ {item.name}: no variations (correctly)")
        
        print("\nAddon Validation:")
        for item in self.db.items:
            addons_count = len([ia for ia in self.db.item_addons if ia.item_id == item.id])
            if item.itemallowaddon and addons_count == 0:
                print(f"  ⚠️  {item.name}: allows addons but has none")
            elif not item.itemallowaddon and addons_count > 0:
                print(f"  ❌ {item.name}: doesn't allow addons but has {addons_count}")
            elif item.itemallowaddon and addons_count > 0:
                print(f"  ✅ {item.name}: allows addons and has {addons_count}")
            else:
                print(f"  ✅ {item.name}: no addons (correctly)")
        print()
        
        # Show order ID mapping for validation
        print("=== ORDER ID MAPPING (Key insight!) ===")
        for item in self.db.items:
            print(f"  - {item.name}:")
            print(f"    * No variation: Use itemid = {item.external_id}")
            
            # Show variation IDs
            item_variations = [iv for iv in self.db.item_variations if iv.item_id == item.id]
            for item_var in item_variations:
                variation = next(v for v in self.db.variations if v.id == item_var.variation_id)
                print(f"    * With {variation.name}: Use variation.id = {item_var.external_id}, variation_id = {variation.external_variation_id}")
            
            # Show addon IDs
            item_addons = [ia for ia in self.db.item_addons if ia.item_id == item.id]
            if item_addons:
                print(f"    * Available addons:")
                for item_addon in item_addons:
                    addon_group = next(g for g in self.db.addon_groups if g.id == item_addon.addon_group_id)
                    addon_items = [ai for ai in self.db.addon_group_items if ai.addon_group_id == addon_group.id]
                    for addon_item in addon_items:
                        print(f"      - {addon_item.name}: Use addonitemid = {addon_item.external_addon_id}")
        
        print("\n=== ARCHITECTURE BENEFITS ===")
        print("✅ No duplicate variations - global entities reused")
        print("✅ No duplicate addon groups - global entities reused") 
        print("✅ Item-specific pricing in junction tables")
        print("✅ Proper normalization following PetPooja structure")
        print("✅ Scalable for adding new items with existing variations")


def main():
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], 'r') as f:
            menu_data = json.load(f)
    else:
        # Read from stdin
        menu_data = json.load(sys.stdin)
    
    # Process the data
    sync_test = PetPoojaSyncTest()
    result_db = sync_test.process_menu_data(menu_data)
    
    # Print results
    sync_test.print_results()
    
    # Also output as JSON for programmatic use
    if len(sys.argv) > 2 and sys.argv[2] == "--json":
        import dataclasses
        
        result = {
            "items": [dataclasses.asdict(item) for item in result_db.items],
            "variations": [dataclasses.asdict(var) for var in result_db.variations],
            "addon_groups": [dataclasses.asdict(group) for group in result_db.addon_groups],
            "addon_group_items": [dataclasses.asdict(item) for item in result_db.addon_group_items],
            "item_variations": [dataclasses.asdict(iv) for iv in result_db.item_variations],
            "item_addons": [dataclasses.asdict(ia) for ia in result_db.item_addons]
        }
        
        with open("sync_test_output.json", "w") as f:
            json.dump(result, f, indent=2)
        print("\nDetailed output saved to sync_test_output.json")


if __name__ == "__main__":
    main() 