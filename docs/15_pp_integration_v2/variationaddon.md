# ItemVariationAddon Implementation

## Problem Statement

In the PetPooja integration, we discovered that **individual variations can have their own specific addons** that are different from the item's base addons. This is a critical business requirement that was missing from our initial schema design.

### Example from PetPooja Data Structure

```json
{
  "itemid": "10539578",
  "itemallowvariation": "1",
  "itemallowaddon": "1",
  "variation": [
    {
      "id": "10539671",
      "variationid": "10434",
      "name": "2 Pieces",
      "groupname": "Quantity",
      "price": "239.00",
      "addon": [
        {
          "addon_group_id": "11425",
          "addon_item_selection_min": "1",
          "addon_item_selection_max": "1"
        }
      ],
      "variationallowaddon": 1
    },
    {
      "id": "10539672", 
      "variationid": "10435",
      "name": "4 Pieces",
      "groupname": "Quantity",
      "price": "439.00",
      "addon": [],
      "variationallowaddon": 0
    }
  ],
  "addon": [
    {
      "addon_group_id": "11426",
      "addon_item_selection_min": "0",
      "addon_item_selection_max": "2"
    }
  ]
}
```

**Key Observation**: The "2 Pieces" variation has its own specific addons (group 11425), while the "4 Pieces" variation has no addons, even though the base item has addons (group 11426).

## Business Logic

- **Variation addons override item addons** when present
- Each `ItemVariation` can have its own set of addon groups
- If a variation has `variationallowaddon: 1` and has `addon` array, those addons take precedence
- If a variation has `variationallowaddon: 0` or empty `addon` array, no addons are available for that variation (even if the base item has addons)

## Solution Design

### Database Schema Enhancement

We added a new junction table `ItemVariationAddon` that creates a many-to-many relationship between `ItemVariation` and `AddonGroup`:

```python
class ItemVariationAddon(Base):
    """Junction table: ItemVariation ←→ AddonGroup with selection rules for variation-specific addons"""
    __tablename__ = "item_variation_addons"

    id = Column(Integer, primary_key=True)
    item_variation_id = Column(Integer, ForeignKey("item_variations.id"), nullable=False)
    addon_group_id = Column(Integer, ForeignKey("addon_groups.id"), nullable=False)
    min_selection = Column(Integer, default=0)
    max_selection = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)

    item_variation = relationship("ItemVariation", back_populates="variation_addons")
    addon_group = relationship("AddonGroup", back_populates="variation_addons")

    __table_args__ = (
        UniqueConstraint("item_variation_id", "addon_group_id", name="uix_item_variation_addon"),
    )
```

### Relationship Updates

**ItemVariation Model**:
```python
class ItemVariation(Base):
    # ... existing fields ...
    variation_addons = relationship("ItemVariationAddon", back_populates="item_variation")
```

**AddonGroup Model**:
```python
class AddonGroup(Base):
    # ... existing fields ...
    variation_addons = relationship("ItemVariationAddon", back_populates="addon_group")
```

## Implementation Details

### Onboarding Logic Enhancement

Updated `create_item_relationships()` function in `backend/scripts/1_onboard_restaurants.py`:

```python
# Create item-variation relationships
if petpooja_item.get("itemallowvariation") == "1" and petpooja_item.get("variation"):
    for var_data in petpooja_item["variation"]:
        variation_id = var_data["variationid"]
        if variation_id in variations_map:
            # ... create ItemVariation ...
            db.add(item_variation)
            db.flush()  # Flush to get the ID for variation addons
            
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
```

### Key Implementation Points

1. **Database Flush**: We flush after creating `ItemVariation` to ensure the ID is available for creating `ItemVariationAddon` relationships.

2. **Conditional Logic**: Only create variation addons when:
   - `variationallowaddon == 1`
   - `addon` array exists and is not empty

3. **Duplicate Prevention**: Check for existing relationships before creating new ones.

4. **Selection Rules**: Map PetPooja's `addon_item_selection_min` and `addon_item_selection_max` to our schema.

## Data Flow

### Database Entities
```
MenuItem (Pizza)
├── ItemVariation (Small Pizza) → ItemVariationAddon → AddonGroup (Toppings A)
├── ItemVariation (Large Pizza) → ItemVariationAddon → AddonGroup (Toppings B)
└── ItemAddon → AddonGroup (Base Beverages) [overridden by variation addons]
```

