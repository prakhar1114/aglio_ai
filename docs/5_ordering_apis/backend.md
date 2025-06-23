# Ordering APIs & WebSocket Events  
*FastAPI back‑end implementation guide – v1.0 (2025‑06‑22)*  

This file defines every HTTP route and WebSocket message required for the **shared‑cart** feature. It assumes the table‑session endpoints already exist (see `table_session_api_and_ws.md`).

---

## 0. Common conventions  

* All JSON bodies: `application/json; charset=utf‑8`.  
* Auth: `Authorization: Bearer <ws_token>` header **required** for every mutating endpoint and WebSocket connection.  
* `ws_token` claims:  
  * `sub = member_pid`  
  * `sid = session_pid`  
  * `dev = device_id`  
* Responses use the *standard envelope*:

```jsonc
// success
{ "success": true, "data": { … } }
// error
{ "success": false, "code": "version_conflict", "detail": "row moved to version 3" }
```

HTTP status codes are listed per endpoint.

---

## 1.  `GET /cart_snapshot`  

Hydrates Redux on every hard reload.

### Request  

`GET /cart_snapshot?session_pid={sid}`  
Header: `Authorization: Bearer <ws_token>`

### Response 200

```jsonc
{
  "items": [
    { "id":100,"member_pid":"m_chinu","menu_item_id":17,"name":"Cappuccino",
      "qty":2,"note":"","version":2 }
  ],
  "members": [
    { "member_pid":"m_chinu","nickname":"Chinu","is_host":true },
    { "member_pid":"m_anshu","nickname":"Anshu","is_host":false }
  ],
  "orders": [],                       // empty until first ticket fired
  "cart_version": 2
}
```

### Validations  

| Failure | HTTP | code |
|---------|------|------|
| Session closed | 410 | `session_closed` |
| JWT sid ≠ query sid | 401 | `invalid_token` |

*Implementation*  

```sql
SELECT * FROM cart_items WHERE session_id=:sid AND is_deleted=false;
SELECT * FROM members WHERE session_id=:sid;
SELECT * FROM orders WHERE session_id=:sid ORDER BY created_at;
```

---

## 2.  `POST /session/validate_pass`  

Unblocks cart mutations when restaurant requires a daily word.

### Request  

```json
{ "session_pid":"s_97df48", "word":"coffee" }
```

### Response 200  

```json
{ 
  "success": true,
  "session_validated": true        // flag now true for the whole session
}
```

*Note:* `session_validated` is also returned by **`POST /table_session`**.  
Its value is `true` if (a) the restaurant does **not** require a daily password,  
or (b) it has already been entered for this session.

### Validations  

| Check | HTTP | code |
|-------|------|------|
| Wrong word (hash mismatch) | 403 | `wrong_word` |
| Session already validated | 409 | `already_validated` |

*Implementation*  

* Compare `sha256(word)` to `daily_passes.word_hash` for **today**.  
* On success:  
  * `UPDATE sessions SET pass_validated=true`  
  * `SETEX passOK:{sid} 10800 "1"` in Redis.
* Return the JSON above with `"session_validated":true` so the client updates its local flag.

---

## 3.  Cart item endpoints  

### 3.1  `POST /cart_items` – **create**

#### Body  

```json
{ "session_pid":"s_97df48", "menu_item_id":17, "qty":1, "note":"" }
```

#### Response 201  

```json
{
  "success": true,
  "data": { "id":100, "version":1 }
}
```

#### Validations  

| Check | HTTP | code |
|-------|------|------|
| pass_required & not validated | 403 | `pass_required` |
| qty < 1 | 400 | `bad_qty` |

---

### 3.2  `PATCH /cart_items/{id}` – **update**

#### Body  

```json
{ "session_pid":"s_97df48", "qty":2, "note":"no onion", "version":1 }
```

#### Response 200  

`{ "success":true, "data":{ "version":2 } }`

| Check | HTTP | code |
|-------|------|------|
| not owner & not host | 403 | `not_authorised` |
| version mismatch | 409 | `version_conflict` |
| pass_required | 403 | `pass_required` |

---

### 3.3  `DELETE /cart_items/{id}` – **delete**

Body: `{ "session_pid":"s_97df48", "version":2 }`

Same validations as update.

---

## 4.  WebSocket – `/ws/session?sid={sid}`  

### Client → Server `cart_mutate`

```json
{
  "op": "create|update|delete",
  "tmpId": "c1",        // create only
  "id": 100,            // upd/del
  "version": 2,         // upd/del
  "menu_item_id": 17,   // create only
  "qty": 2,
  "note": "no onion"
}
```

### Server → All `cart_update`

```json
{
  "type": "cart_update",
  "op"  : "create|update|delete",
  "item": { ...full row incl. version },
  "tmpId": "c1"       // echo to replace optimistic row
}
```

