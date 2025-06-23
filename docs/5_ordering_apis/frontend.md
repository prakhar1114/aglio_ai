# Front‑End Design – Shared Cart & Real‑Time Sync  
*(React 18 + Zustand + Existing Architecture)*

This document shows exactly **how to structure components, store slices, and
WebSocket glue** so that the customer PWA satisfies the back‑end contract
defined in `backend.md` + `table_session_api_and_ws.md`.

---

## 0. Library choices & Current Architecture

* **Zustand** – global store (already in use).  
* **Existing WebSocket** – extend current connection.js WebSocket handling
* **Existing Session Store** – extend session.js for cart-related session state
* **Current Cart Store** – completely refactor cart.js for shared cart functionality
* **Existing Password Modal** – PasswordValidationModal.jsx already implemented

---

## 1. File Structure Reorganization

### 1.1 Suggested Core Package Structure

```
qrmenu/packages/core/src/
├── store/
│   ├── cart.js (refactor existing)
│   └── session.js (extend existing)  
├── connection.js (move from utils/)
├── api/
│   ├── base.js (existing)
│   ├── menu.js (existing) 
│   └── cart.js (new)
├── utils/
│   └── aiResponses.js (existing)
└── index.js
```

**Rationale**: Move `connection.js` out of utils since it's a core functionality, not a utility helper.

---

## 2. Updated Store Architecture

### 2.1 Enhanced Cart Store (`qrmenu/packages/core/src/store/cart.js`)

```js
// Completely refactor existing cart.js
export interface CartItem {
  public_id: string;      // Cart item public ID from backend  
  member_pid: string;     // Who added this item
  menu_item_pid: string;  // Menu item public ID
  name: string;           // Item name (for display)
  qty: number;
  note: string;
  version: number;        // For optimistic locking
  tmpId?: string;         // Temporary ID while optimistic
}

export interface Member {
  member_pid: string;
  nickname: string;
  is_host: boolean;
}

export interface CartState {
  // Cart data
  items: CartItem[];
  members: Member[];
  orders: any[];          // Future: completed orders
  cart_version: number;   // Overall cart version
  
  // UI state
  isPasswordRequired: boolean;
  pendingMutations: CartMutateMsg[];
  
  // Existing AI chat state (keep as is)
  chatMessages: any[];
  isChatTyping: boolean;
  isAIChatDrawerOpen: boolean;
  
  // Cart methods
  addItemOptimistic: (menuItem: any, qty: number, note: string) => void;
  updateItemOptimistic: (public_id: string, qty: number, note: string, version: number) => void;
  deleteItemOptimistic: (public_id: string, version: number) => void;
  
  // Real-time sync methods
  applyCartUpdate: (update: CartUpdateEvent) => void;
  handleCartError: (error: CartErrorEvent) => void;
  
  // Cart snapshot loading
  loadCartSnapshot: (snapshot: CartSnapshotResponse) => void;
  
  // Password & queue methods  
  setPasswordRequired: (required: boolean) => void;
  queueMutation: (mutation: CartMutateMsg) => void;
  flushPendingMutations: () => CartMutateMsg[];
  
  // Utility methods
  getItemsByMember: () => Record<string, CartItem[]>;
  canEditItem: (item: CartItem, currentMemberPid: string, isHost: boolean) => boolean;
  getTotalAmount: () => number;
  getCartHash: () => string;
  
  // Keep existing AI methods unchanged
  addChatMessage: (message: any) => void;
  setChatTyping: (typing: boolean) => void;
  // ... etc
}
```

### 2.2 Enhanced Session Store (`qrmenu/packages/core/src/store/session.js`)

```js
// Add to existing session store:
export interface SessionState {
  // ... existing session fields ...
  
  // Cart-related session state (already partially implemented)
  sessionValidated: boolean;  // Whether daily password was entered
  
  // Methods to add:
  setSessionValidated: (validated: boolean) => void;
  isPasswordRequired: () => boolean;
}
```

---

## 3. Component Updates

### 3.1 CartDrawer (`qrmenu/packages/ui/src/components/CartDrawer.jsx`)

**Major Refactor Required:**

