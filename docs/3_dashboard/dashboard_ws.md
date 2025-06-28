## Admin Dashboard – WebSocket Implementation Plan

_Last updated: December 2024_

### 1. Objectives

1. Replace periodic polling on `GET /admin/dashboard` with a persistent WebSocket connection.
2. Stream **live** table state snapshots and incremental updates to the dashboard client.
3. Move **all** table-level actions (close / move / disable / enable / restore) from REST to WebSocket messages.
4. Limit the scope to *admin users viewing a single restaurant* (one-restaurant-per-connection). No cross-restaurant dashboard for now.

---

### 2. High-Level Architecture

```mermaid
graph TD
    subgraph Browser (admin)
        A[Dashboard HTML/JS]<-->WS
    end

    subgraph FastAPI backend
        WS -->|dashboard_manager| CM[ConnectionManager\n(slug→sockets)]
        WS --> SVC[Table Service\n(DB helpers)]
        CM --> WS
    end

    SVC -- DB access --> SQL[(PostgreSQL)]
```

* `dashboard_manager` is **another** instance of the already-written `ConnectionManager` but keyed by `restaurant_slug`.
* Each WebSocket message that mutates a table first calls the shared service layer → DB → then the updated table entity is broadcast back to every admin connected to that restaurant.

---

### 3. Endpoint & Authentication

| Method | Path | Notes |
| ------ | ---- | ----- |
| `WebSocket` | `/admin/ws/dashboard` | Upgrade route used by the dashboard.

**Auth flow**
1. Admin login page still accepts an `api_key` (or Bearer token). The token is passed via the `Authorization: Bearer <token>` header when the browser opens the WebSocket.
2. `dashboard_ws` validates the token from the `authorization` header with existing `auth_utils` and resolves `restaurant_slug`.
3. On success it calls `dashboard_manager.connect(ws, restaurant_slug)` and sends an initial `tables_snapshot` payload.

---

### 4. Message Protocol

#### 4.1 Client → Server
| Action | Payload Example |
| ------ | --------------- |
| **Ping** | `"ping"`               |
| **Close table** | `{ "action": "close_table", "table_id": 12 }` |
| **Disable table** | `{ "action": "disable_table", "table_id": 12 }` |
| **Enable table** | `{ "action": "enable_table", "table_id": 12 }` |
| **Restore table** | `{ "action": "restore_table", "table_id": 12 }` |
| **Move table** | `{ "action": "move_table", "from": 5, "to": 9 }` |

All numeric fields are integers. Any unknown `action` returns an `error` message.

#### 4.2 Server → Client
| Type | Payload |
| ---- | ------- |
| `tables_snapshot` | `{ "type": "tables_snapshot", "tables": [<TableInfo>...] }` |
| `table_update` | `{ "type": "table_update", "table": <TableInfo> }` |
| `error` | `{ "type": "error", "code": "...", "detail": "..." }` |

`<TableInfo>` is:
```json
{
  "id": 12,
  "number": 4,
  "status": "occupied",   // free | occupied | disabled
  "session": {
    "id": 985,
    "last_active": "2024-06-27T17:32:41Z"
  }
}
```

---

### 5. Backend Implementation Steps

1. **Create route** `backend/urls/admin/dashboard_ws.py` (or extend `dashboard.py`).
2. **Instantiate manager**
   ```python
   from websocket.manager import ConnectionManager
   dashboard_manager = ConnectionManager()
   ```
3. **Refactor** existing REST helpers (`close_table`, etc.) into async functions inside `services/table_service.py`.
4. **Handle messages** in `dashboard_ws`:
   * On connect → send `tables_snapshot` *(reuse existing `get_tables_api` logic)*.
   * On each action → call corresponding service function → broadcast `table_update` on success.
5. **Remove HTMX polling** from the template once WS connection is confirmed (`onopen`).
6. **Deprecate** REST endpoints for table operations (mark as deprecated in OpenAPI docs but keep functional for backward compatibility). Keep `/admin/api/tables` for snapshot fallback.

---

### 6. Front-End Changes (dashboard.html)

```js
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${proto}://${location.host}/admin/ws/dashboard`, [], {
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});

ws.onopen = () => console.log('Dashboard WS connected');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'tables_snapshot': renderGrid(msg.tables); break;
    case 'table_update':   updateTile(msg.table);   break;
    case 'error':          toast(msg.detail);       break;
  }
};

function closeTable(id)   { ws.send(JSON.stringify({action:'close_table', table_id:id})); }
function disableTable(id) { ws.send(JSON.stringify({action:'disable_table', table_id:id})); }
// … other actions similarly
```

*After* WS is open, drop the `hx-get` refresh attribute or stop the interval.

---

### 7. Error Handling & Edge Cases

* Unknown action → `error` with `code:"unknown_action"`.
* DB constraint failures reuse existing `ERROR_MESSAGES` mapping; code is echoed back in WS.
* If a table update affects multiple tables (e.g., move), send **two** `table_update` messages.
* Server-side disconnects after 30 min idle or if token no longer valid.

---

### 8. Security Considerations

* Validate token on every **connection** via `Authorization` header, not every message (for perf).  
  Optionally, include an exp timestamp in the token and disconnect when exceeded.
* Enforce **max 5 connections** per restaurant in `dashboard_manager` to avoid abuse.
* Sanitize all numeric fields from client with `pydantic` models.

---

### 9. Scaling Notes

* In multi-worker deployments you'll need a shared pub/sub (Redis). Replace the in-memory lists in `ConnectionManager` with a Redis channel.
* Table updates already happen via the DB → service → broadcast, so only the small broadcast abstraction changes.

---

### 10. Testing Checklist

- [ ] Unit tests for every service action (close, disable, etc.)
- [ ] WS integration test: connect, snapshot received, close_table event broadcast to both sockets.
- [ ] Front-end e2e: Cypress script confirming UI updates without page reload.

---

### 11. Future Enhancements

* Add waiter-tablet channel to reuse same messages.
* Consolidate `dashboard_manager` and `session_ws` manager behind an interface.
* Implement optimistic UI updates in the dashboard for faster feedback.
* Pagination/bulk updates for restaurants with >100 tables.

