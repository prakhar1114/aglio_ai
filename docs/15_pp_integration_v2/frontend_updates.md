
---

## 8. Variation-Specific Add-Ons – End-to-End Front-End Design  
*(works with back-end spec in `docs/15_pp_integration_v2/api_and_ws_updates.md`)*

### 8.1 Back-End Contract Recap

```
GET /restaurants/:slug/menu/          → Variation objects may contain addon_groups
GET /cart_snapshot?session_pid=...    → Each cart item now returns
                                        ● selected_addons               (base-item)
                                        ● selected_variation_addons     (variation-override)

WebSocket – cart_mutate / place_order → Payload still sends ONE array called
                                        selected_addons.  Server decides the
                                        correct table based on whether the
                                        selected variation has its own addon
                                        groups.
```

Rules:
1. If a variation defines addon groups → those **override** base groups.
2. When hydrating cart items, the front-end should expose only **one** array –
   `selected_addons` – choosing `selected_variation_addons` when present and
   falling back to base.

### 8.2 Utility Helper (core)

File `qrmenu/packages/core/src/utils/addonHelpers.js`
```js
// Returns [addonGroups, isVariationOverride]
export function getActiveAddonGroups(menuItem, selectedVariationId) {
  // 1️⃣ Look for the chosen variation and check if it carries addon_groups
  if (selectedVariationId && menuItem.variation_groups) {
    for (const vg of menuItem.variation_groups) {
      const v = vg.variations.find(varn => varn.id === selectedVariationId);
      if (v && v.addon_groups && v.addon_groups.length > 0) {
        return [v.addon_groups, true]; // variation override
      }
    }
  }
  // 2️⃣ Fallback to base-item addon groups
  return [menuItem.addon_groups || [], false];
}
```

### 8.3 `ItemCustomisations.jsx`
Path `qrmenu/packages/ui/src/components/ItemCustomisations.jsx`

1. **State** – add `const [activeAddonGroups, setActiveAddonGroups] = useState([])`.
2. **Effect** – on mount & whenever `selectedVariationId` changes:
```js
const [groups, override] = getActiveAddonGroups(menuItem, customisationData.selectedVariationId);
setActiveAddonGroups(groups);
```
3. **Rendering** – replace `menuItem.addon_groups?.map(...)` with
   `activeAddonGroups.map(...)`.
4. **Editing flow** – when opened in "replace" mode hydrate:
```js
selectedVariationId : existingItem.selected_variation?.item_variation_id || null
selectedAddons      : existingItem.selected_variation_addons?.length > 0
                      ? existingItem.selected_variation_addons
                      : existingItem.selected_addons
```

### 8.4 `confirmCustomisation()` (core/connection.js)
No payload changes – continue sending `selected_addons` array produced from UI.

### 8.5 Cart Store Changes (`qrmenu/packages/core/src/store/cart.js`)

* **Hydration (loadCartSnapshot & applyCartUpdate)**
```js
item.selected_addons = item.selected_variation_addons?.length
  ? item.selected_variation_addons
  : item.selected_addons;
```
* **getItemAddonsText / price helpers** already reference `selected_addons`, so
  no further refactor needed.

### 8.6 Display Components

* **CartDrawer.jsx** – wherever add-ons are shown, rely on the merged
  `selected_addons` field (no conditional checks needed).
* **MyOrdersDrawer / OrderConfirmation** – same rule when you surface past
  orders.

### 8.7 Menu Store (`qrmenu/packages/core/src/store/menu.js`)
`useMenu` already caches the full menu response; variation objects now include
`addon_groups`, so no extra changes – just be sure to persist the new field in
cache.

### 8.8 Testing Matrix (Front-End)
| Scenario | Expected Behaviour |
|----------|--------------------|
| Item with base add-ons only | Add/edit flows show base groups; server stores in `CartItemAddon`. |
| Item with variation add-ons | UI shows override groups; server stores in `CartItemVariationAddon`. |
| Switching variation in edit | Add-on UI re-renders with new groups and clears previous selections. |
| Cart snapshot reload | Store hydrates items with correct merged `selected_addons`. |
| Order placement | Price & payload built from the correct add-on list. |

---

**Implementation Checklist (incremental):**
1. Create `utils/addonHelpers.js` and export `getActiveAddonGroups`.
2. Wire helper into `ItemCustomisations.jsx`.
3. Update cart-hydration logic in `cart.js`.
4. Verify CartDrawer renders add-ons after editing and after full reload.
5. Add unit tests for helper + hydration.

This closes the front-end gap for variation-specific add-ons without breaking
existing flows.  Hand this document to any engineer (or ChatGPT) and they can
implement the feature end-to-end with no further context.