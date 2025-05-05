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
- [ ] **Ensure dark‑mode compatibility** via NativeWind `dark:` classes.

- [x] **Menu grouping & ItemCard UI polish**
    - Group menu items by `category_brief` in Menu screen and display using `SectionList` with concise section headers.
    - Ensure the menu list is fully scrollable.
    - Display item price fixed at the top right of each ItemCard, styled for clarity and not overlapping with the name.
    - All changes tested and visually verified per the requirements in this conversation.
    - "Add" Button on bottom right


