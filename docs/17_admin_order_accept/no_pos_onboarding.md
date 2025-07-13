## No-POS Manual On-Boarding – Developer Design

_Last updated: {{DATE}}
_

This document captures the **internal design** for supporting restaurants that are **NOT connected to any POS** (`pos_type = "no_pos"`).  Restaurants will provide their complete menu and customisations via CSV files that our onboarding script (`backend/scripts/1_onboard_restaurants.py`) will ingest.

### 1.    Folder Layout expected by the script

```text
restaurant_folder/
├── meta.json                     # must contain "pos_type": "no_pos"
├── tables.json                   # mandatory (see docs/…/table_session_api_and_ws.md)
├── menu.csv                      # core items – _always_ required
├── hours.json                    # optional opening hours
├── images/                       # local media assets (or URLs in menu.csv)
└── customisations/               # NEW – all variation/addon CSVs live here
    ├── variations.csv
    ├── addon_groups.csv
    ├── addon_items.csv
    ├── item_variations.csv
    ├── item_addons.csv
    └── item_variation_addons.csv
```

All files inside `customisations/` are **optional** – a restaurant can start with just `menu.csv` and add the others later.  The onboarding script will silently skip missing customisation CSVs after logging an info message.

### 2.    Shared ID conventions

| CSV column (human) | DB column                     | Rule                                      |
|--------------------|------------------------------|-------------------------------------------|
| `id`               | `external_id` (or corresponding) | must be **unique** within its entity class; lower-case, no spaces, `[a-z0-9_]+` |
| `menu_item_id`        | `MenuItem.external_id`      | references `menu.csv → id`                |
| `variation_id`     | `Variation.external_variation_id` | references `variations.csv → id`         |
| `addon_group_id`   | `AddonGroup.external_group_id` | references `addon_groups.csv → id`       |
| `addon_item_id`    | `AddonGroupItem.external_addon_id` | references `addon_items.csv → id`     |
| `item_variation_id` | `ItemVariation.external_id` | must reference `item_variations.csv → id` |

Internally, the loader prefixes every external id with `"no_pos_"` before storing it in the DB.  Example: `cheese` → `no_pos_cheese`.  This guarantees global uniqueness while keeping the raw string readable for debugging.

### 3.    CSV specs (developer view)

Only the **required** columns are enforced by validation – extra columns are ignored.

1. **variations.csv**
   ```csv
   id,name,display_name,group_name,is_active
   size_small,Small,Small,Size,true
   ```
2. **addon_groups.csv**
   ```csv
   id,name,display_name,priority,is_active
   extra_toppings,Extra Toppings,Extra Toppings,1,true
   ```
3. **addon_items.csv**
   ```csv
   addon_group_id,id,name,display_name,price,is_active,priority,tags
   extra_toppings,cheese,Cheese,Extra Cheese,50.0,true,1,"veg"
   ```
4. **item_variations.csv**
   ```csv
   id,menu_item_id,variation_id,price,is_active,priority
   pizza_margherita,pizza_margherita,size_small,299.0,true,1
   ```
5. **item_addons.csv**
   ```csv
   menu_item_id,addon_group_id,min_selection,max_selection,is_active,priority
   pizza_margherita,extra_toppings,0,3,true,1
   ```
6. **item_variation_addons.csv**
   ```csv
   item_variation_id,addon_group_id,min_selection,max_selection,is_active,priority
   pizza_margherita,extra_toppings,0,5,true,1
   ```

### 4.    Loader Workflow

1.  _Validation_
    * Use `backend/scripts/validate_customizations.py`.
    * Checks: file exists, required columns present, **id uniqueness**, referential integrity, `tags` field must be comma-separated list.
    * Stops onboarding on first error.

2.  _POSSystem bootstrap_
    ```python
    pos_system = POSSystem(name="no_pos", restaurant_id=rest.id, is_active=True)
    ```

3.  _Import order_

    1. `variations`  → `Variation`
    2. `addon_groups` → `AddonGroup`
    3. `addon_items`  → `AddonGroupItem`
    4. `item_variations` → `ItemVariation`
    5. `item_addons`     → `ItemAddon`
    6. `item_variation_addons` → `ItemVariationAddon`

4.  _Flag update_
    * After relationships are created, set `MenuItem.itemallowvariation/addon` flags via SQL `UPDATE` statements.

### 5.    Validation rules (summary)

* **IDs** must conform to regex `^[a-z0-9_]+$` and be unique per entity.
* Every foreign-key style column (`*_id`) must reference an id that exists in its parent CSV _or_ in `menu.csv`.
* Column types:
  * `is_active` – bool (`true`/`false`, case-insensitive)
  * `price` – numeric (float)
  * `priority`, `min_selection`, `max_selection` – int
  * `tags` – zero or more comma-separated strings

### 6.    Script changes required

| Area | Change |
|------|--------|
| Folder validation | accept `pos_type == "no_pos"`; require `customisations/` dir optional |
| CSV loader | new helper package `no_pos_onboarding/` with `csv_loader.py`, `processor.py`, `validator.py` |
| Main flow | branch after menu item insertion; call validator → loader → processor → flag updater |

---

**Next steps**
1.  Implement validator & loader.
2.  Update `1_onboard_restaurants.py`.
