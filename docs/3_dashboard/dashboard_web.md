# Admin Table‑Dashboard – Web‑Interface Design  
*(Phase‑1: HTMX + Jinja2 polling; Phase‑2 will add WebSockets)*
## 0  Page Map

| Route | Description |
|-------|-------------|
| `/admin/login` | API‑key prompt (one field) |
| `/admin/dashboard` | Live table grid after successful key |

Both routes are served from `backend/urls/admin/`.

---

## 1  Login Screen – `/admin/login`

| Element | Details |
|---------|---------|
| **Form** | `<form hx-post="/admin/login" hx-target="body" hx-swap="outerHTML">` |
| **Field** | `<input type="password" name="api_key" placeholder="API Key">` |
| **Success** | Server validates, stores key in `<body data-api-key="…">`, then returns `dashboard.html`. |
| **Failure** | 401 → shake input, red “Invalid Key” label. |

Minimal CSS: center form vertically, 300 px box.

---

## 2  Dashboard Page Layout – `/admin/dashboard`

```
<header>
  <h1>{{ restaurant_name }}</h1>
  <button id="logout">Logout</button>
</header>

<div id="grid"
     hx-get="/admin/tables"
     hx-trigger="load, every 10s"
     hx-swap="outerHTML">
  {% include "admin/partials/grid.html" %}
</div>

<div id="toast" class="toast hidden"></div>

<link rel="stylesheet" href="/static/admin/dashboard.css">
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
<script src="/static/admin/dashboard.js"></script>
```

### 2.1  Global HTMX Bearer header

```js
htmx.defineExtension('authBearer', {
  onEvent:(n,e)=>{
     if(n==='configRequest'){
        const k=sessionStorage.getItem('apiKey')||document.body.dataset.apiKey;
        if(k) e.detail.headers['Authorization']='Bearer '+k;
     }
  }
});
htmx.config.extensions.push('authBearer');
```

---

## 3  Grid Partial – `templates/admin/partials/grid.html`

```html
<table class="grid">
  <tr>
  {% for tbl in tables %}
    <td data-table-id="{{ tbl.id }}"
        class="tile {{ tbl.status }} {% if tbl.session %}occupied{% endif %}">
      <div class="num">{{ tbl.number }}</div>

      {% if tbl.session %}
        <small class="badge">⏱ {{ idle(tbl.session.last_active) }}</small>
        <div class="btn-row">
          <button hx-post="/admin/table/{{ tbl.id }}/close"
                  hx-target="#toast" hx-swap="innerHTML">Close</button>

          <button class="btn-move"
                  hx-post="/admin/table/{{ tbl.id }}/move"
                  hx-vals='{"target":null}'
                  hx-on="htmx:beforeRequest: pickTarget(event)">Move</button>
        </div>
      {% elif tbl.status == 'open' %}
        <button hx-post="/admin/table/{{ tbl.id }}/disable"
                hx-target="#toast" hx-swap="innerHTML">Disable</button>
      {% elif tbl.status == 'disabled' %}
        <button hx-post="/admin/table/{{ tbl.id }}/enable"
                hx-target="#toast" hx-swap="innerHTML">Enable</button>
      {% elif tbl.status == 'dirty' %}
        <em>Dirty</em>
      {% endif %}
    </td>
    {% if loop.index is divisibleby 6 %}</tr><tr>{% endif %}
  {% endfor %}
  </tr>
</table>
```

Helper filter in Jinja:

```python
@app.template_filter('idle')
def idle(ts):
    diff = (datetime.utcnow() - ts).seconds
    return f"{diff//60} min"
```

---

## 4  State Colours & Sizes – `static/admin/dashboard.css`

```css
.grid      { border-collapse: collapse; }
.tile      { width:110px; height:90px; border:1px solid #ccc;
             text-align:center; vertical-align:top; position:relative; }
.num       { font-size:2rem; font-weight:600; margin-top:4px; }
.badge     { font-size:0.75rem; }
.open      { background:#e0ffe0; }
.occupied  { background:#d0e7ff; }
.dirty     { background:#ffe5b3; }
.disabled  { background:#ddd; }
.btn-row button { margin:2px 2px; font-size:0.7rem; }
.toast     { position:fixed; bottom:12px; right:12px;
             background:#333;color:#fff;padding:8px 12px;border-radius:4px; }
.hidden    { display:none; }
```

---

## 5  Dashboard JS – `static/admin/dashboard.js`

```js
// Toast helper
document.body.addEventListener('htmx:afterOnLoad', ev=>{
  if(ev.detail.target.id==='toast'){
     document.getElementById('toast').classList.remove('hidden');
     setTimeout(()=>document.getElementById('toast').classList.add('hidden'),3000);
  }
});

// Move‑mode
window.pickTarget = function(evt){
  evt.preventDefault();
  const src = evt.target.closest('.tile').dataset.tableId;
  sessionStorage.setItem('moveSource', src);
  alert('Select a green table to move party');
};

document.addEventListener('click', e=>{
  const src = sessionStorage.getItem('moveSource');
  if(!src) return;
  const dstTile = e.target.closest('.tile.open');
  if(!dstTile) return;
  const dst = dstTile.dataset.tableId;
  htmx.ajax('POST', `/admin/table/${src}/move`,
            {target:'#toast',swap:'innerHTML',vals:{target:dst}});
  sessionStorage.removeItem('moveSource');
});
```

---

## 6  Button → API mapping

| Button | Endpoint | Success | Fails / toast text |
|--------|----------|---------|--------------------|
| Close | `POST /admin/table/{id}/close` | Tile → dirty | `no_active_session` |
| Disable | `/disable` | Tile → disabled | `table_occupied` |
| Enable | `/enable` | Tile → open | `not_disabled` |
| Move | `/move` via JS | Source tile becomes open; target blue | `target_unavailable`, `same_table`, `no_session_to_move` |

---

## 7  Error code to toast message

| `code` | Shown message |
|--------|---------------|
| `table_occupied` | “Table already has diners.” |
| `target_unavailable` | “Target table is not free.” |
| `same_table` | “Choose a different table.” |
| `no_active_session` | “No open session to close.” |
| `already_disabled` | “Table already disabled.” |
| `not_disabled` | “Table not disabled.” |
| `no_session_to_move` | “Nothing to move.” |

---

## 8  Future Phase‑2 (WebSocket)

* Add `/admin/ws/dashboard?slug=...` streaming `{"type":"table_update","table_id":3}`.  
* In `dashboard.js` open socket and `htmx.trigger('#grid','refresh')` on each message.  
* Remove 10‑second polling.

---
