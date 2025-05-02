

# Product Requirements Document (PRD)  
**Project Code‑name:** AglioApp MVP  
**Last update:** 2 May 2025  

---

## 1  |  Executive Summary  
AglioApp turns the full, often overwhelming à‑la‑carte menu at medium‑size restaurants into a lightning‑fast, phone‑first discovery experience. Diners scan a table‑specific QR code, answer up to three conversational filters, swipe through a reduced **Menu Sweep**, and finish with a shortlist they can show the waiter.  

### Core Innovations  
1. **Hybrid Recommender** – **Thompson Sampling (personal relevance) + Maximal Marginal Relevance (diversity)** to build small, varied recommendation packs that always feel fresh yet tailored.  
2. **Accelerating Progress Meter** – a non‑linear “% Complete” badge that races to 100 % once the system has collected *enough* feedback, nudging diners toward the shortlist faster than a raw item counter.  
3. **Zero‑POS Pilot** – for the MVP we skip kitchen/POS integration; the app simply produces an on‑screen order list the guest shows staff.

---

## 2  |  Goals & Success Metrics  

| Objective | KPI | Target |
|-----------|-----|--------|
| Reduce decision fatigue | **Median time** scan → final list | **< 90 s** |
| Validate recommendation value | **Sweep→Shortlist conversion** | **≥ 50 %** |
| Encourage exploratory orders | **Dish‑diversity Gini** vs. paper menu | **< 0.6** |
| Confirm usability | Post‑meal emoji poll (1‑5) | **≥ 4.2** |

---

## 3  |  Target Context  

* **Restaurant fit:** 25–60 dish menus, casual/premium‑casual (Italian, Asian fusion, sushi, tapas).  
* **Diner persona:** 24‑45 yr, phone‑native, enjoys exploring full menu, often vegan/veg/flexitarian.  

---

## 4  |  End‑to‑End User Journey  

| Stage | Surface (React Native Web) | Key Interaction |
|-------|---------------------------|-----------------|
| 1. QR Landing | Logo + Start | Reads `table_id` param; fetches menu vectors |
| 2. Chat Filter (≤ 30 s) | Chat sheet | Category → Diet → Price (chips + slider). “Skip chat” link available |
| 3. Menu Sweep | Swipe cards | **Skip ✕ / Maybe 👀**; **% Complete** badge accelerates (see §6) |
| 4. Drawer Prompt | Mini badge pulses | Fires after ≥ 3 Maybes **OR** `progress >= 80 %` |
| 5. Shortlist Modal | Maybes + 2 wild‑cards | Checkbox items → **Place Order** |
| 6. Show Waiter | Order list view | Guest shows phone; staff confirms verbally |
| 7. Feedback Ping (+15 min) | Toast 👍/👎 | Closes loop for TS posteriors |

---

## 5  |  Functional Requirements  

| # | Requirement | Priority |
|---|-------------|----------|
| F‑1 | Table‑QR deep‑link ingestion (`?table=##`). | Must |
| F‑2 | Conversational filter with chips; max 3 questions. | Must |
| F‑3 | Hybrid TS + MMR recommender (Algorithm §7). | Must |
| F‑4 | Non‑linear % Complete indicator (UX §6). | Must |
| F‑5 | Mini‑drawer showing current shortlist count. | Must |
| F‑6 | Shortlist modal with add/remove & “Place Order”. | Must |
| F‑7 | POST `/order` saves JSON list; renders printable view. | Must |
| F‑8 | Event logging (`app_open`, `skip`, `maybe`, `order_submitted`). | Must |
| F‑9 | Full‑menu fallback link. | Should |
| F‑10 | Basic admin endpoint `/orders?table_id=`. | Should |

---

## 6  |  UX & Visual Design  

### Brand Tokens  
| Token | Value |
|-------|-------|
| Primary | `#2E2B2B` |
| Accent | `#E23E57` |
| BG‑light | `#F7F7F7` |
| Font‑head | Montserrat Bold 24 px |
| Font‑body | Inter Regular 16 px |

