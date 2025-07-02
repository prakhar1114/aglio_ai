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
- [x] **Implement Upsell Recommendations**
      - Create API endpoint in backend (`GET /upsell`) that receives sessionId, cart, and filters
      - Create frontend API function to fetch upsell recommendations from the store data
      - Add modal in OrderPreview screen that shows after 5 seconds or when placing an order
      - Display recommendation details and provide user action options

- [x] **Menu grouping & ItemCard UI polish**
    - Group menu items by `category_brief` in Menu screen and display using `SectionList` with concise section headers.
    - Ensure the menu list is fully scrollable.
    - Display item price fixed at the top right of each ItemCard, styled for clarity and not overlapping with the name.
    - All changes tested and visually verified per the requirements in this conversation.
    - "Add" Button on bottom right


---

### 7. Cart & Wishlist (In‑Memory Store)
- [x] **Create `store/cart.js`**  
- [x] **Replace all cart access**  
      - Update `screens/Menu.js`, `components/ItemCard.js`, `components/CartBar.js`, and upcoming new components to import from `store/cart.js` instead of the global store index.

### 8. UI Primitives
- [x] **components/ui/Chip.js** – pill‑shaped filter button (`rounded-full px-3 py-1`, active uses `bg-[#3B82F6] text-white`).  
- [x] **components/ui/Badge.js** – 20 × 20 px circle count badge (`text-xs font-bold`) – reused by `FloatingCartFab`.
- [x] **components/ui/QtyStepper.js** – inline `−  qty  +` control; emits `onChange(newQty)`.

### 9. ItemPreviewModal
- [x] **Component `components/ItemPreviewModal.js`**  
      - 56 vh hero image (`object-cover rounded-t-2xl`).  
      - Name + price row, description paragraph.  
      - Bottom sticky bar: **Wishlist** outline button, **Add to Cart** solid button.  
      - Close on X icon, overlay click, or `Esc`.  
      - Wire actions to `toggleWish` / `addItem`.
- [x] **Trigger modal from Menu** – tapping anywhere on an `ItemCard` (except the inline add button).

### 10. FloatingCartFab
- [x] **Component `components/FloatingCartFab.js`**  
      - `position:fixed; bottom:16px; left:50%; transform:translateX(-50%)`.  
      - Shows only when `cartCount > 0` and route ≠ `/cart` or `/success`.  
      - Contains “View Cart” text and Badge with `cartCount`.  
      - On click → navigate to `/cart`.

### 11. OrderPreviewScreen (`/cart`)
- [x] **Create `screens/OrderPreview.js`** (link existing Nav stack)  
      - `FlatList` of `CartItemRow` (see next task).  
      - Sub‑total & tax placeholder under list.  
      - Green “Place Order (Coming Soon)” button → `alert('Backend integration pending')`.
- [x] **Component `components/CartItemRow.js`**  
      - Left 48 px thumb; middle column name & price; right qty stepper + red trash icon.  
      - Uses `updateQty` / `removeItem`.

### 12. Success Screen Skeleton (`/success`)
- [x] **Create `screens/Success.js`**  
      - Large green check icon, “Order Placed!”, small text “Show this to wait staff”.  
      - Map over last cart snapshot (pass via params) to list items.  
      - Outline “Back to Menu” button → `/`.
      - This route will be wired later once POST is added.

### 13. Responsive & Accessibility Audit
- [x] **Audit 320 – 768 px** – ensure FAB & modals stay centred, text wraps.  
- [x] **Add `aria-live="polite"`** to cart count Badge.  
- [x] **Verify tap targets ≥ 44 px**; fix where needed.  
- [x] **Colour contrast** passes WCAG AA (use Tailwind `dark:` also ties into next task).

### 14. Ask Aglio Chat Module  (phase‑2)

> Bring the AI chatbot (“Ask Aglio”) into the Expo‑web build.  
> All tasks below are **new**—leave boxes unchecked until complete.

- [x] **Install chat & socket deps**  
      `expo install @gorhom/bottom-sheet react-native-reanimated`  
      `npm i react-native-gifted-chat socket.io-client`
- [x] **Add Reanimated plugin** to `babel.config.js` (below nativewind):  
      `plugins: ['nativewind/babel', 'react-native-reanimated/plugin']`

#### 14.2 Core Components
- [x] **components/ChatFAB.js**  
      - 56×56 dp circular FAB (`rounded-full bg-primary/90`) positioned `fixed bottom‑right 16`.  
      - Shows Ionicon `chatbubble-ellipses` 24 dp.  
      - Animations: mount spring; 6 s idle nudge.  
      - Hide on `/cart` & `/success`.
- [x] **components/ChatSheet.js**  
      - Wrap `<BottomSheet>` with snap points `['15%', '75%']`, index `-1`.  
      - Header: avatar + “Ask Aglio” + ✕ icon.  
      - Body: `<GiftedChat>`; pass `renderMessage={renderBlockMessage}`.  
      - Input toolbar: text field, emoji, mic, Send; disable while loading.  
      - `onClose` sets sheet index to `-1`.

#### 14.3 Block Rendering Pipeline
- [x] **utils/blockRenderers.js**  
      - Export `renderBlockMessage(message)` that iterates `message.blocks`.  
      - `type` → component map: `text`, `dish_card`, `dish_carousel`, `quick_replies`, `order_summary`.  
      - Fallback component prints “Unsupported content”.
- [x] **components/blocks/DishCardBlock.js**  
      - Accepts `{ id, name, price, image }`.  
      - Mirrors `ItemCard` look; includes **Add ➕** which dispatches `cart.addItem(id)`.
- [x] **components/blocks/QuickReplies.js** – horizontal chip list; tap sends user message.

#### 14.4 WebSocket Networking
- [x] **lib/socket.js**  
      ```javascript
      import { io } from 'socket.io-client';

      export const socket = io(process.env.EXPO_PUBLIC_API_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => console.log('WS connected', socket.id));

      export function askAglio(payload) {
        // payload = { sessionId, text, cartSnapshot, dishContext? }
        socket.emit('askAglio', payload);
      }

      export function onAssistant(callback) {
        socket.on('assistant', callback); // { blocks: [...] }
      }

      export function closeSocket() {
        socket.disconnect();
      }
      ```
      - Include `sessionId` from store in every payload.
      - Handle `socket.on('disconnect')` to show offline toast.
      - Reconnect automatically (see options above).

#### 14.5 Integration
- [x] **Hook ChatFAB** into `screens/Menu.js` (and any future screens needing help).  
- [x] **Subscribe** to `onAssistant` in `ChatSheet`; append incoming messages to GiftedChat.
- [x] Provide `cartSnapshot` + optional `dishContext` to `askAglio()` on send.  
- [x] Auto‑scroll GiftedChat after new assistant message.

#### 14.6 Analytics
- [x] Fire events via `lib/analytics.js`: `fab_opened`, `message_sent`, `add_from_chat`.

#### 14.7 Accessibility & QA
- [x] `aria-label="Chat with Aglio"` on FAB; `role="dialog"` on sheet.  
- [x] `aria-live="polite"` on assistant bubbles.  
- [x] Manual QA on iPhone 14 Safari, Pixel 7 Chrome, 320 px viewport.

#### 14.8 Performance & Lazy‑loading
- [x] Code‑split chat bundle with `React.lazy` + Suspense fallback loader.  
- [x] Verify Lighthouse JS delta ≤ 250 kB (gzip).

---
