# Front‑end Tasks – AglioApp‑v2 (Expo + Gluestack UI)

Use these bite‑sized tasks in Windsurf; tick one box at a time as you implement. All these tasks are required to build the app aglioapp-v2.

### 0. Project Setup
- [x] **Install core deps**  
      `npm i @react-navigation/native @react-navigation/native-stack zustand axios gluestack-ui nativewind @expo/vector-icons`  
      `npx expo install react-native-screens react-native-safe-area-context react-native-svg expo-barcode-scanner expo-image expo-device`
- [x] **Add NativeWind Babel plugin** – update `babel.config.js`.
- [x] **Create `tailwind.config.js`** with basic color palette.

### 1. Skeleton & Providers
- [x] **Wrap root** (`App.js`) with `NavigationContainer`, `GluestackUIProvider`.
- [x] **Create folder structure**: `screens/`, `components/`, `lib/`, `store/`.
- [x] **Add Zustand global store** (`store/index.js`) holding `sessionId`, `cart`, `filters`, `user`.

### 2. Shared Utilities
- [x] **Implement axios helper** (`lib/api.js`) with `x-session-id` interceptor.
- [x] **Centralize sessionId/cookie logic** – All sessionId and cookie management is now handled in the global store and a utility (`lib/session.js`). No session/cookie logic remains in screens. Uses `js-cookie` for web session persistence. Also filters
- [x] **Create `DesktopWarning` component** & device-check HOC.
- [x] **Respect backend base URL env var** – read `process.env.EXPO_PUBLIC_API` (or Constants.manifest.extra) in `lib/api.js`.

### 3. Components
- [x] **ItemCard.js** – reusable menu row.
- [x] **PriceTag.js** – small pill component.
- [x] **IconButton.js** – wrapper around Feather icons.
- [x] **PreviewMenu.js** – large image + description + action buttons (Add, Shortlist, Info).
- [x] **CartBar.js** – sticky bottom bar showing “Place Order (X items)” once cart length > 0.

### 4. Core Screens
- [x] **Welcome.js** – landing page reached via phone QR‑scanner; shows restaurant banner + “Order Now” CTA.
- [x] **Auth.js** – form (Name, Phone, Email, Skip); save to store ➜ Filters.
- [x] **Filters.js** – toggle veg, category chips; fetch `/categories`.
- [x] **Home.js** – three action cards → Menu / AI / Our Recs.
- [x] **Menu.js** – `FlatList` of `ItemCard`s, query `/menu`.
- [x] **Item.js** – image + details + bottom bar (Add / Shortlist / Info).
- [x] **Cart.js** – list, qty adjust, totals (cart lives in store).
- [x] **AI.js** – search bar, calls `/filtered_recommendations`.
- [x] **Success.js** – order confirmation screen.

### 5. Networking hookups
- [x] **Wire `/menu`** filters (veg, category, price_cap) from Filters screen.
- [x] **Wire `/filtered_recommendations`** with optional filters.

### 6. Polish
- [x] **Add skeleton loaders** (`expo-content-loader`) for Menu & AI. Use iconography from common e‑commerce sets (FontAwesome / MaterialIcons) for familiarity.
- [x] **Implement error toasts** (`gluestack-ui` alert) for network failures.

- [x] **Menu grouping & ItemCard UI polish**
    - Group menu items by `category_brief` in Menu screen and display using `SectionList` with concise section headers.
    - Ensure the menu list is fully scrollable.
    - Display item price fixed at the top right of each ItemCard, styled for clarity and not overlapping with the name.
    - All changes tested and visually verified per the requirements in this conversation.
    - "Add" Button on bottom right


---

### 7. Cart & Wishlist (In‑Memory Store)
- [ ] **Create `store/cart.js`**  
- [ ] **Replace all cart access**  
      - Update `screens/Menu.js`, `components/ItemCard.js`, `components/CartBar.js`, and upcoming new components to import from `store/cart.js` instead of the global store index.

### 8. UI Primitives
- [ ] **components/ui/Chip.js** – pill‑shaped filter button (`rounded-full px-3 py-1`, active uses `bg-[#3B82F6] text-white`).  
- [ ] **components/ui/Badge.js** – 20 × 20 px circle count badge (`text-xs font-bold`) – reused by `FloatingCartFab`.
- [ ] **components/ui/QtyStepper.js** – inline `−  qty  +` control; emits `onChange(newQty)`.

### 9. ItemPreviewModal
- [ ] **Component `components/ItemPreviewModal.js`**  
      - 56 vh hero image (`object-cover rounded-t-2xl`).  
      - Name + price row, description paragraph.  
      - Bottom sticky bar: **Wishlist** outline button, **Add to Cart** solid button.  
      - Close on X icon, overlay click, or `Esc`.  
      - Wire actions to `toggleWish` / `addItem`.
- [ ] **Trigger modal from Menu** – tapping anywhere on an `ItemCard` (except the inline add button).

### 10. FloatingCartFab
- [ ] **Component `components/FloatingCartFab.js`**  
      - `position:fixed; bottom:16px; left:50%; transform:translateX(-50%)`.  
      - Shows only when `cartCount > 0` and route ≠ `/cart` or `/success`.  
      - Contains “View Cart” text and Badge with `cartCount`.  
      - On click → navigate to `/cart`.

### 11. OrderPreviewScreen (`/cart`)
- [ ] **Create `screens/OrderPreview.js`** (link existing Nav stack)  
      - `FlatList` of `CartItemRow` (see next task).  
      - Sub‑total & tax placeholder under list.  
      - Green “Place Order (Coming Soon)” button → `alert('Backend integration pending')`.
- [ ] **Component `components/CartItemRow.js`**  
      - Left 48 px thumb; middle column name & price; right qty stepper + red trash icon.  
      - Uses `updateQty` / `removeItem`.

### 12. Success Screen Skeleton (`/success`)
- [ ] **Create `screens/Success.js`**  
      - Large green check icon, “Order Placed!”, small text “Show this to wait staff”.  
      - Map over last cart snapshot (pass via params) to list items.  
      - Outline “Back to Menu” button → `/`.
      - This route will be wired later once POST is added.

### 13. Responsive & Accessibility Audit
- [ ] **Audit 320 – 768 px** – ensure FAB & modals stay centred, text wraps.  
- [ ] **Add `aria-live="polite"`** to cart count Badge.  
- [ ] **Verify tap targets ≥ 44 px**; fix where needed.  
- [ ] **Colour contrast** passes WCAG AA (use Tailwind `dark:` also ties into next task).
