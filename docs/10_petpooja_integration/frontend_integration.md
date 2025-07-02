# Frontend Integration Guide: PetPooja Menu & Cart System

## Overview
This guide explains how to integrate with the updated QR Menu system that supports PetPooja variations and addons. The system now includes:
- **Global variations** (reusable across items)
- **Global addon groups** (reusable across items) 
- **Item-specific pricing** and selection rules
- **Enhanced cart operations** with full variation/addon support

---

## 1. Menu API Integration

### **Menu Endpoint**
```
GET /restaurants/{restaurant_slug}/menu/
```

### **Menu Response Structure**

```typescript
interface MenuResponse {
  items: MenuItem[]
  nextCursor?: number
}

interface MenuItem {
  id: string                    // Menu item public ID
  name: string
  description?: string
  base_price: number           // Base price without variations/addons
  veg_flag: boolean
  image_url?: string
  cloudflare_image_id?: string
  cloudflare_video_id?: string
  category_brief?: string
  tags: string[]
  is_bestseller: boolean
  variation_groups: VariationGroup[]
  addon_groups: AddonGroup[]
}

interface VariationGroup {
  group_name: string           // "Size", "Quantity", etc.
  display_name: string         // Human-readable group name
  variations: Variation[]
}

interface Variation {
  id: number                   // ItemVariation ID (use for cart operations)
  name: string                 // "Small", "Large", "3 Pieces"
  display_name: string
  price: number                // Absolute price (not modifier)
  group_name: string
  tags: string[]
}

interface AddonGroup {
  id: number                   // AddonGroup ID
  name: string                 // "Extra Toppings", "Add Beverage"
  display_name: string
  min_selection: number        // Minimum addon selections required
  max_selection: number        // Maximum addon selections allowed
  addons: AddonItem[]
}

interface AddonItem {
  id: number                   // AddonGroupItem ID (use for cart operations)
  name: string                 // "Cheese", "Bacon", "Mojito"
  display_name: string
  price: number                // Addon price (added to final price)
  tags: string[]               // ["veg"], ["non-veg"], ["egg"], etc.
}
```

### **Frontend Implementation Example**

```typescript
// Fetch menu data
const menuResponse = await fetch(`/restaurants/${restaurantSlug}/menu/`, {
  headers: {
    'x-session-id': sessionId
  }
});

const menu: MenuResponse = await menuResponse.json();

// Process menu items
menu.items.forEach(item => {
  console.log(`Item: ${item.name} - Base Price: ₹${item.base_price}`);
  
  // Handle variations (only if item has variations)
  if (item.variation_groups.length > 0) {
    item.variation_groups.forEach(group => {
      console.log(`  ${group.display_name}:`);
      group.variations.forEach(variation => {
        console.log(`    ${variation.name} - ₹${variation.price}`);
      });
    });
  }
  
  // Handle addons (only if item has addons)
  if (item.addon_groups.length > 0) {
    item.addon_groups.forEach(group => {
      console.log(`  ${group.display_name} (${group.min_selection}-${group.max_selection}):`);
      group.addons.forEach(addon => {
        console.log(`    ${addon.name} - ₹${addon.price}`);
      });
    });
  }
});
```

### **Key Points for Frontend:**

1. **No `is_active` field**: Only active items are returned
2. **Variations only if allowed**: Check `variation_groups.length > 0`
3. **Addons only if allowed**: Check `addon_groups.length > 0` 
4. **Absolute pricing**: `variation.price` is the final price, not a modifier
5. **Selection validation**: Respect `min_selection`/`max_selection` for addons

---

## 2. Cart WebSocket Integration

### **WebSocket Connection**
```typescript
const wsUrl = `wss://your-domain/ws/${sessionId}/${memberPid}?token=${jwtToken}`;
const ws = new WebSocket(wsUrl);
```

### **Cart Mutation Events**

#### **Create Cart Item (with variations & addons)**
```typescript
interface CartCreateEvent {
  op: "create"
  tmpId: string                // Frontend temporary ID
  menu_item_id: string         // Menu item public ID
  qty: number
  note: string
  selected_item_variation_id?: number    // ItemVariation ID from menu
  selected_addons: AddonSelection[]
}

interface AddonSelection {
  addon_group_item_id: number  // AddonGroupItem ID from menu
  quantity: number             // Addon quantity (1-n)
}

// Example: Add pizza with size variation and toppings
const createEvent: CartCreateEvent = {
  op: "create",
  tmpId: "temp_123",
  menu_item_id: "pizza_456",
  qty: 2,
  note: "Extra spicy",
  selected_item_variation_id: 789,  // Large size
  selected_addons: [
    { addon_group_item_id: 101, quantity: 1 },  // Cheese
    { addon_group_item_id: 102, quantity: 2 }   // Jalapenos x2
  ]
};

