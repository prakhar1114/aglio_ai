# Backend Tasks – Aglio v2 API Expansion

The following bite‑sized tasks can be picked up one after another.  
Check them off as you complete each one.
Codebase Structure:
main.py: contains app
urls/: all new routes defined here, files to be created when needed so that the code is easy to navigate.

- [X] **Create `Category` schema** – Pydantic model with `group_category: str`, `category_brief: str`.
- [X] **Write helper `get_all_categories()`** that queries Qdrant for unique `(group_category, category_brief)` pairs.
- [X] **Add `GET /categories` route**  
      *Params:* `session_id` (str, required)  
      *Response:* `list[Category]`.
- [X] **Create `MenuItem` schema** – mirrors payload: `id, name, description, price, veg_flag, image_url`.
- [X] **Add `GET /menu` route**  
      *Params:* `session_id` (required) + optional `group_category`, `is_veg`, `price_cap`  
      *Logic:* vectorless filter query against Qdrant; returns `list[MenuItem]`.
- [ ] **Add `/filtered_recommendations` route** – supersedes old `/recommend`; requires `session_id` and supports optional `is_veg`, `price_cap`, `group_category` filters.
- [ ] **Update inline docs & tests** for all new endpoints (including `/filtered_recommendations`).
- 

---

## 2 Real‑time Chat API (WebSocket)

> Introduce a Socket.IO channel for the **Ask Aglio** AI assistant.  
> These tasks complement the REST endpoints above and must be completed before FE phase‑2 QA.

### 2.1 Dependencies & App bootstrap
- [X] **Add Socket.IO‑ASGI**  
      ```bash
      poetry add python-socketio[asgi]  # or pip
      ```
- [X] **Wrap FastAPI app** in `socketio.AsyncServer` with CORS origins `["https://aglio.app", "http://localhost:8081"]`.
- [X] **Mount** the Socket.IO ASGI app at `/ws` while keeping REST routes intact.

### 2.2 Connection Handshake
- [X] **Validate `sessionId`** query param during `connect`.  
      - Reject connection (`disconnect()`) if missing / unknown.  
      - Store mapping `{ sid → sessionId }` in an in‑memory dict (use Redis in prod).

### 2.3 Client → Server Events
| Event | Payload | Mandatory keys | Optional |
|-------|---------|----------------|----------|
| `askAglio` | JSON object | `sessionId` (str), `text` (str) | `cart` (array of `{id, qty}`), `filters` (dict), `dishContext` (str) |

- [X] **`askAglio` handler**  
      1. Log payload (`logger.info`).  
      2. Call `generate_blocks(text, cart, filters, dishContext)` → returns `list[Block]`.  
      3. `emit('assistant', { "blocks": blocks })` **only to requesting sid**.  
      4. If generation > 8 s, emit `assistant_error`.

### 2.4 Server → Client Events
| Event | Structure | Notes |
|-------|-----------|-------|
| `assistant` | `{ "blocks": [Block, …] }` | Each block follows the schema below. |
| `typing` | `{ "status": "on" \| "off" }` | Optional; FE shows typing indicator. |
| `assistant_error` | `{ "message": str }` | Human‑readable error (timeout, rate‑limit). |

#### 2.4.1 **Block Schema**
```jsonc
{
  "type": "dish_card" | "text" | "dish_carousel" | "quick_replies" | "order_summary",
  "markdown?": "When type == text",
  "payload?": { /* type‑specific data */ },
  "options?": [ { "id": "str", "label": "str" } ] // quick_replies
}
```

### 2.5 Error & Disconnect Handling
- [X] Emit `assistant_error` when OpenAI/LLM fails.  
- [X] On `disconnect`, cleanup `sid → sessionId` map.

### 2.6 Unit & Integration Tests
- [ ] **tests/test_ws.py** using `socketio.AsyncClient`  
      - Successful `connect` with valid `sessionId`.  
      - `askAglio` returns `assistant` with ≥ 1 block.  
      - Invalid `sessionId` causes disconnect (code 400x).  
      - Timeout path returns `assistant_error`.

### 2.7 Documentation
- [ ] Update `/docs` (FastAPI Swagger) with a “WebSocket” section referencing:  
      - URL: `wss://api.aglio.app/ws`  
      - Events and payload samples.  
      - Block schema definition (link to FE spec).

> **Exit Criteria:** FE can open the socket, emit `askAglio`, receive `assistant` and render blocks with <200 ms median latency on LAN.