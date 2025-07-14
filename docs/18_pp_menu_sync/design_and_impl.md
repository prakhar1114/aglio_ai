# PetPooja Menu Sync API - Design & Implementation Plan

## Overview
Synchronous API endpoint to sync complete menu data from PetPooja POS system, updating all 7 database entities with rollback on any failure.

## API Endpoint
```
POST /{restaurant_slug}/sync_menu
```

**Location**: `backend/urls/petpooja_callback.py` (added to existing file)
**Authentication**: None (for now)

## Request/Response Format

### Request Body
Complete PetPooja menu JSON structure:
```json
{
  "success": "1",
  "restaurants": [...],
  "categories": [...],
  "items": [...],
  "variations": [...],
  "addongroups": [...],
  "attributes": [...]
}
```

### Response Format
```json
// Success
{
  "success": "1", 
  "message": "Menu items are successfully listed."
}

// Error
{
  "success": "0",
  "message": "Error description"
}
```

## Database Entities Processed

### Core Entities (7 total)
1. **MenuItem** - From `items[]` array
2. **Variation** - From `variations[]` array  
3. **AddonGroup** - From `addongroups[]` array
4. **AddonGroupItem** - From `addongroups[].addongroupitems[]`
5. **ItemVariation** - From `items[].variation[]` (relationships)
6. **ItemAddon** - From `items[].addon[]` (relationships)
7. **ItemVariationAddon** - From `items[].variation[].addon[]` (relationships)

## Processing Flow

### Phase 1: Validation (Fail Fast)
1. Validate JSON structure and required fields
2. Find restaurant by slug
3. Validate POS system exists and `name == "petpooja"`

### Phase 2: Deactivation (Prepare Clean Slate)
```sql
-- Set all existing entities as inactive
UPDATE menu_items SET is_active = false WHERE restaurant_id = ? AND pos_system_id = ?;
UPDATE variations SET is_active = false WHERE pos_system_id = ?;
UPDATE addon_groups SET is_active = false WHERE pos_system_id = ?;
UPDATE addon_group_items SET is_active = false WHERE addon_group_id IN (...);
UPDATE item_variations SET is_active = false WHERE menu_item_id IN (...);
UPDATE item_addons SET is_active = false WHERE menu_item_id IN (...);
UPDATE item_variation_addons SET is_active = false WHERE item_variation_id IN (...);
```

### Phase 3: Core Entity Processing
**Process in order to avoid foreign key issues:**

1. **MenuItem Processing**
   - External ID: `item["itemid"]` → `MenuItem.external_id`
   - Find existing by `external_id` + `restaurant_id`
   - Update existing OR create new
   - Set `is_active = True`, store full data in `external_data`

2. **Variation Processing**  
   - External ID: `variation["variationid"]` → `Variation.external_variation_id`
   - Find existing by `external_variation_id` + `pos_system_id`
   - Update existing OR create new
   - Set `is_active = True`

3. **AddonGroup Processing**
   - External ID: `addongroup["addongroupid"]` → `AddonGroup.external_group_id` 
   - Find existing by `external_group_id` + `pos_system_id`
   - Update existing OR create new
   - Set `is_active = True`

4. **AddonGroupItem Processing**
   - External ID: `addonitem["addonitemid"]` → `AddonGroupItem.external_addon_id`
   - Find existing by `external_addon_id` + `addon_group_id`
   - Update existing OR create new
   - Set `is_active = True`

### Phase 4: Relationship Processing
**Process after core entities exist:**

5. **ItemVariation Processing**
   - Links: `MenuItem.external_id` ↔ `Variation.external_variation_id`
   - External ID: `item_variation["id"]` → `ItemVariation.external_id`
   - Create price and metadata from `items[].variation[]` data
   - Set `is_active = True`

6. **ItemAddon Processing**
   - Links: `MenuItem.external_id` ↔ `AddonGroup.external_group_id`
   - Min/max selection from `items[].addon[]` data
   - Set `is_active = True`

7. **ItemVariationAddon Processing**
   - Links: `ItemVariation.external_id` ↔ `AddonGroup.external_group_id`
   - Min/max selection from `items[].variation[].addon[]` data  
   - Set `is_active = True`

### Phase 5: Finalization
1. Update `MenuItem.itemallowvariation` and `itemallowaddon` flags
2. Commit transaction
3. Return success response

## Error Handling & Rollback