ws.send(JSON.stringify(createEvent));
```

#### **Update Cart Item (Quantity & Notes Only)**
```typescript
interface CartUpdateEvent {
  op: "update"
  public_id: string            // Cart item public ID
  version: number              // Current item version
  qty: number                  // New quantity
  note: string                 // Updated note
  // Note: Variations/addons cannot be updated with this operation
}

const updateEvent: CartUpdateEvent = {
  op: "update",
  public_id: "ci_abc123",
  version: 2,
  qty: 3,
  note: "Make it less spicy"
};

ws.send(JSON.stringify(updateEvent));
```

#### **Replace Cart Item (Change Variations/Addons)**
```typescript
interface CartReplaceEvent {
  op: "replace"
  public_id: string            // Existing cart item public ID
  version: number              // Current item version
  menu_item_id: string         // Menu item public ID (can be same or different)
  qty: number                  // New quantity
  note: string                 // New note
  selected_item_variation_id?: number    // New variation selection
  selected_addons: AddonSelection[]      // New addon selections
}

// Example: Change pizza from Large to Medium and update toppings
const replaceEvent: CartReplaceEvent = {
  op: "replace",
  public_id: "ci_abc123",      // Existing cart item ID
  version: 2,                  // Current version
  menu_item_id: "pizza_456",   // Same menu item
  qty: 2,                      // Updated quantity
  note: "Less spicy",          // Updated note
  selected_item_variation_id: 790,  // Medium size (changed from Large)
  selected_addons: [
    { addon_group_item_id: 101, quantity: 2 },  // Double cheese (increased)
    { addon_group_item_id: 103, quantity: 1 }   // Added mushrooms (new)
  ]
};

ws.send(JSON.stringify(replaceEvent));
```

#### **Delete Cart Item**
```typescript
interface CartDeleteEvent {
  op: "delete"
  public_id: string
  version: number
}

const deleteEvent: CartDeleteEvent = {
  op: "delete",
  public_id: "ci_abc123",
  version: 2
};

ws.send(JSON.stringify(deleteEvent));
```

### **Cart Update Responses**

```typescript
interface CartUpdateResponse {
  type: "cart_update"
  op: "create" | "update" | "delete"
  item: CartItemResponse
  tmpId?: string               // Only for create operations
}

// Replace operation sends ONE update event:
// - Same cart item ID with updated variations/addons and incremented version
```

interface CartItemResponse {
  public_id: string
  member_pid: string
  menu_item_pid: string
  name: string
  base_price: number           // Original menu item price
  final_price: number          // Including variations and addons
  qty: number
  note: string
  version: number
  image_url?: string
  cloudflare_image_id?: string
  cloudflare_video_id?: string
  veg_flag: boolean
  selected_variation?: SelectedVariation
  selected_addons: SelectedAddon[]
}

interface SelectedVariation {
  item_variation_id: number
  variation_name: string       // "Large", "3 Pieces"
  group_name: string          // "Size", "Quantity"
  price: number               // Absolute price
}

interface SelectedAddon {
  addon_group_item_id: number
  name: string                // "Cheese", "Mojito"
  price: number               // Unit price
  quantity: number            // Selected quantity
  total_price: number         // price * quantity
  addon_group_name: string    // "Extra Toppings", "Add Beverage"
  tags: string[]              // ["veg"], ["non-veg"], etc.
}
```

### **Error Handling**

```typescript
interface CartErrorResponse {
  type: "error"
  code: string
  detail: string
  currentItem?: any           // For version conflicts
}

// Common error codes:
// - "menu_item_not_found"
// - "invalid_variation" 
// - "invalid_addon"
// - "addon_not_allowed"
// - "version_conflict"
// - "item_not_editable"
// - "not_authorised"

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === "error") {
    console.error(`Cart error: ${data.code} - ${data.detail}`);
    
    if (data.code === "version_conflict") {
      // Refresh cart or show conflict resolution UI
      refreshCartData();
    }
  }
};
```

---

## 3. Frontend Implementation Patterns

### **Menu Item Selection Component**

