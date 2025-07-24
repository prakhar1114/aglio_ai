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
    fetch(`/beeper/notifications/${ev.notification.data.id}/ack`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action})
    })
  );
  ev.waitUntil(clients.openWindow('/beeper_pwa/'));
}); 