### Single Transaction Strategy
```python
try:
    with SessionLocal() as db:
        # All processing in one transaction
        validate_input(payload)
        restaurant = find_restaurant_by_slug(restaurant_slug, db)
        pos_system = validate_pos_system(restaurant.id, db)
        
        # Deactivate existing
        deactivate_all_entities(restaurant.id, pos_system.id, db)
        
        # Process core entities  
        process_menu_items(payload["items"], restaurant.id, pos_system.id, db)
        process_variations(payload["variations"], pos_system.id, db)
        process_addon_groups(payload["addongroups"], pos_system.id, db)
        
        # Process relationships
        process_item_relationships(payload["items"], restaurant.id, pos_system.id, db)
        
        # Finalize
        update_item_flags(restaurant.id, db)
        db.commit()
        
        return {"success": "1", "message": "Menu items are successfully listed."}
        
except Exception as e:
    # Automatic rollback on any error
    logger.error(f"Menu sync failed for {restaurant_slug}: {e}")
    return {"success": "0", "message": str(e)}
```

### Error Categories
1. **Validation Errors** (400-level)
   - Invalid JSON structure
   - Missing required fields
   - Restaurant not found
   - Invalid POS system

2. **Data Integrity Errors** (422-level)  
   - Duplicate external_ids in payload
   - Missing foreign key references
   - Constraint violations

3. **System Errors** (500-level)
   - Database connection issues
   - Unexpected exceptions

## Implementation Details

### External ID Mapping Strategy
```python
# Core entity lookups
MenuItem: external_id + restaurant_id
Variation: external_variation_id + pos_system_id  
AddonGroup: external_group_id + pos_system_id
AddonGroupItem: external_addon_id + addon_group_id

# Relationship entity lookups
ItemVariation: menu_item_id + variation_id (unique constraint)
ItemAddon: menu_item_id + addon_group_id (unique constraint)
ItemVariationAddon: item_variation_id + addon_group_id (unique constraint)
```

### Data Field Mapping
```python
# MenuItem core fields
name = item["itemname"]
description = item["itemdescription"] 
price = float(item["price"])
itemallowvariation = item["itemallowvariation"] == "1"
itemallowaddon = item["itemallowaddon"] == "1"
external_id = item["itemid"]
external_data = item  # Full JSON

# Variation core fields  
name = variation["name"]
group_name = variation["groupname"] 
is_active = variation["status"] == "1"
external_variation_id = variation["variationid"]
external_data = variation  # Full JSON

# AddonGroup core fields
name = addongroup["addongroup_name"]
is_active = addongroup["active"] == "1"
priority = int(addongroup["addongroup_rank"])
external_group_id = addongroup["addongroupid"]
external_data = addongroup  # Full JSON
```

### Logging Strategy
```python
logger.info(f"Starting menu sync for restaurant {restaurant_slug}")
logger.info(f"Processing {len(items)} items, {len(variations)} variations, {len(addon_groups)} addon groups")
logger.info(f"Created {created_items} items, updated {updated_items} items")
logger.info(f"Menu sync completed successfully for {restaurant_slug}")
logger.error(f"Menu sync failed for {restaurant_slug}: {error}")
```

## Implementation Files

### Main Implementation
- **File**: `backend/urls/petpooja_callback.py`  
- **New Function**: `sync_menu(restaurant_slug: str, request: Request)`
- **Helper Functions**: Individual entity processors

### Dependencies
- Reuse existing utility functions from `petpooja_callback.py`
- Use existing database models from `models/schema.py`
- Use existing logging from `config.py`

## Key Design Decisions

1. **Synchronous Processing**: No background jobs, direct API response
2. **Single Transaction**: All-or-nothing approach with automatic rollback
3. **Deactivate-Then-Create**: Clean slate approach to handle deletions
4. **External ID Strategy**: Use PetPooja IDs for entity matching
5. **Full Data Storage**: Store complete PetPooja JSON in `external_data` fields
6. **Relationship Order**: Process core entities before relationships

## Testing Approach (Future)

### Manual Testing
1. Test with sample_petpooja_menu.json
2. Test partial updates (some items changed)
3. Test error scenarios (missing restaurant, invalid POS)
4. Test large menus (100+ items)

### Validation Points
1. All 7 entity types are processed correctly
2. Existing items are updated, new items are created  
3. Relationships are established correctly
4. Transaction rollback works on errors
5. `is_active` flags are set correctly
