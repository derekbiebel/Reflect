const REMINDER_CHECK_INTERVAL = 60 * 1000; // check every minute

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_REMINDER') {
    // Store reminder settings
    self.reminderHour = event.data.hour ?? 18;
    self.reminderMinute = event.data.minute ?? 0;
    self.reminderEnabled = event.data.enabled ?? false;
  }
});

// Periodic check using setInterval (runs while SW is alive)
let checkInterval = null;

function startChecking() {
  if (checkInterval) return;
  checkInterval = setInterval(() => {
    if (!self.reminderEnabled) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's the right time (within the same minute window)
    if (hour === self.reminderHour && minute === self.reminderMinute) {
      // Check if we already sent today
      const todayKey = now.toISOString().split('T')[0];
      if (self.lastNotificationDate === todayKey) return;
      self.lastNotificationDate = todayKey;

      self.registration.showNotification('Reflect', {
        body: "A few minutes for yourself — your journal is waiting.",
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'daily-reminder',
        renotify: true,
      });
    }
  }, REMINDER_CHECK_INTERVAL);
}

startChecking();

// Also handle push events if we ever add a push server
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reflect', {
      body: data.body || "Your journal is waiting.",
      icon: '/favicon.svg',
      tag: 'daily-reminder',
    })
  );
});

// Open the app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});
