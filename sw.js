self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.json() : { title: 'ResQLink SOS', body: 'Emergency Alert!' };

  const options = {
    body: data.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/1067/1067555.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1067/1067555.png',
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
    data: { url: '/guardian-dashboard.html' },
    actions: [
      { action: 'open', title: 'View Location' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