### Accelerating % Complete  
\[
\text{display %} = 
\begin{cases}
\frac{100 \times f}{F_{target}}, & f < F_{target} \\
100, & f \ge F_{target}
\end{cases}
\]  
where `F_target = max(6,\;0.25 × deck_size)` and `f = maybe_count + skip_count`. After roughly six interactions, the badge leaps toward 100 %, signalling “almost done.”

### Key Components  

| Component | Style / Motion |
|-----------|----------------|
| Chat Chips | 32 px height, radius 16 px, Tailwind `shadow-sm`, press scale 0.96 |
| Dish Card | 3:2 image, 16 px padding, Skip/Maybe bar; Framer Motion spring swipe |
| Progress Badge | Top‑center; charcoal bg, white text; updates every event |
| Mini‑Drawer | 40 px pill at bottom; accent badge; slide‑up + bounce |
| Shortlist Modal | Full‑width sheet; Tailwind `rounded-2xl shadow` |

Accessibility: 44 px touch targets; color contrast ≥ 4.5:1; `aria-label` on buttons.

---

## 7  |  Algorithm Design  

### 7.1 Thompson Sampling  
*Per‑user, per‑dish* Beta(α, β) posterior in Redis.  
* On **Maybe** or **Order** → `α += 1`  
* On **Skip** → `β += 1`

### 7.2 Candidate Sampling  
1. Draw reward `r_i ~ Beta(α_i, β_i)` for each unseen dish.  
2. Keep **top 50** dishes by `r_i`.

### 7.3 MMR Re‑rank  
For pack size `k = 3` (tunable):  
```
score_i = λ · r_i − (1−λ) · max_cosine(i, S)
```
where `S` = already‑chosen dishes, cosine uses 50‑d embeddings from Qdrant, λ ≈ 0.6.

### 7.4 Shortlist Wild‑cards  
When opening the shortlist, compute one extra 3‑dish pack; show the two highest‑score dishes not in the Maybe list.

Latency budget: **< 120 ms** per pack.

---

## 8  |  System Architecture  

| Layer | Tech |
|-------|------|
| **Frontend** | Expo React Native Web (Windsurf) |
| **Backend** | FastAPI, Redis (session + TS), Qdrant Cloud (vectors) |
| **Data** | Postgres `dishes` table (id, name, category, diet, price, img_url, vec JSON) |
| **Endpoints** | `GET /menu`, `GET /recommend`, `POST /event`, `POST /order`, `GET /orders` |
| **Analytics** | PostHog Cloud |

Deployment: FastAPI on Fly.io/Render; Expo static PWA on Vercel. Environment file `.env` holds `REDIS_URL`, `QDRANT_URL`, `POSTHOG_KEY`.

---

## 9  |  KPIs & Instrumentation  

* **decision_time** = `order_submit_ts – qr_scan_ts`  
* **sweep_to_shortlist_rate** = `shortlist_open / menu_sweep_start`  
* **conversion_rate** = `orders / app_open`  
* **duplicate_style_per_pack** (λ tuning)  
* **user_satisfaction** via emoji toast (👍/👎 mapped to 1‑5)

---

## 10  |  Out of Scope  

* POS or kitchen ticket integration  
* Group payments  
* Allergy database  
* Push notifications beyond in‑session toast  
* Accounts & loyalty

---

## 11  |  Timeline  

| Week | Milestone |
|------|-----------|
| 0 | Wireframes, theme tokens |
| 1 | ChatFilter + FastAPI skeleton |
| 2 | TS+MMR endpoint; Menu Sweep UI |
| 3 | Accelerating progress, analytics, order view |
| 4 | QR stickers, staff training, soft launch |
| 5 | Pilot data review |

---

## 12  |  Project Skeleton (Windsurf)  

```
AglioApp/
├─ frontend/        # Expo project
│   ├─ App.tsx
│   ├─ screens/
│   ├─ components/
│   └─ tailwind.config.js
├─ backend/
│   ├─ main.py      # FastAPI root
│   ├─ recommender/
│   │   ├─ thompson.py
│   │   └─ mmr.py
│   └─ db/
│       └─ dishes.sql
├─ .env.example
└─ README.md
```