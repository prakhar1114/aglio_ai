# Table‑Session & WebSocket Bootstrap  
*(QR ordering – minimal subset, v 1.0 / 2025‑06‑22)*

This file focuses **only** on:

* Creating / refreshing a session  
* Member registration  
* Opening the customer WebSocket  
* Core events: `member_join`, `error`

All other cart / ordering APIs are documented separately.

---

## Error envelope

```jsonc
{ "success": false, "code": "bad_token", "detail": "signature mismatch" }
```

HTTP status ⇒ 4xx/5xx, `code` ⇒ machine‑parseable.

---

## 1  Session & JWT

| # | Path | Verb | Purpose |
|---|------|------|---------|
| 1.1 | `/table_session` | `POST` | Validate QR; create or fetch the single **active** session for that table |
| 1.2 | `/session/token_refresh` | `POST` | Issue a fresh short‑lived `ws_token` when the current one is near expiry |

### 1.1  `POST /table_session`

Body:

```json
{
  "table_pid": "abc123",        // table public_id from QR
  "token"    : "ZXIz...",       // HMAC from QR
  "device_id": "uuid4-string"   // one per browser (localStorage)
}
```

Success `200`:

```json
{
  "session_pid"   : "s_97df48",
  "member_pid"    : "m_af11de",
  "nickname"      : "Otter",
  "is_host"       : true,
  "ws_token"      : "eyJhbGciOi...",
  "restaurant_name": "My Bistro"
}
```

**Implementation notes**

* **Look‑up** – `SELECT t.*, r.* FROM tables t JOIN restaurants r USING (restaurant_id) WHERE t.public_id=:pid`.
* **Token verify** – `hmac.compare_digest(expected_token, token)` where `expected_token = HMAC(secret, f"{r.id}:{t.id}")`.
* **Open‑hours gate** – compare `now() AT TIME ZONE r.tz` with `restaurant_hours`.
* **Disabled check** – short‑circuit 423 if `t.status='disabled'`.
* **Session UPSERT**

```sql
INSERT INTO sessions (public_id, restaurant_id, table_id, state, last_activity_at)
VALUES (:new_uuid, :rid, :tid, 'active', now())
ON CONFLICT (table_id) WHERE state='active'
DO UPDATE SET last_activity_at = now()
RETURNING id, public_id;
```

* **JWT build** – `jwt.encode({"sub":member_pid,"sid":sess_pid,"dev":device_id,"iat":now,"exp":now+3h}, SECRET)`.
* **Side effect** – optional: cache `sess:{pid}` in Redis (TTL 3h) for fast re‑scan.
* **Member auto‑create** – same UPSERT logic as old /member; random nickname from `animals.txt`; first device becomes `is_host=true`.

Validations:

| Failure | HTTP | code |
|---------|------|------|
| PID not found | 404 | `table_not_found` |
| Token mismatch | 403 | `bad_token` |
| Restaurant closed | 423 | `restaurant_closed` |
| Table disabled | 423 | `table_disabled` |
| Invalid or missing `device_id` | 400 | `bad_device_id` |

### 1.2  `POST /session/token_refresh`

Header: `Authorization: Bearer <old_ws_token>`

*Only allowed if token expires in ≤15 min.*

Success `200`:

```json
{ "ws_token":"eyNew..." }
```

**Implementation notes**

* Decode JWT, verify signature & `sid` claim.
* Reject if `exp - now() > 15 * 60` → 409 `not_needed`.
* Build new token: same payload, update `iat`, `exp = now()+3h`.
* No DB write required (stateless) but you may blacklist old `jti` in Redis if you add logout later.

Errors: 401 `invalid_token`, 409 `not_needed`

---

### 2  Nickname Update

`PATCH /member/{member_pid}`  
Header: `Authorization: Bearer <ws_token>`

Body:
```json
{ "nickname": "Alex" }
```

Validations:

| Check | HTTP | code |
|-------|------|------|
| `member_pid` not owned by JWT `sub` **and** not `is_host` | 403 | `not_authorised` |
| Session closed | 410 | `session_closed` |

Success 200:  
`{ "success":true, "nickname":"Alex" }`

Server broadcasts
```json
{ "type":"member_join",
  "member":{ "member_pid":"m_af11de","nickname":"Alex","is_host":true } }
```

---

### JWT payload (`ws_token`, HS256)

```jsonc
{
  "sub": "m_af11de",
  "sid": "s_97df48",
  "dev": "uuid4",
  "iat": 1719057012,
  "exp": 1719067812      // ≈ 3 h
}
```

---

## 3  Customer WebSocket

**Endpoint**

```
GET /ws/session?sid={session_pid}
Header: Authorization: Bearer <ws_token>
```

### 3.1  Client → Server messages

*No cart yet — only heartbeat (`ping`) supported.*

### 3.2  Server → Clients events

| type | Payload | Description |
|------|---------|-------------|
| `member_join` | `{ "member": { "member_pid":"m1","nickname":"Cat","is_host":false } }` | New device registered |
| `error` | `{ "code":"invalid_payload","detail":"…" }` | Any protocol violation |

Close codes:

| code | reason |
|------|--------|
| 4003 | auth failed / sid mismatch |
| 4008 | connection hard‑limit (>20 sockets) |

---

**Server‑side flow**

1. `on_connect`  
   * Verify `ws_token`; close(4003) on failure.  
   * `register(ws, sid)` in connection manager; enforce ≤20.  
2. `on_message`  
   * Accept only `"ping"` payload for now; any unknown → `error` `invalid_payload`.  
3. `on_disconnect`  
   * Remove from manager; if no sockets remain you may mark `member.active=false` for presence tracking.

---

## 4  Edge‑case guards

| Race / prank | Prevention |
|--------------|------------|
| Two devices create session simultaneously | UNIQUE index `(restaurant_id, table_id) WHERE state='active'` |
| Token replay on wrong table | `sid` claim mismatch → WS close(4003) |
| Screenshot scanned after closing hours | `/table_session` returns 423 `restaurant_closed` |
| Flood of sockets | per‑session cap 20; excess → close(4008) |

---

**This trimmed spec is the only scope for implementation now.**  
Cart, daily‑pass, and ordering APIs are deferred to the next phase.