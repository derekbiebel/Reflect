import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { clearAllData, exportEntries } from '../lib/db';
import { requestNotificationPermission, getNotificationPermission, getReminderSettings, updateReminderSettings } from '../lib/notifications';
import type { ToneMode } from '../lib/types';

const tones: { mode: ToneMode; label: string; desc: string }[] = [
  { mode: 'companion', label: 'Companion', desc: 'Warm and curious' },
  { mode: 'coach', label: 'Coach', desc: 'Neutral and direct' },
  { mode: 'minimal', label: 'Minimal', desc: 'Just the prompt' },
];

const timeOptions = [
  { label: '6:00 AM', hour: 6, minute: 0 },
  { label: '7:00 AM', hour: 7, minute: 0 },
  { label: '8:00 AM', hour: 8, minute: 0 },
  { label: '9:00 AM', hour: 9, minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '5:00 PM', hour: 17, minute: 0 },
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '7:00 PM', hour: 19, minute: 0 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '9:00 PM', hour: 21, minute: 0 },
];

export default function SettingsPage() {
  const { toneMode, setToneMode, setEntries } = useAppStore();
  const [apiKey, setApiKey] = useState(localStorage.getItem('reflect-api-key') || '');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [notifPermission, setNotifPermission] = useState('default');

  useEffect(() => {
    const settings = getReminderSettings();
    setReminderEnabled(settings.enabled);
    setReminderHour(settings.hour);
    setReminderMinute(settings.minute);
    setNotifPermission(getNotificationPermission());
  }, []);

  async function handleToggleReminder() {
    if (!reminderEnabled) {
      // Turning on — request permission first
      const granted = await requestNotificationPermission();
      setNotifPermission(getNotificationPermission());
      if (!granted) return;
      setReminderEnabled(true);
      updateReminderSettings(true, reminderHour, reminderMinute);
    } else {
      setReminderEnabled(false);
      updateReminderSettings(false, reminderHour, reminderMinute);
    }
  }

  function handleTimeChange(hour: number, minute: number) {
    setReminderHour(hour);
    setReminderMinute(minute);
    updateReminderSettings(reminderEnabled, hour, minute);
  }

  function handleSaveKey() {
    localStorage.setItem('reflect-api-key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleExport() {
    const data = await exportEntries();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reflect-journal-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleClear() {
    await clearAllData();
    setEntries([]);
    setShowClearConfirm(false);
  }

  const selectedTimeLabel = timeOptions.find(t => t.hour === reminderHour && t.minute === reminderMinute)?.label || '6:00 PM';

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-serif text-3xl mb-6">Settings</h1>

      {/* Tone mode */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Tone</h2>
        <div className="space-y-2">
          {tones.map(({ mode, label, desc }) => (
            <button
              key={mode}
              onClick={() => setToneMode(mode)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                toneMode === mode
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border-[var(--color-bg-hover)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <span className="font-medium">{label}</span>
              <span className="text-[var(--color-text-muted)] ml-2 text-sm">{desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Daily Reminder */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Daily Reminder</h2>
        <div className="bg-[var(--color-bg-card)] rounded-xl overflow-hidden">
          {/* Toggle */}
          <button
            onClick={handleToggleReminder}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm">Remind me to journal</span>
            <div
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
                reminderEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)]'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  reminderEnabled ? 'translate-x-5.5 left-auto right-0.5' : 'left-0.5'
                }`}
                style={{ transform: reminderEnabled ? 'translateX(0)' : 'translateX(0)', left: reminderEnabled ? 'auto' : '2px', right: reminderEnabled ? '2px' : 'auto' }}
              />
            </div>
          </button>

          {/* Time picker */}
          {reminderEnabled && (
            <div className="px-4 pb-3 pt-1 border-t border-[var(--color-bg-hover)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">Time</span>
                <span className="text-sm font-medium">{selectedTimeLabel}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {timeOptions.map(opt => (
                  <button
                    key={`${opt.hour}-${opt.minute}`}
                    onClick={() => handleTimeChange(opt.hour, opt.minute)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      opt.hour === reminderHour && opt.minute === reminderMinute
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {notifPermission === 'denied' && (
                <p className="text-xs text-[var(--color-mood-low)] mt-2">
                  Notifications are blocked. Enable them in your browser settings.
                </p>
              )}

              <p className="text-xs text-[var(--color-text-muted)] mt-2 opacity-60">
                Works best when added to your home screen as an app.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* API Key */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">API Key</h2>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 bg-[var(--color-bg-input)] rounded-xl px-4 py-3 text-sm text-[var(--color-text)] border border-[var(--color-bg-hover)]"
          />
          <button
            onClick={handleSaveKey}
            className="px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Your Anthropic API key. Stored locally, never sent anywhere except the Anthropic API.
        </p>
      </section>

      {/* Data */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Data</h2>
        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Export Journal (JSON)
          </button>
          {showClearConfirm ? (
            <div className="px-4 py-3 rounded-xl bg-[var(--color-mood-low)]/10 border border-[var(--color-mood-low)]/30">
              <p className="text-sm mb-3">This will permanently delete all journal entries. Are you sure?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 rounded-lg bg-[var(--color-mood-low)] text-white text-sm"
                >
                  Yes, Delete Everything
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--color-bg-hover)] text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-[var(--color-mood-low)] transition-colors"
            >
              Clear All Data
            </button>
          )}
        </div>
      </section>

      {/* Update */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">App</h2>
        <button
          onClick={async () => {
            // Unregister service workers and clear caches
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const reg of registrations) await reg.unregister();
            }
            if ('caches' in window) {
              const keys = await caches.keys();
              for (const key of keys) await caches.delete(key);
            }
            window.location.reload();
          }}
          className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <span className="text-sm">Check for Updates</span>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Clears cache and reloads with the latest version</p>
        </button>
      </section>

      {/* About */}
      <section>
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Reflect — A journal that learns you.
          <br />
          All data stays on your device.
        </p>
      </section>
    </div>
  );
}
