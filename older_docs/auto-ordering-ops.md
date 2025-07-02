# Auto‑Ordering Ops — **v1**  
*QR ordering, POS‑connected, pay‑at‑table*

---

## 0 · Scope & Core Principles
| Goal | Rule of thumb |
|------|---------------|
| **Fast first bite** | Scan → menu in \< 2 s, no typing until “Send Order”. |
| **Almost staff‑free** | Staff only use **Close**, **Restore**, and **Disable All**. |
| **Just‑enough security** | Optional daily pass protects the **order** step—not browsing. |
| **Resilient** | POS ACK/retry pipeline prevents “lost” tickets. |
| **Future‑proof** | Hooks left for beacons / online pay but hidden behind feature flags. |

---

## 1 · Entities & Data Model

| Entity | Key fields |
|--------|------------|
| **Table** | `id`, `qr_token_signed`, `status` (`enabled/disabled`) |
| **Session** | `id`, `table_id`, `created_at`, `last_activity_at`, `payment_status`, `auto_closed`, `daily_pass_required`, `pass_validated` |
| **Member** | `id`, `session_id`, `nickname`, `is_host` |
| **CartItem** | `id`, `member_id`, `menu_item_id`, `qty`, `note` |
| **DailyPass** | `word`, `hash`, `valid_until` |
| **RetryJob** | `id`, `order_payload`, `retry_count`, `next_attempt_at` |

---

## 2 · Morning Setup (≈ 1 min)

1. **Optional daily pass**  
   *Toggle*: **Settings → Require Pass**  
   – If ON, cron at 04 00 picks a random word (e.g. `latte29`), hashes & emails owner.

2. **Opening hours**  
   Define once: **08 00 – 22 30** (`BusinessHours` table).  
   Change only for holidays.

3. **Health check**  
   Dashboard badge turns **green** when POS heartbeat OK & menu synced.

---

## 3 · Guest Journey (happy path)

| Step | Guest action | System behaviour |
|------|--------------|------------------|
| 1 | **Scan QR** | `GET /t/{table_id}`<br>· Inside hours → `201 {session_id}` (auto‑creates session)<br>· Outside hours → `503 {reason:"closed"}` |
| 2 | **Browse menu** | PWA loads from cache; no prompt yet. |
| 3 | **First “Add to Cart”** | Inline nickname prompt → `POST /member` → `member_join` WS broadcast. |
| 4 | **“Send Order”** | If `daily_pass_required` & not validated → password modal (`/validate_pass`). |
| 5 | **Order fired** | `POST /orders` → **POS ACK** in ≤3 s.<br>· On ACK → broadcast `order_fired` (ticket #).<br>· On timeout → enqueue in **RetryJob** & show banner “Checking with kitchen…”. |
| 6 | **Dining** | Live KDS status over WebSocket (“Cooking”, “Ready”). |
| 7 | **Pay to staff** | Staff prints POS bill & collects money. |
| 8 | **Table close** | Staff taps **Close** *or* auto‑close watchdog after 90 min idle → `auto_closed=true`. |

---

## 4 · Late Joiner & Restore Logic

* **Join mid‑meal** → same `session_id`; live cart & status appear instantly.  
* **Find stale session (>90 min idle)** → prompt: *“Previous bill exists – Start new?”*  
  * **Start new** → closes old & spawns fresh session.  
  * **Restore** (edge case) → reopens via **FOH Restore** button.

---

## 5 · Staff Interaction Surface

| Screen | Purpose | Touches |
|--------|---------|---------|
| **Dashboard grid** | Live table states, timers, POS ticket # | • **Close** (1 tap)<br>• **Restore** (2 taps) |
| **Settings → Hours** | Open/close time (+ holidays) | Infrequent |
| **Global Kill** | **Disable QR Ordering** toggle | Emergency stop |

---

## 6 · Server Automations & Guards

| Automation | Trigger | Action |
|------------|---------|--------|
| **Auto‑close** | `idle ≥ 90 min` OR `(payment_status='settled' && idle ≥ 10 min)` | Mark `auto_closed`, broadcast `session_closed`. |
| **Opening‑hours gate** | Every `GET /t/{table_id}` | Reject outside hours (503). |
| **Daily pass rota** | 04 00 cron (if flag ON) | Replace word, email owner. |
| **POS ACK/retry** | No ACK in 3 s | Enqueue **RetryJob**, retry until success (exponential back‑off). |
| **Nightly purge** | 03 00 | Delete sessions `auto_closed && age > 24 h`. |

---

## 7 · API End‑points

```http
GET   /t/{table_id}                 # Scan → session create/lookup
WS    /ws?sess={session_id}         # Real‑time events
POST  /member                       # Join with nickname
PUT   /session/{id}/cart            # Add / edit items
POST  /session/{id}/validate_pass   # Daily pass
POST  /orders                       # Fire order (to POS)
PATCH /session/{id}/close           # Staff close
PATCH /session/{id}/restore         # Staff restore
```

---

## 8 · Pitfalls & Mitigations

| Risk | Impact | Fix |
|------|--------|-----|
| **POS API lag** | Kitchen never sees ticket | 3 s ACK watchdog + retry queue + FOH alert. |
| **Staff forget to mark “Paid”** | Auto‑close before money collected | Poll POS every 5 min; dashboard turns **amber** if unpaid > 60 min. |
| **Screenshot scanned next day** | New prank order | Opening‑hours gate + expired sessions (410 Gone). |
| **Owner forgets pass OFF** | Guests blocked next day | Daily rotation overwrites old word. |
| **First‑time menu load on bad Wi‑Fi** | Slow UX | PWA ships critical skeleton (<30 KB) + lazy‑loads menu JSON. |

---

## 9 · Glossary

* **ACK** – Positive acknowledgement (HTTP 200 + ticket number) from POS.  
* **RetryJob** – Background task holding an unsent order; retries until ACK.  
* **Auto‑close** – Server action that flags a dormant or settled session as finished.  
* **Daily pass** – Optional word (e.g. *latte29*) required to fire an order.  

---

### Ready for build
This file is your canonical reference for the first production release. Future features (BLE beacons, online payments, AI upsells) can drop in via feature flags without altering the core flow described here.