```jsx
export function CartDrawer({ isOpen, onClose, onCheckout }) {
  const { items, members, addItemOptimistic, updateItemOptimistic, deleteItemOptimistic } = useCartStore();
  const { memberPid, isHost, sessionValidated } = useSessionStore();
  
  // Group items by member
  const itemsByMember = useCartStore(state => state.getItemsByMember());
  
  // Calculate totals
  const subtotal = useCartStore(state => state.getTotalAmount());
  
  const handleQtyChange = (item, newQty) => {
    if (!useCartStore.getState().canEditItem(item, memberPid, isHost)) {
      // Show error toast
      return;
    }
    updateItemOptimistic(item.public_id, newQty, item.note, item.version);
  };
  
  const handleDelete = (item) => {
    if (!useCartStore.getState().canEditItem(item, memberPid, isHost)) {
      return;
    }
    deleteItemOptimistic(item.public_id, item.version);
  };
  
  return (
    <div className="cart-drawer">
      {/* Header */}
      <div className="header">
        <h2>Shared Cart ({items.length} items)</h2>
        <button onClick={onClose}>×</button>
      </div>
      
      {/* Cart Items - Grouped by Member */}
      <div className="cart-items">
        {Object.entries(itemsByMember).map(([memberPid, memberItems]) => {
          const member = members.find(m => m.member_pid === memberPid);
          const canEdit = memberPid === currentMemberPid || isHost;
          
          return (
            <div key={memberPid} className="member-section">
              <div className="member-header">
                <span className="nickname">{member?.nickname || 'Unknown'}</span>
                {member?.is_host && <span className="host-badge">HOST</span>}
              </div>
              
              {memberItems.map(item => (
                <div key={item.public_id} className="cart-item">
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    {item.note && <p className="note">{item.note}</p>}
                  </div>
                  
                  <div className="item-controls">
                    {canEdit ? (
                      <QtyStepperControls 
                        qty={item.qty}
                        onIncrease={() => handleQtyChange(item, item.qty + 1)}
                        onDecrease={() => handleQtyChange(item, item.qty - 1)}
                        onDelete={() => handleDelete(item)}
                      />
                    ) : (
                      <span className="qty-display">Qty: {item.qty}</span>
                    )}
                  </div>
                  
                  <div className="item-price">
                    ₹{(item.price * item.qty).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      
      {/* Order Summary & Checkout */}
      <div className="footer">
        <div className="total">Total: ₹{subtotal.toFixed(2)}</div>
        <button 
          onClick={() => onCheckout?.(items, subtotal)}
          disabled={items.length === 0}
        >
          Place Order
        </button>
      </div>
    </div>
  );
}
```

### 3.2 Password Validation Integration

**✅ Already Implemented**: `PasswordValidationModal.jsx` exists and is properly implemented with:
- Form handling and validation
- Loading states  
- Error handling
- Integration with session store
- Success feedback via modal system

**Integration Required**: Add to main app component where cart operations are attempted:

```jsx
// In MenuScreen.jsx or main app component
import { PasswordValidationModal } from '@qrmenu/ui';

function MenuScreen() {
  const { isPasswordRequired } = useCartStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  useEffect(() => {
    if (isPasswordRequired) {
      setShowPasswordModal(true);
    }
  }, [isPasswordRequired]);
  
  return (
    <>
      {/* existing menu content */}
      
      <PasswordValidationModal 
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          useCartStore.getState().setPasswordRequired(false);
        }}
      />
    </>
  );
}
```

---

## 4. Enhanced Connection Layer

### 4.1 Extend Connection Handler (`qrmenu/packages/core/src/connection.js`)

**Add cart snapshot loading to existing setupConnection function:**

```js
export async function setupConnection(location) {
  console.log('Setting up connection...');
  
  // ... existing session setup code ...
  
  try {
    // Create table session
    console.log('Creating table session...');
    const result = await createTableSession(tablePid, token, sessionStore.deviceId);
    
    if (result.success) {
      // Store session data
      sessionStore.setSessionData(result.data);
      sessionStore.persistSession();
      sessionStore.setConnectionStatus('open');
      
      // Set table number from API response
      if (result.data.table_number) {
        sessionStore.setTableNumber(result.data.table_number);
      }
      
      console.log('Session created, setting up WebSocket...');
      
      // Setup WebSocket connection
      sessionStore.setWsStatus('connecting');
      setupWebSocket(result.data.session_pid, result.data.ws_token);
      
      // 🆕 Load cart snapshot after session is established
      console.log('Loading cart snapshot...');
      try {
        await loadCartSnapshot(result.data.session_pid, result.data.ws_token);
        console.log('Cart snapshot loaded successfully');
      } catch (cartError) {
        console.error('Failed to load cart snapshot:', cartError);
        // Don't fail the entire connection for cart issues
      }
      
      return { 
        success: true, 
        sessionData: result.data 
      };
    }
    
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Add to existing handleWebSocketMessage function:**

```js
function handleWebSocketMessage(data) {
  const sessionStore = useSessionStore.getState();
  const cartStore = useCartStore.getState();
  
  switch (data.type) {
    // ... existing cases ...
    
    case 'cart_update':
      console.log('Cart update received:', data);
      cartStore.applyCartUpdate(data);
      break;
      
    case 'error':
      // Handle cart-specific errors
      if (data.code === 'pass_required') {
        cartStore.setPasswordRequired(true);
        cartStore.queueMutation(data.original);
      } else if (data.code === 'version_conflict') {
        cartStore.handleCartError(data);
      } else {
        // Handle other errors as before
        console.error('WebSocket error event:', data);
        sessionStore.showModal({
          type: 'error',
          title: 'Connection Error',
          message: data.detail || 'An error occurred with the connection',
        });
      }
      break;
      
    default:
      console.log('Unknown WebSocket message type:', data.type);
  }
}
```

### 4.2 Cart Mutation Helpers

**Add to connection.js:**

```js
export function sendCartMutation(mutation) {
  const wsConnection = useSessionStore.getState().wsConnection;
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(mutation));
  } else {
    console.error('WebSocket not connected');
  }
}

