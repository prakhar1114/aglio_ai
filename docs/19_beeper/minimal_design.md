/* ============================================================
   PROJECT:  Minimal “Beeper” Progressive Web App
   GOAL:     Cross-platform PWA that can receive background
             push notifications and let the user Ack (accept /
             reject / opened). NO database—just in-memory
             storage for the first iteration.
   STACK:
     • Python 3.12  + FastAPI
     • pywebpush for sending Web Push
     • Uvicorn for ASGI
     • Vanilla JS + Service-Worker on the front-end
   OUTPUT:
     ├── main.py                  # FastAPI server
     ├── vapid_keys.py            # one-off script to generate VAPID keys
     ├── frontend/                # static files served by FastAPI
     │     ├── index.html
     │     ├── app.js
     │     ├── manifest.json
     │     ├── service-worker.js
     │     └── icons…
     └── requirements.txt
================================================================*/

/* -------------------- 1. FASTAPI SERVER -------------------- */

main.py
───────
- Generate a global dict `SUBSCRIPTIONS: dict[str, dict]` keyed by
  `endpoint` SHA-256.  
- Global dict `NOTIFICATIONS: dict[str, dict]` keyed by UUID.
- Endpoints:
  GET  /push/public-key           → { "key": VAPID_PUBLIC }
  POST /push/subscribe            body: PushSubscription JSON
                                  → 201  (store in SUBSCRIPTIONS)
  DELETE /push/subscribe/{hash}   → 204  (remove)
  POST /notifications             body: { "title","body","targets":[] }
                                  → 202  { "id": uuid }
                                  – loop `targets` and send webpush()
                                    (use pywebpush; ignore failures)
  PATCH /notifications/{id}/ack   body: { "action": "accept|reject|opened" }
                                  → 204  (update NOTIFICATIONS[id])
- Single WebSocket `/ws/notifications`
    * Accepts JWT-less connections for simplicity.
    * On connect, stores websocket in `LIVE_SOCKETS[user_email]`.
    * When a notification is sent, if `targets` user is online,
      `await ws.send_json({...})`.
    * When client sends `{type:"ack", id:"...", action:"accept"}`,
      call same ack handler.

vapid_keys.py
─────────────
- Generates and prints VAPID public / private keys using pywebpush
  utilities; run once, then copy keys into `settings`.

requirements.txt
────────────────
fastapi
uvicorn[standard]
pywebpush
python-multipart   # upload safety
itsdangerous       # lightweight token signer (optional)

/* -------------------- 2. STATIC FRONTEND ------------------- */

frontend/index.html
───────────────────
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="manifest" href="/manifest.json">
  <title>Beeper PWA</title>
</head>
<body>
  <h1>Beeper</h1>
  <button id="enable">Enable Notifications</button>
  <script src="/app.js"></script>
</body>
</html>

frontend/app.js
───────────────
(async () => {
  if (!('serviceWorker' in navigator)) { alert('SW not supported'); return; }
  const reg = await navigator.serviceWorker.register('/service-worker.js');
  const { key } = await (await fetch('/push/public-key')).json();
  document.getElementById('enable').onclick = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(atob(key.replace(/_/g,'/').replace(/-/g,'+')), c=>c.charCodeAt(0))
    });
    await fetch('/push/subscribe', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});
  };

  // live websocket
  const ws = new WebSocket(`ws${location.protocol==='https:'?'s':''}://${location.host}/ws/notifications`);
  ws.onmessage = m => console.log('WS:', m.data);
})();

frontend/service-worker.js
──────────────────────────
self.addEventListener('push', ev => {
  const d = ev.data.json();
  ev.waitUntil(
    self.registration.showNotification(d.title || 'Beep', {
      body: d.body || '',
      data: { id: d.id },
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'reject', title: 'Reject' }
      ]
    })
  );
});

self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  const action = ev.action || 'opened';
  ev.waitUntil(
    fetch(`/notifications/${ev.notification.data.id}/ack`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action})
    })
  );
  ev.waitUntil(clients.openWindow('/'));
});

frontend/manifest.json
──────────────────────
{
  "name": "Beeper",
  "short_name": "Beeper",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

/* -------------------- 3. FASTAPI STATIC MOUNT -------------- */

In main.py:
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

/* -------------------- 4. RUN ------------------------------- */

# 1-time
$ python vapid_keys.py     # copy keys into main.py constants
# dev server
$ uvicorn main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile ... --ssl-certfile ...

================================================================
NOTES / LIMITATIONS (acceptable for v0):
  • All data is **lost on restart**—fine for demos and early tests.
  • No auth; every browser instance counts as a “user”.
  • You will hit browser-imposed subscription limits if you hammer it.
  • Migrate `SUBSCRIPTIONS` and `NOTIFICATIONS` to a DB once you need durability.
=========================================================== */