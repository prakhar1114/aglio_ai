<file name=0 path=/Users/prakharjain/code/aglio_ai/ordering_ops_design.md>Backend interface to create a QR code menu with a signed table number in the body:
- select the cafe
- enter the url
- enter the table number: X 

This generated the QR code (encoded restaurant name and table number in the body)

Scanning this, opens the url and sets the table number and restaurant correctly
The table number is visible in "My Table" available from the bottom bar (call My Order -> My Table)
- remove the criterion of visibility to be just (number of orders placed)
- On the top it should mention "Table Number: X"
- Below it, X members joined: in the beginning it should be one
- Session expiring in y minutes 
- all orders will also show up as people place orders

Scanning the QR code:

## State 0
- GET /is_open call
    - body:
        - table_number
    - response:
        - 200: OK - State 1
        - 403: restaurant not open right now (EXIT STATE)
        - 423: table disabled

## State 1
- allows to show the menu
- sets the table number visible in My Table
- in the background:
    - create websocket connection
    - POST /table/create_session: get or create a session
        - force = True/False
    - response:
        - 201: new created
            - sets sessionId
        - 200: Found an existing table (returns a sessionId (older)):
            - ask the user to join the party at the existing table
                - set the sessionId
            - new one with force=True in the body
                - this returns a 201 with the sessionId, sets it
    - after the sessionId exists: State 2
| **1 Issue** | When `POST /table/create_session` returns a `sessionId`, it also returns a **`ws_token`** (JWT). | Signed with HMAC‑SHA256; TTL = 3 h. |
| **2 Open** | Browser opens `wss://table/ws?sess={sessionId}` with HTTP header `Authorization: Bearer {ws_token}`. | Keeps URL clean; works behind most proxies. |

```jsonc
{
  "sub": "memberId‑xyz",
  "name": <randomly generate a name like animals cutecat, tinytiger etc>
  "sid": "sessionId‑abc123",
  "tbl": 7,
  "table_name": "<something>",
  "iat": 1718802912,
  "exp": 1718910000
}
```
Front‑end stores the `ws_token` in `sessionStorage` so it survives a page reload during the same tab.




## State 2
- GET /table_session_details:
    - sessionId
- response:
    - number of users
    - names of each user
    - current cart (split user wise)
    - events, examples: (as a ordered list)
        - "AnonymousPanda" joined the party
    (This should just be notifications of people in the party)

- Create a wss connection
    - for further events
    - cart updates

can update: orders, cart, maintain users

Users can:
- Rename themselves
- edit their own cart
- place a group order




# Specs
Table Session:
- states: active, closed or expired
- model fields
    - state
    - manual_closed (default to False)
    - created_at
    - last_activity_at
    - table_number
    - extension_time: default to 0
    - restaurant_name: FK
- autoexpires after 30 (x can be set, might be useful to keep it small like 30 minutes and final bill creation done at the end) minutes of inactivity: state becomes 
- staff needs to close it after payment is done **


## WebSocket Authentication (`ws_token`)

| Step | Action | Notes |
|------|--------|-------|
| **1 Issue** | When `POST /table_session` returns a `sessionId`, it also returns a **`ws_token`** (JWT). | Signed with HMAC‑SHA256; TTL = 3 h. |
| **2 Open** | Browser opens `wss://api…/ws?sess={sessionId}` with HTTP header `Authorization: Bearer {ws_token}`. | Keeps URL clean; works behind most proxies. |
| **3 Verify** | Server validates signature + `exp`, checks `sid` claim matches the URL `sess`. | If invalid → `close(4003,"auth failed")`. |
| **4 Refresh** | If token is near expiry (`< 15 min`), client silently calls `POST /session/{id}/token_refresh` to get a new one, then reconnects. | Keeps long meals alive. |

**JWT claims**

```jsonc
{
  "sub": "memberId‑xyz",
  "sid": "sessionId‑abc123",
  "tbl": 7,
  "iat": 1718802912,
  "exp": 1718910000
}
```
Front‑end stores the `ws_token` in `sessionStorage` so it survives a page reload during the same tab.

---

## Real‑time Cart Operations over WebSocket

### Message → Server  (`cart_mutate`)

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"cart_mutate"` | Constant |
| `op`   | `"create" \| "update" \| "delete"` | Verb |
| `tmpId`| `string` | Client‑side placeholder for optimistic UI |
| `id`   | `string?` | Real item id (required for update/delete) |
| `menuItemId` | `number?` | Required on create |
| `qty`  | `number?` | ≥ 1 |
| `note` | `string?` | Free text |

### Server → All Clients  (`cart_update`)

```jsonc
{
  "type": "cart_update",
  "op": "create",            // update | delete
  "item": {
    "id": "ci_987",
    "memberId": "m_abc",
    "menuItemId": 42,
    "qty": 2,
    "note": "no onion",
    "version": 1
  },
  "tmpId": "c_local_123"      // only for the originating client
}
```

*Conflict handling:* If a client sends an outdated `version`, server responds

```jsonc
{ "type":"error", "code":"VERSION_CONFLICT", "currentItem":{…} }
```

**Password gate:**  
If the session’s `daily_pass_required=true` and `pass_validated=false`, the server must respond to any `cart_mutate` with  
```jsonc
{ "type":"error", "code":"PASS_REQUIRED" }
```  
The client should pop the pass modal, call `POST /session/{id}/validate_pass`, and then retry the mutation.

---

## GET `/cart_snapshot`

*Purpose:* let a reloaded tab catch up in one hit.

```
GET /cart_snapshot?sessionId=abc123
```

```jsonc
{
  "items":[
    {"id":"ci_987","memberId":"m_abc","menuItemId":42,"qty":2,"note":"no onion","version":1},
    …
  ],
  "members":[
    {"id":"m_abc","nickname":"otter‑7"},
    …
  ],
  "cartVersion": 27                // hash or incremental int for whole cart
}
```

---

## POST `/orders`

*Idempotent finalisation of the combined cart.*

```
POST /orders
Content‑Type: application/json
```

```jsonc
{
  "sessionId": "abc123",
  "cartHash": "de0adbeef…",   // SHA‑256 of sorted items
  "payMethod": "cash"         // reserved, not used v1
}
```

| Server response | Meaning |
|-----------------|---------|
| **201** `{orderId, ticketNo}` | Hash matches; order forwarded to POS; returns official ticket number for receipts. |
| **409 Conflict** `{authoritativeCart}` | Client hash stale → UI must refresh before retrying. |

The server also broadcasts an `order_fired` WS event:

```jsonc
{
  "type":"order_fired",
  "orderId":"o_456",
  "ticketNo":"T‑73",
  "cartHash":"de0adbeef…"
}
```

All connected screens switch to “Cooking” states immediately.

---

| Step | Action | Notes |
|------|--------|-------|
| 1    | **Scan QR** | Opens menu with table number and restaurant set. |
| 2    | **Open WS** | Connects with `ws_token`. |
| 3    | **First “Add to Cart”** | If `daily_pass_required` & not yet validated → prompt modal, call `POST /session/{id}/validate_pass`. On success continue; on fail keep menu read‑only. |
| 4    | **Nickname + Cart mutate** | Inline nickname prompt (only after pass succeeds) → send `cart_mutate` over WS → `member_join` broadcast. |
| 5    | **“Send Order”** | Pass is already validated, so no extra prompt. |

---

**Daily pass rota (Morning Setup)**

The daily pass is required for access to ordering.  
Cart remains read‑only until the pass is entered.
</file>
