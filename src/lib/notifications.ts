export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function updateReminderSettings(enabled: boolean, hour: number, minute: number) {
  localStorage.setItem('reflect-reminder', JSON.stringify({ enabled, hour, minute }));

  // Tell the service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_REMINDER',
      enabled,
      hour,
      minute,
    });
  }
}

export function getReminderSettings(): { enabled: boolean; hour: number; minute: number } {
  try {
    const stored = localStorage.getItem('reflect-reminder');
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { enabled: false, hour: 18, minute: 0 };
}

export function syncReminderToSW() {
  const settings = getReminderSettings();
  updateReminderSettings(settings.enabled, settings.hour, settings.minute);
}
