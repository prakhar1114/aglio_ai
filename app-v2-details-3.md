

# Ask Aglio 🍝 – Front‑End Implementation Specification  
*(Expo‑web, mobile browser)*

---

## 1 High‑level Goals

| Goal | Success signal |
|------|---------------|
| **Zero‑friction help while browsing** | User opens chat, asks “What’s pesto?”, adds a suggestion to cart, and returns to browsing without losing scroll position. |
| **Maintain visual cleanliness** | Chat FAB never overlaps the sticky **View Cart** bar; list scrolling ≥ 60 fps Lighthouse. |
| **JSON‑driven extensibility** | Any backend response following the schema renders automatically as text, cards, carousels, quick‑replies, etc. |
| **Web‑first reliability** | Works in Safari & Chrome (iOS/Android) through Expo‑web; no native‑only APIs. |

---

## 2 Libraries & Core Tech

| Area | Package | Rationale |
|------|---------|-----------|
| Bottom sheet | `@gorhom/bottom-sheet` | Best‑in‑class UX & Reanimated‑v2 web support. |
| Chat UI | `react-native-gifted-chat` | OSS, light footprint, easily customised render pipeline. |
| Icons | `@expo/vector-icons` (Ionicons) | Consistent with existing design system. |
| State / Cart | Redux / Zustand / Context (existing) | Chat adds directly to central store. |
| Styling | Tailwind via `nativewind` | Shared tokens across menu & chat. |
| Networking | `socket.io-client` (WebSockets) | Persistent connection keyed by `sessionID`; server emits JSON **blocks** on `'assistant'` event, client emits `'askAglio'`. |

---

## 3 UI Components & Layout

### 3.1 `ChatFAB`

| Prop | Spec |
|------|------|
| Size | **56 × 56 dp** circle (`rounded-full`). |
| Position | `fixed` bottom‑right, `16 dp` margin; z‑index above content but below toast layer. |
| Colour | Secondary brand `bg-primary/90`; reduce to `bg-primary/60` while user scrolls > 200 px. |
| Icon | `chatbubble-ellipses` Ionicon, 24 dp. |
| Animations | `scale(0 → 1)` on first mount; gentle *nudge* (`translateY(-4 → 0)`) after 6 s idle. |
| Accessibility | `aria-label="Chat with Aglio"`; role `button`. |

---

### 3.2 `ChatSheet`

| Feature | Spec |
|---------|------|
| Container | `<BottomSheet />` – snap points `['15%', '75%']`; closed index `-1`. |
| Header | Avatar + **Ask Aglio** text + close **✕** icon. |
| Body | `<GiftedChat />` list with `renderMessage={renderBlockMessage}`. |
| Input | TextInput, mic, emoji, **Send**; disabled whilst awaiting AI. |
| Keyboard | `keyboardBehavior="interactive"` pushes sheet above keyboard. |
| Dismiss | Swipe‑down gesture or tap ✕. |

---

### 3.3 `renderBlockMessage`

A pure function that maps `message.blocks` → React components.

Supported `type` values:

| type | Component | Intent |
|------|-----------|--------|
| `text` | `MarkdownText` | Rich text, links. |
| `dish_card` | `DishCardBlock` | Image, name, price, **Add ➕** button. |
| `dish_carousel` | `DishCarouselBlock` | Horizontal FlatList of `dish_card`. |
| `quick_replies` | `QuickReplies` | Chip buttons sending pre‑filled user text. |
| `order_summary` | `OrderSummaryBlock` | Line items + subtotal + **Checkout** CTA. |
| _default_ | `UnsupportedBlock` | Shows *Unsupported content* message. |

All blocks: `rounded-2xl`, `shadow-lg`, consistent padding.

---

## 4 Backend→Frontend Data Contract

```jsonc
{
  "id": "msg-42",
  "role": "assistant",
  "blocks": [
    { "type": "text", "markdown": "Here are two dishes you might like:" },
    {
      "type": "dish_card",
      "payload": {
        "id": "dish-91",
        "name": "Fusilli Pesto",
        "image": "https://cdn.aglio.app/fusilli.jpg",
        "price": 595,
        "tags": ["vegetarian", "basil"]
      }
    },
    {
      "type": "quick_replies",
      "options": [
        { "id": "more-veg", "label": "Show more veg" },
        { "id": "gluten-info", "label": "Is it gluten‑free?" }
      ]
    }
  ]
}
```

---

## 5 Message Flow

1. **Tap FAB** → `ChatSheet` opens at 75 % height.  
2. **User sends text** → `socket.emit('askAglio', { sessionID, text, cartSnapshot, dishContext? })`.  
3. **Backend returns blocks** → parsed & appended to GiftedChat.  
4. **User taps “Add ➕”** → dispatch `cart.addItem(id)` → cart badge updates.  
5. **Auto‑scroll** to latest after each render.  
6. **Timeout (>8 s)** → error bubble *“Hmm, that took too long…”* with retry button.  

---

## 6 Accessibility & Web Tweaks

* `role="dialog"` on BottomSheet; focus trap within sheet.  
* Each assistant message: `aria-live="polite"`.  
* Add `babel-plugin-react-native-reanimated/plugin` for web builds.  
* Disable iOS Safari double‑tap‑to‑zoom on FAB via `touch-action: manipulation`.  
* Lazy‑import chat bundle (`React.lazy`) to keep initial JS size down.

---

## 7 Performance Budget

| Metric | Target |
|--------|--------|
| Largest Contentful Paint | ≤ 2.5 s |
| JS payload added by chat (gzip) | ≤ 250 kB |
| Time to “Add via chat” | ≤ 150 ms after tap |

---

## 8 Implementation Task List

1. **Install dependencies**  
   ```bash
   expo install @gorhom/bottom-sheet react-native-gifted-chat
   yarn add @expo/vector-icons nativewind
   ```

2. **Configure Reanimated plugin** in `babel.config.js`.

3. **Create** `components/ChatFAB.tsx`.

4. **Create** `components/ChatSheet.tsx` (BottomSheet + GiftedChat).

5. **Create** `utils/blockRenderers.tsx` implementing mapping table.

6. **Add** `services/socket.ts`  
   ```ts
   import { io } from 'socket.io-client';
   export const socket = io(process.env.EXPO_PUBLIC_API_URL, { transports: ['websocket'] });

   export function askAglio(payload) {
     socket.emit('askAglio', payload);
   }
   ```
   - Reconnect with back‑off; expose `socket.on('assistant', handler)` for incoming blocks.

7. **Wire** `DishCardBlock` to central cart actions.

8. **Analytics** – send events: *fab_opened*, *message_sent*, *add_from_chat*.

9. **QA matrix** – iPhone 14 (Safari), Pixel 7 (Chrome), 320 px viewport.

10. **Accessibility audit** – VoiceOver & TalkBack passes.

---

> **Outcome:** A single, intuitive **Ask Aglio** floating chat that lets diners learn, decide, and add dishes right from the conversation—without cluttering the core browsing & cart flow.