### Server → Originator `error`

```json
{ "type":"error", "code":"version_conflict", "currentItem":{…} }
```

---

## 5.  SQL helpers  

```sql
-- optimistic update
UPDATE cart_items
SET qty = :qty,
    note = :note,
    version = version + 1
WHERE id = :id
  AND version = :client_version
RETURNING version;

-- ownership check
SELECT member_pid, version
FROM cart_items
WHERE id = :id AND session_id = :sid;
```

---

## 6.  Redis keys (optional caching)

| Key | TTL | Value |
|-----|-----|-------|
| `passOK:{sid}` | 10800 s | `"1"` |
| `sess:{sid}`   | 10800 s | small JSON flags to skip DB |

---

## 7.  Close codes & errors

| WebSocket close | Reason |
|-----------------|--------|
| 4003 | auth token invalid (sig/sid/dev) |
| 4008 | >20 connections for same sid |

| Error code | Used in |
|------------|---------|
| `pass_required` | REST & WS |
| `not_authorised` | update/delete by non-owner |
| `version_conflict` | stale version |
| `bad_qty` | qty ≤0 |
| `wrong_word` | password mismatch |

---

## 8.  `POST /orders` – persist the order (POS integration deferred)  

> **Goal in v1:** simply write a row to the `orders` table so the kitchen can see it in a back‑office screen.  
> POS/KDS push will be added later; the schema already contains `pos_ticket`, leaving it `NULL` for now.

### Request  

```json
{
  "session_pid": "s_97df48",
  "items": [
    { "public_id": "ci_0a1b", "qty": 2, "note": "" },
    { "public_id": "ci_7ff2", "qty": 1, "note": "no onion" }
  ],
  "cart_hash": "7d8c…",
  "pay_method": "cash"
}
```

* `items[]` **must reference cart‐item `public_id`s**, not DB ints.  
  This prevents a malicious client from injecting arbitrary menu IDs.  
  Server maps them to `CartItem` rows to rebuild the authoritative cart.

### Response – happy path  

| HTTP | Body |
|------|------|
| **201** | `{ "success":true, "data":{ "order_id":"o_789" } }` |

### Validations  

| Check | HTTP | code | Notes |
|-------|------|------|-------|
| pass_required & not validated | 403 | `pass_required` | |
| Session closed | 410 | `session_closed` | |
| Cart empty | 409 | `cart_empty` | `items` array len = 0 |
| Any `public_id` not present in cart | 409 | `item_not_found` | client out of sync |
| Cart hash mismatch | 409 | `cart_mismatch` | returns current snapshot |

**Hash mismatch response**

```jsonc
{
  "success": false,
  "code": "cart_mismatch",
  "detail": "Hash differs; refresh cart.",
  "cart_snapshot": { … }            // full current state
}
```

### Implementation steps  

1. **Fetch session**  
   ```python
   session = db.query(Session).filter_by(public_id=req.session_pid, state='active').one_or_none()
   ```
   Raise `410 session_closed` if not.

2. **Load all live `cart_items`** for that session, keyed by `public_id`.  

   ```python
   rows = {ci.public_id: ci for ci in db.query(CartItem)
                                   .filter_by(session_id=session.id).all()}
   ```

3. **Validate request items**  
   * Every `public_id` in request must exist in `rows`; else `item_not_found`.  
   * Build `economic_rows` = subset after applying requested `qty` & `note` (client
     may have stale data; use server values).  

4. **Recompute canonical hash** *(see Cart‑Hash algorithm section)*  
   *If different from `req.cart_hash` → 409 `cart_mismatch`*.

5. **Insert `orders` row**  

   ```python
   order_pid = f"o_{uuid4().hex[:6]}"
   total_amount = sum(r.qty * r.menu_item.price for r in rows.values())
   order = Order(
       public_id    = order_pid,
       session_id   = session.id,
       payload      = [ row_to_dict(r) for r in rows.values() ],
       cart_hash    = req.cart_hash,
       total_amount = total_amount,  # Total in Indian Rs
       pay_method   = req.pay_method,
       pos_ticket   = None           # reserved for future POS push
   )
   db.add(order)
   db.commit()
   ```

6. **WebSocket broadcast** (optional in v1)  

   ```jsonc
   { "type":"order_fired",
     "order":{ "order_id":order_pid,
               "created_at":now_iso,
               "items":[…],
               "total_amount":total_amount } }
   ```

7. **Return 201** `{success:true,data:{order_id:order_pid}}`.

### Error codes added  

| code | Used in |
|------|---------|
| `item_not_found` | POST /orders |
| `cart_empty` | POST /orders |
| `cart_mismatch` | POST /orders |

*(Remove previous note that POS integration waits 3 s; that text is obsolete.)*

---
