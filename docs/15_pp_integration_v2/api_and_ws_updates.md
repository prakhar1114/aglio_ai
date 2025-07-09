# API & WebSocket Update Guide – Variation-Specific Add-Ons

> **Goal**  
> Full backend support for *variation-specific* add-ons (PetPooja style) while remaining 100 % backwards-compatible for items that only use base-item add-ons.

This document is the **single source of truth** for implementing the remaining code changes.  Pass it to any engineer (or to ChatGPT) and they’ll have all the context they need – no additional history required.

---
## 1  New Schema Recap

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `item_variation_addons` | Junction: **ItemVariation ←→ AddonGroup** (selection rules) | `item_variation_id`, `addon_group_id`, `min_selection`, `max_selection` |
| `cart_item_variation_addons` | **Selected** add-on items that belong to a specific variation inside a cart item | `cart_item_id`, `item_variation_id`, `addon_item_id`, `quantity` |

`CartItem` now has two relationships:
```python
selected_addons              # → CartItemAddon  (base-item add-ons)
selected_variation_addons    # → CartItemVariationAddon (variation add-ons)
```

Business rules:
1. If an `ItemVariation` has add-on groups (`item_variation_addons`) → those groups **override** the base-item groups.
2. If no variation or variation without add-ons → fall back to base-item groups.
3. A cart item **never** stores the same add-on in both tables.

---
## 2  Endpoints & Handlers to Update

| File | Function | What Changes |
|------|----------|--------------|
| `backend/urls/menu.py` | `read_menu`, `read_menu_item` | Expose `addon_groups` *per variation*.<br>Keep existing base `addon_groups` as fallback. |
| `backend/urls/cart.py` | `get_cart_snapshot` | Return **two** arrays: `selected_addons` (base) and `selected_variation_addons` (variation). |
| `backend/urls/session_ws.py` | `handle_cart_mutation` | Validation logic chooses target table (`CartItemAddon` vs `CartItemVariationAddon`) when creating or replacing items. |
| "same" | `handle_place_order` | Price builder must aggregate from both add-on tables. |
| `backend/urls/session_ws.py` | `handle_cart_mutation` (update/replace) | On *variation change* DELETE stale `CartItemVariationAddon` rows before inserting new ones. |
| `backend/urls/admin/dashboard.py` | `get_session_details` | Include both addon sources so admin UI displays accurate selections. |

### 2.1  read_menu & read_menu_item (REST)
**File:** `backend/urls/menu.py`

1. **Query additions**  
```python
joinedload(MenuItem.item_variations)
  .joinedload(ItemVariation.variation_addons)
  .joinedload(ItemVariationAddon.addon_group)
  .joinedload(AddonGroup.addon_items)
```
2. **Response structure**  
Each `VariationResponse` gains optional `addon_groups: List[AddonGroupResponse]`.
3. **Builder logic**  
```python
if item_variation.variation_addons:      # override
    groups = build_groups_from_item_variation(item_variation)
else:                                    # fallback
    groups = base_item_addon_groups
```
4. **Pydantic additions**  
Add a new field in `VariationResponse`:
```python
addon_groups: List[AddonGroupResponse] = []
```
(Leave default empty → keeps old clients working.)

### 2.2  get_cart_snapshot (REST)
**File:** `backend/urls/cart.py`

Changes:
```jsonc
{
  "selected_item_variation_id": 12,
  "selected_addons": [ ... ],                  // base-item addons
  "selected_variation_addons": [ ... ]         // variation-specific addons
}
```
Implementation:
```python
variation_addons = [
    build_addon_json(va) for va in cart_item.selected_variation_addons
]
base_addons = [
    build_addon_json(a) for a in cart_item.selected_addons
]
```

### 2.3  handle_cart_mutation (WS)
**File:** `backend/urls/session_ws.py`

#### Create / Replace path
```python
# Determine allowed addon groups
allowed_groups = (
    variation_groups if variation_has_override else base_item_groups
)
validate_addons(requested_addons, allowed_groups)

if variation_has_override:
    # → CartItemVariationAddon
else:
    # → CartItemAddon
```
*On replace*: if `selected_item_variation_id` changes → delete **all** existing add-ons (`CartItemAddon`, `CartItemVariationAddon`) and insert fresh set.

#### Update path (qty / note only) – unchanged.

### 2.4  handle_place_order (WS)
**File:** `backend/urls/session_ws.py`

1. **Price calculation**  
```python
addons = item.selected_variation_addons or item.selected_addons
```
2. **Payload generation** – same list key `selected_addons` to keep the external contract; populate from whichever list was used.

### 2.5  get_session_details (Admin REST)
Show the merged addon list (same rule as order payload).

---
## 3  Shared Helper – addon utils
Create `backend/utils/addon_helpers.py`:
```python
def resolve_addon_context(cart_item: CartItem):
    """Return (addons, source_type) where source_type is 'variation' or 'base'."""
```
Used by price builder, snapshot API, and admin API.

---
## 4  Frontend Contract Summary
No breaking changes; just **two enhancements**:
1. Menu/Item API → variation objects may include `addon_groups`.
2. Cart snapshot → additional array `selected_variation_addons`.

When editing a cart item:
```ts
const addonsForUI = selectedVariationAddonArray.length > 0
    ? selectedVariationAddonArray
    : selectedAddonArray;        // fallback
```

---
## 5  Migration Notes
Run `alembic` (or equivalent) migration:
```sql
CREATE TABLE cart_item_variation_addons (
    id SERIAL PRIMARY KEY,
    cart_item_id        INT NOT NULL REFERENCES cart_items(id)   ON DELETE CASCADE,
    item_variation_id   INT NOT NULL REFERENCES item_variations(id) ON DELETE CASCADE,
    addon_item_id       INT NOT NULL REFERENCES addon_group_items(id),
    quantity            INT DEFAULT 1,
    UNIQUE(cart_item_id, item_variation_id, addon_item_id)
);
CREATE INDEX ix_civa_cart_item_id ON cart_item_variation_addons(cart_item_id);
```
No data migration needed – existing rows stay in `cart_item_addons`.

---
## 6  Testing Matrix
| Scenario | Expectation |
|----------|-------------|
| Item with base add-ons only | Add/edit works, `CartItemAddon` rows created |
| Item with variation add-ons | Add/edit works, only `CartItemVariationAddon` rows created |
| Change variation in edit flow | Old variation add-ons auto-deleted, new ones validated |
| Order placement | Payload reflects correct add-ons and final price |
| Admin dashboard | Shows correct add-ons |

Automate with Pytest fixtures + websocket test client.

---
## 7  File Reference Cheat-Sheet
| File | Change Type |
|------|-------------|
| `backend/models/schema.py` | (Done) added CartItemVariationAddon & relationship |
| `backend/urls/menu.py` | Update builders + Pydantic models |
| `backend/urls/cart.py` | Snapshot response fields |
| `backend/urls/session_ws.py` | cart mutation logic, order price logic |
| `backend/urls/admin/dashboard.py` | session details logic |
| `backend/utils/addon_helpers.py` | new shared helper |

---
**End of spec.**  Implement these steps and variation-specific add-ons will work seamlessly across the system. 🎉
