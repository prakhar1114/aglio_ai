

# AglioApp v2 – Front‑End Specification (Mobile Web, Front‑End‑Only)

> **Purpose**  
> This document is the single source of truth for the current UI/UX scope. It feeds the future `FEtasks.md` task board. For now **all order‑placement APIs are stubbed** – no network calls are made.

---

## 1 · Global State (Zustand – in‑memory)

| Key            | Type                                | Notes |
|----------------|-------------------------------------|-------|
| `items`        | `Array<{ id, name, price, img, qty }>` | Cart line items |
| `wishlist`     | `string[]`                          | Meal IDs |
| `addItem`      | `(meal, qty?:1)`                    | Merge if already present |
| `removeItem`   | `(mealId)`                          | – |
| `updateQty`    | `(mealId, qty)`                     | – |
| `toggleWish`   | `(mealId)`                          | – |
| `clearCart`    | `()`                                | – |
| **Selectors**  | `cartCount`, `cartTotal`            | Computed |

---

## 2 · Route Map

| Path      | Screen                | Visible FAB | Backend |
|-----------|-----------------------|-------------|---------|
| `/`       | **MenuScreen**        | ✔︎ (if cart) | — |
| `/cart`   | **OrderPreviewScreen**| ✘           | — |
| `/success`| **OrderPlacedScreen** | ✘           | **stubbed – will not be linked yet** |

Routing via **React Router DOM** (expo‑router web alias).

---

## 3 · Components

### 3.1 MealItemCard
- 64 × 64 px thumbnail, bold name, grey description, right‑aligned **“＋”** button.  
- Entire card (except button) opens **ItemPreviewModal**.

### 3.2 ItemPreviewModal
| Region | Details |
|--------|---------|
| Hero   | `object-fit:cover; height:56vh; border‑radius:16px 16px 0 0;` |
| Body   | Name (lg/semibold)  ·  Price (lg/semibold, right)  ·  Full description (sm, grey‑600) |
| Actions| Sticky bottom bar: outline **Wishlist** + solid **Add to Cart** |

Dismiss: X icon, overlay click, *Esc* key.

### 3.3 FloatingCartFab
- CSS:  
  `position:fixed; bottom:16px; left:50%; transform:translateX(-50%);`
- Hidden when `cartCount === 0` **or** on `/cart` & `/success`.
- Inner layout: “View Cart” + badge with count.

### 3.4 CartItemRow
- Used inside *OrderPreviewScreen*.  
- Left: 48 px thumb   ·  Middle: name + price   ·  Right: qty stepper (`− 1 +`) + red trash icon.

---

## 4 · Screens

### 4.1 MenuScreen ( `/` )
- Category filter chips (scrollable x‑axis).
- List of `MealItemCard`.
- Renders `<FloatingCartFab />`.

### 4.2 OrderPreviewScreen ( `/cart` )
- `FlatList` of `CartItemRow`.
- Sub‑total & tax placeholder under list.
- **Primary CTA**: disabled‑for‑now green button  
  “Place Order (Coming Soon)” → shows toast/alert *“Backend integration pending.”*

### 4.3 OrderPlacedScreen ( `/success` )
_Not wired until backend exists. Keep component scaffolded for future._

---

## 5 · Styling Tokens

| Token      | Value  | Usage |
|------------|--------|-------|
| Primary    | `#3B82F6` | Buttons, active chips |
| Danger     | `#EF4444` | Delete actions |
| Success    | `#16A34A` | Future order placed |
| Surface    | `#FFFFFF` | Cards & backgrounds |
| Radius     | `16px`   | Cards, modals, buttons |
| Shadow     | `0 4px 12px rgba(0,0,0,0.08)` | Cards, FAB |

Typography scales: `lg (18)`, `base (16)`, `sm (14)`, `xs (12)`.  
Animations: pure‑CSS `transition:all 0.2s ease-out`.

---

## 6 · Accessibility
1. Minimum touch target 44 × 44 px.  
2. `aria-live="polite"` on cart count updates.  
3. High‑contrast colour pairs pass WCAG AA.

---

## 7 · Task Backlog (will feed *FEtasks.md*)

| Order | Epic | Tasks |
|-------|------|-------|
| 1 | **State Layer** | Cart store, selectors |
| 2 | **Routing** | Configure three routes & layout |
| 3 | **UI Primitives** | Chip, Badge, QtyStepper |
| 4 | **MealItemCard** | Card layout + add button |
| 5 | **ItemPreviewModal** | Modal, wishlist, add logic |
| 6 | **FloatingCartFab** | FAB, show/hide logic |
| 7 | **OrderPreviewScreen** | List, subtotal, disabled CTA |
| 8 | **(Optional) Success Screen** | Skeleton component |
| 9 | **Responsive Audit** | 320 – 768 px |
|10 | **Accessibility Audit** | aria labels, contrast |

---

### 8 · Out‑of‑Scope (for now)

- Any network I/O (order posting, auth, payments).  
- Native‑only UX (gesture handlers, haptic feedback).
