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

## 8.  Order submission endpoints are out‑of‑scope for this file.  

Cart and password validation are fully specified above. Cursor can generate Pydantic models, routers, and unit tests directly from this document.