### PetPooja Integration Flow
1. **Global Entities**: Create `Variation` and `AddonGroup` from PetPooja's global lists
2. **Menu Items**: Create `MenuItem` with `itemallowvariation` and `itemallowaddon` flags
3. **Item Relationships**: Create `ItemVariation` and `ItemAddon` relationships
4. **Variation Addons**: Create `ItemVariationAddon` for variations that specify their own addons

## Frontend Impact

### Menu API Response Structure

```typescript
interface MenuItem {
  id: string
  name: string
  base_price: number
  variation_groups: VariationGroup[]
  addon_groups: AddonGroup[]  // Base item addons (fallback)
}

interface VariationGroup {
  group_name: string
  variations: Variation[]
}

interface Variation {
  id: number  // ItemVariation.id
  name: string
  price: number
  addon_groups?: AddonGroup[]  // Variation-specific addons (override base)
}
```

### Business Logic for Frontend

```typescript
function getAvailableAddons(menuItem: MenuItem, selectedVariation?: Variation): AddonGroup[] {
  if (selectedVariation && selectedVariation.addon_groups && selectedVariation.addon_groups.length > 0) {
    // Use variation-specific addons (override base item addons)
    return selectedVariation.addon_groups;
  }
  
  // Fall back to base item addons
  return menuItem.addon_groups;
}
```

## Database Migration

Since this is a new table addition, the migration is straightforward:

```sql
-- Create the new table
CREATE TABLE item_variation_addons (
    id SERIAL PRIMARY KEY,
    item_variation_id INTEGER NOT NULL REFERENCES item_variations(id),
    addon_group_id INTEGER NOT NULL REFERENCES addon_groups(id),
    min_selection INTEGER DEFAULT 0,
    max_selection INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    UNIQUE(item_variation_id, addon_group_id)
);

-- Add indexes for performance
CREATE INDEX idx_item_variation_addons_item_variation_id ON item_variation_addons(item_variation_id);
CREATE INDEX idx_item_variation_addons_addon_group_id ON item_variation_addons(addon_group_id);
```

## Testing Scenarios

### Test Case 1: Variation with Specific Addons
```json
{
  "itemname": "Pizza",
  "itemallowvariation": "1",
  "itemallowaddon": "1",
  "variation": [
    {
      "name": "Small",
      "variationallowaddon": 1,
      "addon": [{"addon_group_id": "123"}]
    }
  ],
  "addon": [{"addon_group_id": "456"}]
}
```

**Expected Result**: Small Pizza should have addon group 123, not 456.

### Test Case 2: Variation without Addons
```json
{
  "itemname": "Bread",
  "itemallowvariation": "1", 
  "itemallowaddon": "1",
  "variation": [
    {
      "name": "Large",
      "variationallowaddon": 0,
      "addon": []
    }
  ],
  "addon": [{"addon_group_id": "789"}]
}
```

**Expected Result**: Large Bread should have no addons, even though base item has addons.

### Test Case 3: Mixed Variations
```json
{
  "variation": [
    {
      "name": "Small",
      "variationallowaddon": 1,
      "addon": [{"addon_group_id": "111"}]
    },
    {
      "name": "Large", 
      "variationallowaddon": 0,
      "addon": []
    }
  ]
}
```

**Expected Result**: Small has specific addons, Large has no addons.

## Performance Considerations

1. **Query Optimization**: Use joins to fetch variation addons with the menu query:
   ```python
   menu_items = db.query(MenuItem).options(
       joinedload(MenuItem.item_variations)
       .joinedload(ItemVariation.variation_addons)
       .joinedload(ItemVariationAddon.addon_group)
       .joinedload(AddonGroup.addon_items)
   ).all()
   ```

2. **Caching**: Cache menu data with variation addons to reduce database queries.

3. **Index Strategy**: Index on `item_variation_id` and `addon_group_id` for fast lookups.

## Future Enhancements

1. **Addon Inheritance**: Option to inherit base item addons AND add variation-specific ones.

2. **Conditional Addons**: Addons that are only available when certain other addons are selected.

3. **Dynamic Pricing**: Variation-specific addon pricing (currently addons have global pricing).

4. **Addon Dependencies**: Some addons may require or exclude other addons within a variation.

## Conclusion

The `ItemVariationAddon` implementation successfully addresses the PetPooja requirement for variation-specific addons while maintaining the flexibility of our existing schema. The solution is:

- **Backwards Compatible**: Existing `ItemAddon` relationships continue to work as fallbacks
- **Scalable**: Can handle complex variation/addon hierarchies
- **Performance Optimized**: Efficient database queries and relationships
- **Business Logic Compliant**: Correctly implements PetPooja's override semantics

This enhancement enables accurate representation of complex menu structures where different variations of the same item have completely different customization options.