export function addItemToCart(menuItem, qty = 1, note = '') {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  // Check if password validation is required
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Generate temporary ID for optimistic update
  const tmpId = crypto.randomUUID();
  
  // Apply optimistic update
  cartStore.addItemOptimistic(menuItem, qty, note, tmpId);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'create',
    tmpId,
    menu_item_id: menuItem.public_id,
    qty,
    note
  };
  
  sendCartMutation(mutation);
}

export function updateCartItem(public_id, qty, note, version) {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Apply optimistic update
  cartStore.updateItemOptimistic(public_id, qty, note, version);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'update',
    public_id,
    qty,
    note,
    version
  };
  
  sendCartMutation(mutation);
}

export function deleteCartItem(public_id, version) {
  const cartStore = useCartStore.getState();
  const sessionStore = useSessionStore.getState();
  
  if (sessionStore.isPasswordRequired() && !sessionStore.sessionValidated) {
    cartStore.setPasswordRequired(true);
    return;
  }
  
  // Apply optimistic update
  cartStore.deleteItemOptimistic(public_id, version);
  
  // Send WebSocket mutation
  const mutation = {
    op: 'delete',
    public_id,
    version
  };
  
  sendCartMutation(mutation);
}
```

---

## 5. New Cart API Layer

### 5.1 Create Cart API (`qrmenu/packages/core/src/api/cart.js`)

```js
import { getBaseApiCandidates } from './base.js';

export async function loadCartSnapshot(sessionPid, wsToken) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const url = `${baseUrl}/cart_snapshot?session_pid=${sessionPid}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${wsToken}`
        }
      });
      
      if (response.ok) {
        const snapshot = await response.json();
        console.log('Cart snapshot loaded:', snapshot);
        return { success: true, data: snapshot };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.log(`Cart snapshot failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

export async function submitOrder(items, payMethod, cartHash, sessionPid, wsToken) {
  const candidates = getBaseApiCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const orderItems = items.map(item => ({
        public_id: item.public_id,
        qty: item.qty
      }));
      
      const url = `${baseUrl}/orders`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wsToken}`
        },
        body: JSON.stringify({
          session_pid: sessionPid,
          items: orderItems,
          pay_method: payMethod,
          cart_hash: cartHash
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Order submitted successfully:', result);
        return { success: true, data: result };
      } else {
        const error = await response.json();
        if (error.code === 'cart_mismatch') {
          return { success: false, cartMismatch: true, cartSnapshot: error.cart_snapshot };
        }
        throw new Error(error.detail);
      }
    } catch (error) {
      console.log(`Order submission failed with ${baseUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}
```

---

## 6. Integration with Existing Menu Components

### 6.1 ItemCard Updates

**Update existing ItemCard to use new cart functions:**

```jsx
// In existing ItemCard component
import { addItemToCart } from '@qrmenu/core/connection';

const handleAddToCart = () => {
  addItemToCart(item, 1, ''); // item, qty, note
};
```

### 6.2 MenuScreen Integration

**✅ Already Handled**: Cart snapshot loading is now integrated into the existing `setupConnection` function, so no additional changes needed in MenuScreen.

---

## 7. Implementation Priority

### Phase 1: File Reorganization & Store Refactor
1. **Move** `connection.js` from `utils/` to root of core package
2. **Create** `api/cart.js` for cart-specific API calls
3. **Refactor** `cart.js` store with new data structure
4. **Extend** `session.js` with cart-related session state

### Phase 2: WebSocket & API Integration  
1. **Extend** WebSocket message handling in `connection.js`
2. **Add** cart snapshot loading to `setupConnection`
3. **Implement** cart mutation helpers in `connection.js`
4. **Add** cart API functions

### Phase 3: UI Updates
1. **Refactor** `CartDrawer.jsx` with member grouping
2. **Integrate** existing `PasswordValidationModal.jsx`
3. **Update** `ItemCard` components to use new cart functions

### Phase 4: Order Flow
1. **Implement** order submission flow
2. **Add** cart hash validation
3. **Handle** cart mismatch scenarios

### Phase 5: Error Handling & Polish
1. **Add** comprehensive error handling
2. **Implement** retry mechanisms
3. **Add** loading states and user feedback

This implementation builds on existing components (like the already-implemented PasswordValidationModal) and extends the current architecture rather than replacing it, ensuring backward compatibility with existing AI chat features while adding comprehensive shared cart functionality.