```typescript
interface MenuItemState {
  selectedVariation?: number
  selectedAddons: Map<number, number>  // addon_id -> quantity
  totalPrice: number
}

function calculatePrice(
  item: MenuItem, 
  selectedVariation?: number,
  selectedAddons: Map<number, number>
): number {
  let price = item.base_price;
  
  // Apply variation price (absolute, not additive)
  if (selectedVariation) {
    const variation = findVariationById(item.variation_groups, selectedVariation);
    if (variation) {
      price = variation.price;  // Replace base price
    }
  }
  
  // Add addon prices
  selectedAddons.forEach((quantity, addonId) => {
    const addon = findAddonById(item.addon_groups, addonId);
    if (addon) {
      price += addon.price * quantity;
    }
  });
  
  return price;
}

function validateSelections(
  item: MenuItem,
  selectedAddons: Map<number, number>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate addon group constraints
  item.addon_groups.forEach(group => {
    const groupSelections = group.addons
      .map(addon => selectedAddons.get(addon.id) || 0)
      .reduce((sum, qty) => sum + qty, 0);
    
    if (groupSelections < group.min_selection) {
      errors.push(`${group.name}: Select at least ${group.min_selection} items`);
    }
    
    if (groupSelections > group.max_selection) {
      errors.push(`${group.name}: Select at most ${group.max_selection} items`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}

function handleVariationAddonChange(
  cartItem: CartItemResponse,
  newSelectedVariation?: number,
  newSelectedAddons: Map<number, number> = new Map()
) {
  // Use replace operation when variations or addons change
  const replaceEvent: CartReplaceEvent = {
    op: "replace",
    public_id: cartItem.public_id,
    version: cartItem.version,
    menu_item_id: cartItem.menu_item_pid,
    qty: cartItem.qty,  // Keep existing quantity
    note: cartItem.note, // Keep existing note
    selected_item_variation_id: newSelectedVariation,
    selected_addons: Array.from(newSelectedAddons.entries()).map(([id, qty]) => ({
      addon_group_item_id: id,
      quantity: qty
    }))
  };
  
  // Send to WebSocket
  ws.send(JSON.stringify(replaceEvent));
}
```

### **Cart State Management (Redux Example)**

```typescript
interface CartState {
  items: CartItemResponse[]
  members: MemberInfo[]
  orders: any[]
  cart_version: number
}

// Action creators
const addToCart = (
  menuItemId: string,
  qty: number,
  note: string,
  selectedVariation?: number,
  selectedAddons: AddonSelection[] = []
) => ({
  type: 'CART_ADD_ITEM',
  payload: {
    op: 'create',
    tmpId: generateTempId(),
    menu_item_id: menuItemId,
    qty,
    note,
    selected_item_variation_id: selectedVariation,
    selected_addons: selectedAddons
  }
});

const replaceCartItem = (
  cartItem: CartItemResponse,
  qty: number,
  note: string,
  selectedVariation?: number,
  selectedAddons: AddonSelection[] = []
) => ({
  type: 'CART_REPLACE_ITEM',
  payload: {
    op: 'replace',
    public_id: cartItem.public_id,
    version: cartItem.version,
    menu_item_id: cartItem.menu_item_pid,
    qty,
    note,
    selected_item_variation_id: selectedVariation,
    selected_addons: selectedAddons
  }
});

// WebSocket middleware
const cartWebSocketMiddleware: Middleware = (store) => (next) => (action) => {
  if (action.type.startsWith('CART_')) {
    // Send to WebSocket
    websocket.send(JSON.stringify(action.payload));
  }
  
  return next(action);
};

// Reducer
const cartReducer = (state: CartState, action: any): CartState => {
  switch (action.type) {
    case 'CART_UPDATE_RECEIVED':
      const { op, item, tmpId } = action.payload;
      
      switch (op) {
        case 'create':
          return {
            ...state,
            items: [...state.items, item]
          };
          
        case 'update':
          return {
            ...state,
            items: state.items.map(cartItem => 
              cartItem.public_id === item.public_id ? item : cartItem
            )
          };
          
        case 'delete':
          return {
            ...state,
            items: state.items.filter(cartItem => 
              cartItem.public_id !== item.public_id
            )
          };
      }
      break;
  }
  
  return state;
};

// Note: Replace operations send ONE update event:
// - Same cart item ID with updated configuration and incremented version
// - Frontend handles this as a normal update operation
```

---

## 4. Cart Snapshot API Integration

### **Cart Snapshot Endpoint**
```
GET /cart_snapshot?session_pid={sessionId}
Authorization: Bearer {jwtToken}
```

### **Use Cases:**
- **Page reload**: Hydrate cart state from server
- **Error recovery**: Refresh cart after WebSocket errors
- **Conflict resolution**: Get latest cart state after version conflicts

### **Implementation:**
```typescript
async function loadCartSnapshot(): Promise<CartState> {
  const response = await fetch(`/cart_snapshot?session_pid=${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to load cart snapshot');
  }
  
  return await response.json();
}

