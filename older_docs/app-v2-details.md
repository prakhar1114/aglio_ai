# AglioApp v4 – Windsurf Build Spec  
*Expo (JavaScript) + Gluestack UI layouts · FastAPI + Redis + Qdrant*

---

## 1 · Frontend  (Expo SDK ≥ 50, **pure JavaScript**)

### 1.1  Project scaffold
| Task | Choice / Rationale |
|------|-------------------|
| **Create app** | `npx create‑expo‑app aglioapp` → choose **blank (Javascript)** |
| **Navigation** | `@react-navigation/native`, `@react-navigation/native-stack` |
| **Layout kit** | **Gluestack UI** – ships Tailwind‑powered components **and** ready‑made page layouts |
| **Styling** | `nativewind` (Tailwind for RN) – Gluestack piggy‑backs on this |
| **Global state** | `zustand` (store: `session`, `cart`, `filters`, `user`) |
| **HTTP** | `axios` instance with `baseURL` env var; interceptor adds `x-session-id` |
| **QR scanner** | `expo-barcode-scanner` |
| **Device check** | `expo-device` – block desktop browsers with `<DesktopWarning />` |
| **Image caching** | `expo-image` |

<details>
<summary>Install commands</summary>

```bash
# Core
npx create-expo-app aglioapp       # choose JavaScript template
cd aglioapp
npm i @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# Gluestack + NativeWind
npm i gluestack-ui nativewind
npx expo install react-native-svg react-native-safe-area-context

# State, HTTP
npm i zustand axios

# QR + images + device
npx expo install expo-barcode-scanner expo-image expo-device
```

Add the **NativeWind** Babel plugin in `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
```
</details>

---

### 1.2  Screen flow (stack)

| # | Screen (file) | Purpose |
|---|---------------|---------|
| 0 | `screens/QRScanner.js` | scan table QR → `POST /session/start` |
| 1 | `screens/Auth.js` | Name / Phone / Email (*Skip* allowed) |
| 2 | `screens/Filters.js` | Veg toggle + category chips (`GET /categories`) |
| 3 | `screens/Home.js` | cards: **View Menu · Our Recs · Find with AI** |
| 4 | `screens/Menu.js` | `FlatList` of `ItemCard`s, sectioned by category |
| 5 | `screens/Item.js` | Large image, description, bottom bar: **Add / Shortlist / Info** |
| 6 | `screens/Cart.js` | cart lines + qty adjust + **Place Order** |
| 7 | `screens/AI.js` | search bar + vector‑search results |
| 8 | `screens/Success.js` | order confirmation |

> All screens share the same minimalist white bg; stack navigator shows a back arrow everywhere except QRScanner & Home.

---

### 1.3  Quick component examples (plain JS)

**ItemCard.js**

```jsx
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useCartStore } from '../store';

export default function ItemCard({ item }) {
  const add = useCartStore(s => s.add);
  return (
    <View className="flex-row items-center p-3 bg-white rounded-2xl shadow mb-2">
      <Image
        source={{ uri: item.image_url }}
        className="w-14 h-14 rounded-xl"
        contentFit="cover"
      />
      <View className="flex-1 px-3">
        <Text className="font-semibold">{item.name}</Text>
        <Text className="text-xs text-gray-500">{item.description}</Text>
      </View>
      <Text className="mr-2 font-semibold">₹{item.price}</Text>
      <Pressable onPress={() => add(item.id, 1)}>
        <Feather name="plus-circle" size={22} />
      </Pressable>
    </View>
  );
}
```

**API helper (`lib/api.js`)**

```js
import axios from 'axios';
import { useSessionStore } from '../store';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API,
});

api.interceptors.request.use(cfg => {
  const { sessionId } = useSessionStore.getState();
  if (sessionId) cfg.headers['x-session-id'] = sessionId;
  return cfg;
});
```

---

### 1.4  Cart & session logic

