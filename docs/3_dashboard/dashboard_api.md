# Admin Dashboard API – Requirements (Phase‑1)

All endpoints live under **`/admin/`** and require the **API‑key** bearer header:

```
Authorization: Bearer <restaurant_api_key>
```

If the key maps to `restaurant.slug = "hcraft"`, every request is automatically scoped to that restaurant.

## Authentication Implementation

The authentication is handled by the `auth` function in `backend/urls/admin/auth_utils.py`. This function:

- Validates the `Authorization: Bearer <token>` header format
- Performs timing-safe comparison against stored API keys in the database
- Returns the `restaurant_slug` for successful authentication
- Raises appropriate HTTP 401/403 exceptions for authentication failures

The auth function should be used as a FastAPI dependency for all admin endpoints:

```python
from fastapi import Depends
from .auth_utils import auth

@router.get("/tables")
def get_tables(auth_data: dict = Depends(auth)):
    restaurant_slug = auth_data["restaurant_slug"]
    # endpoint implementation
```

---

## 0. Common response / error format

```jsonc
// success
{ "success": true, "data": { ... } }

// error
{ "success": false, "code": "table_occupied", "detail": "Target table already has diners." }
```

* HTTP 401 ⇒ missing/invalid key  
* HTTP 403 ⇒ key belongs to different restaurant  
* HTTP 404 ⇒ resource not found / no session to restore  
* HTTP 409 ⇒ business‑rule conflict (see validations)  

---

## 1. Endpoints

| Verb | Path | Purpose |
|------|------|---------|
| `GET` | `/admin/tables` | Return live grid snapshot. |
| `POST` | `/admin/table/{table_id}/close` | End the active session and mark table dirty. |
| `POST` | `/admin/table/{table_id}/disable` | Toggle to `disabled` (only when free). |
| `POST` | `/admin/table/{table_id}/enable` | Re‑open a disabled table. |
| `POST` | `/admin/table/{table_id}/restore` | Reopen the most recent closed/expired session. |
| `POST` | `/admin/table/{table_id}/move` | Move current party to another empty table. |

---

### 1.1 GET `/admin/tables`

Return one object per physical table.

```jsonc
[
  {
    "id": 2,
    "number": 2,
    "status": "open",          // open | dirty | disabled
    "session": null
  },
  {
    "id": 3,
    "number": 3,
    "status": "open",
    "session": {
      "id": 88,
      "last_active": "2025‑06‑22T12:34:56Z"
    }
  }
]
```

No validations apart from auth.

---

### 1.2 POST `/admin/table/{id}/close`

*Action*   Close **active** session → `sessions.state='closed'`, `tables.status='dirty'`.

#### Validations

| Check | Error |
|-------|-------|
| Table not found → 404 |
| No active session → 409 `"no_active_session"` |

---

### 1.3 POST `/admin/table/{id}/disable`

Toggles `tables.status` between `open ⇄ disabled`.

#### Validations

| Current state | Active session? | Result |
|---------------|-----------------|--------|
| `open` + no session | — | OK → `disabled` |
| `open` + **session** | yes | 409 `"table_occupied"` |
| `disabled`          | — | 409 `"already_disabled"` |

---

### 1.4 POST `/admin/table/{id}/enable`

*Only* allowed when `status='disabled'`.

| Check | Error |
|-------|-------|
| Not disabled → 409 `"not_disabled"` |
| Active session exists (shouldn’t happen) → 409 `"table_occupied"` |

---

### 1.5 POST `/admin/table/{id}/restore`

Re‑activates the **most recent** `sessions.state IN ('closed','expired')`.

| Check | Error |
|-------|-------|
| An **active session** already exists → 409 `"table_occupied"` |
| No previous sessions → 404 `"no_session_to_restore"` |

Returns:

```json
{ "success": true, "data": { "session_id": 91 } }
```

---

### 1.6 POST `/admin/table/{id}/move`

```jsonc
{ "target": 7 }
```

Swaps the party to table 7.

#### Preconditions

1. Source table has exactly **one active session**.  
2. Target table `status='open'` **and** has *no* active session.

| Failure | HTTP / code |
|---------|-------------|
| Target occupied or disabled | 409 `"target_unavailable"` |
| Source has no session | 409 `"no_session_to_move"` |
| Source=target | 409 `"same_table"` |

On success:

```json
{ "success": true, "data": { "new_table_id": 7 } }
```

---

## 2. Polling vs. Push

*Phase‑1* dashboard polls `GET /admin/tables` every **10 s**.  
Partial HTML (`partials/grid.html`) will be refreshed via HTMX swap.

*Phase‑2* will add `/admin/ws/dashboard` to push:

```json
{ "type":"table_update", "table_id": 3 }
```

Client then triggers `hx-get` refresh of just that tile.

---

## 3. Helper SQL

```sql
-- Active session lookup
SELECT * FROM sessions
WHERE table_id = :tid AND state = 'active';

-- Latest closed/expired session
SELECT * FROM sessions
WHERE table_id=:tid AND state IN ('closed','expired')
ORDER BY last_activity_at DESC
LIMIT 1;
```

Partial unique index for enforcement:

```sql
CREATE UNIQUE INDEX one_active_per_table
ON sessions (restaurant_id, table_id)
WHERE state = 'active';
```

---

With this spec you can hand the file to Cursor / dev teammates and implement:

* Router path: `backend/urls/admin/dashboard.py`.  
* Auth dependency already resolves `restaurant_slug`.  
* Validations conform to the table above.  

Once these routes are live, the HTMX/Jinja front‑end can consume them without change. ```