// Use on app initialization
useEffect(() => {
  loadCartSnapshot()
    .then(snapshot => {
      dispatch(setCartState(snapshot));
    })
    .catch(error => {
      console.error('Failed to load cart:', error);
    });
}, []);
```

---

## 5. Cart Operation Guidelines

### **When to Use Each Operation**

| Operation | Use Case | What Changes |
|-----------|----------|--------------|
| **Create** | Add new item to cart | New menu item with variations/addons |
| **Update** | Change quantity or notes only | `qty`, `note` fields only |
| **Replace** | Change variations or addons | Atomic update of `selected_item_variation_id`, `selected_addons`, can also change `qty`, `note`, even `menu_item_id` |
| **Delete** | Remove item from cart | Item removed completely |

### **Important Rules**

1. **Different variations = Different cart items**: A "Large Pizza" and "Medium Pizza" should be separate cart items
2. **Different addons = Different cart items**: "Pizza + Cheese" and "Pizza + Mushrooms" should be separate cart items  
3. **Same item, same variations/addons = Update quantity**: If user adds same configuration, increase quantity of existing item
4. **Changing variations/addons = Replace operation**: Use replace to atomically swap old configuration with new one

### **Frontend Logic Example**

```typescript
function addOrUpdateCart(
  menuItem: MenuItem,
  qty: number,
  note: string,
  selectedVariation?: number,
  selectedAddons: AddonSelection[] = []
) {
  const existingItem = findMatchingCartItem(
    menuItem.id, 
    selectedVariation, 
    selectedAddons
  );
  
  if (existingItem) {
    // Same configuration exists - update quantity
    updateCartItem(existingItem.public_id, existingItem.qty + qty, note, existingItem.version);
  } else {
    // New configuration - create new cart item
    addItemToCart(menuItem, qty, note, selectedVariation, selectedAddons);
  }
}

function changeItemConfiguration(
  cartItem: CartItemResponse,
  newSelectedVariation?: number,
  newSelectedAddons: AddonSelection[] = []
) {
  // Always use replace for configuration changes
  replaceCartItem(
    cartItem,
    cartItem.qty,  // Keep same quantity
    cartItem.note, // Keep same note
    newSelectedVariation,
    newSelectedAddons
  );
}
```

---

## 6. Key Integration Points

### **Price Display**
```typescript
// Menu: Show base price with variation options
<div className="price">
  {selectedVariation ? (
    <span>₹{selectedVariation.price}</span>
  ) : (
    <span>₹{item.base_price}</span>
  )}
</div>

// Cart: Show price breakdown
<div className="cart-item-price">
  <div>Base: ₹{item.base_price}</div>
  {item.selected_variation && (
    <div>Size ({item.selected_variation.variation_name}): ₹{item.selected_variation.price}</div>
  )}
  {item.selected_addons.map(addon => (
    <div key={addon.addon_group_item_id}>
      {addon.name} x{addon.quantity}: ₹{addon.total_price}
    </div>
  ))}
  <div className="final-price">Total: ₹{item.final_price}</div>
</div>
```

### **Validation & UX**
- **Disable add to cart** until required variations are selected
- **Show addon constraints** (min/max selections) clearly
- **Handle version conflicts** gracefully with refresh options
- **Show loading states** during WebSocket operations
- **Validate selections** before sending cart mutations

### **Error Recovery**
- **WebSocket disconnection**: Attempt reconnection with exponential backoff
- **Version conflicts**: Show current item state and allow user choice
- **Invalid selections**: Clear invalid state and show error messages
- **Network errors**: Queue operations and retry when connection restored

---

## 7. Testing Checklist

### **Menu Integration**
- [ ] Menu loads with variations and addons
- [ ] Only items with `variation_groups.length > 0` show variation UI
- [ ] Only items with `addon_groups.length > 0` show addon UI
- [ ] Price calculations work correctly for all combinations
- [ ] Validation prevents invalid addon selections

### **Cart Operations**
- [ ] Create cart item with variations and addons
- [ ] Update cart item quantity and notes (variations/addons unchanged)
- [ ] Replace cart item with different variations/addons
- [ ] Delete cart items
- [ ] Handle version conflicts gracefully
- [ ] WebSocket reconnection works
- [ ] Cart snapshot hydration works
- [ ] Different variations/addons create separate cart items
- [ ] Same variations/addons update existing cart item quantity

### **Price Calculations**
- [ ] Base price displayed correctly
- [ ] Variation price replaces base price (not additive)
- [ ] Addon prices are additive
- [ ] Final price calculation is accurate
- [ ] Cart totals match individual item calculations

This frontend integration guide ensures smooth integration with the new PetPooja-based menu and cart system! 🚀 