* `POST /session/start` → store `{sessionId, tableId}` in Zustand **and** `SecureStore`.
* Cart mutations (`add`, `remove`, `updateQty`) immediately `POST /cart/sync`; if offline, queue in `AsyncStorage`.

---

## 2 · Backend (FastAPI + Redis + Qdrant)

The current `backend/main.py` is the **source‑of‑truth**.  
Below is a reference of what already exists and how the front‑end must call it.

### 2.1  Service stack in use
| Layer | Role |
|-------|------|
| **FastAPI** | Implements `/recommend`, `/feedback`, `/history`, static image hosting |
| **Redis** | Stores **session preference vectors**, bandit stats and “seen” sets |
| **Qdrant** | Vector search collection `chianti_dishes` (size = 1280) |
| **Static files** | `/image_data/*` served from `raw_data/` via `StaticFiles` |

> 🗒 **No PostgreSQL or any other persistent RDBMS is required for v4.**  
> All state lives in Redis; vectors live in Qdrant. Orders are held in the client only.

### 2.2  Session identifier

*Use `session_id` everywhere.*  
The old `table_id` concept is dropped—QR scanning just generates a UUID on the client and passes it as a query param.

```mermaid
sequenceDiagram
Frontend→>Backend: GET /recommend?session_id=abc123
Backend-->>Frontend: 200 { id, name, … }
Frontend→>Backend: GET /feedback?session_id=abc123&id=42&action=maybe
```

### 2.3  Key Redis data‑structures

| Key pattern | Type | Purpose |
|-------------|------|---------|
| `vec:{session}` | STRING (bytes) | 1280‑D float32 user profile |
| `stat:{dish}`  | HASH | `reward`, `impr` counts for bandit |
| `seen:{session}` | SET | dish IDs already recommended |
| `history:{session}:{action}` | LIST | IDs user marked *maybe* / *skip* |

### 2.4  Available endpoints

| Method | Path | Query params (all include **session_id**) | Response |
|--------|------|-------------------------------------------|----------|
| **GET** | `/categories` | `session_id` | `[ { group_category, category_brief } ]` |
| **GET** | `/menu` | `session_id`, `group_category?`, `is_veg?`, `price_cap?` | `[ { id, name, description, price, veg_flag, image_url } ]` |
| **GET** | `/recommend` | `session_id`, `is_veg?`, `price_cap?` | `{ id, …payload }` |
| **GET** | `/feedback` | `session_id`, `id`, `action` (`maybe` \| `skip`) | `{ ok: true }` |
| **GET** | `/history` | `session_id` | `{ maybe: [...], skip: [...] }` |
| **GET** | `/image_data/<file>` | — | image asset |

### 2.5  Bandit & vector logic (already in `main.py`)

*   ε‑greedy Thompson sampling over beta‑posteriors (`reward`/`impr`).  
*   Preference vector update: `vec ← vec + w * dish_vec`, *w = +0.5* for “maybe”, *‑0.3* for “skip”; l2‑normalised.

Front‑end does **not** need to replicate this—just call the three endpoints above.

---

## 3 · Gluestack UI starter layouts you can lift

| Layout | File in Gluestack repo | Use in AglioApp |
|--------|-----------------------|-----------------|
| `ecommerce/ProductListing` | `packages/app/Layout/ProductListing.js` | Menu (`screens/Menu.js`) |
| `ecommerce/ProductDetails` | `ProductDetails.js` | Item preview |
| `ecommerce/Cart` | `Cart.js` | Cart screen |
| `authentication/Onboarding` | `Onboarding.js` | Auth screen |

Copy the JSX, swap data props, and fine‑tune with Tailwind classes.

---

## 4 · Hand‑off note for Windsurf

> “Generate production‑ready JavaScript Expo screens using **Gluestack UI** layouts above, wired to the FastAPI endpoints defined in the API contract.  
> Backend remains as specified in section 2.”

Happy coding! 🚀
