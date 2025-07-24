(async () => {
  if (!('serviceWorker' in navigator)) { alert('SW not supported'); return; }
  const reg = await navigator.serviceWorker.register('/beeper_pwa/service-worker.js');
  const { key } = await (await fetch('/beeper/push/public-key')).json();
  document.getElementById('enable').onclick = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(atob(key.replace(/_/g,'/').replace(/-/g,'+')), c=>c.charCodeAt(0))
    });
    await fetch('/beeper/push/subscribe', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});
  };

//   // live websocket
//   const ws = new WebSocket(`ws${location.protocol==='https:'?'s':''}://${location.host}/beeper/ws/notifications`);
//   ws.onmessage = m => console.log('WS:', m.data);
})(); 