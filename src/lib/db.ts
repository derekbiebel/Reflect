import type { JournalEntry, UserContext, WeeklyInsight, DeepInsight, PatternNudge, Habit, HabitLog } from './types';

const DB_NAME = 'reflect-journal';
const DB_VERSION = 4;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('context')) {
        db.createObjectStore('context', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('insights')) {
        db.createObjectStore('insights', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('deepInsights')) {
        db.createObjectStore('deepInsights', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('nudges')) {
        db.createObjectStore('nudges', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('habits')) {
        db.createObjectStore('habits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('habitLogs')) {
        const logStore = db.createObjectStore('habitLogs', { keyPath: 'id' });
        logStore.createIndex('habitId', 'habitId', { unique: false });
        logStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

function txPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('entries', 'readwrite');
  tx.objectStore('entries').put(entry);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllEntries(): Promise<JournalEntry[]> {
  const db = await openDB();
  const tx = db.transaction('entries', 'readonly');
  const entries = await txPromise(tx.objectStore('entries').getAll());
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getEntry(id: string): Promise<JournalEntry | undefined> {
  const db = await openDB();
  const tx = db.transaction('entries', 'readonly');
  return txPromise(tx.objectStore('entries').get(id));
}

export async function getEntriesByDateRange(startDate: string, endDate: string): Promise<JournalEntry[]> {
  const entries = await getAllEntries();
  return entries.filter(e => e.date >= startDate && e.date <= endDate);
}

export async function getTodayEntry(): Promise<JournalEntry | undefined> {
  const today = new Date().toISOString().split('T')[0];
  const entries = await getAllEntries();
  return entries.find(e => e.date === today);
}

export async function saveContext(context: UserContext): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('context', 'readwrite');
  tx.objectStore('context').put({ ...context, id: 'current' });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getContext(): Promise<UserContext | undefined> {
  const db = await openDB();
  const tx = db.transaction('context', 'readonly');
  const result = await txPromise(tx.objectStore('context').get('current'));
  return result || undefined;
}

export async function saveInsight(insight: WeeklyInsight): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('insights', 'readwrite');
  tx.objectStore('insights').put(insight);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDeepInsights(insights: DeepInsight[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('deepInsights', 'readwrite');
  const store = tx.objectStore('deepInsights');
  // Clear old insights and save fresh ones
  store.clear();
  for (const insight of insights) {
    store.put(insight);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDeepInsights(): Promise<DeepInsight[]> {
  const db = await openDB();
  const tx = db.transaction('deepInsights', 'readonly');
  const insights = await txPromise(tx.objectStore('deepInsights').getAll());
  return insights.filter((i: DeepInsight) => !i.dismissed).sort((a: DeepInsight, b: DeepInsight) => b.confidence - a.confidence);
}

export async function dismissDeepInsight(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('deepInsights', 'readwrite');
  const store = tx.objectStore('deepInsights');
  const insight = await txPromise(store.get(id));
  if (insight) {
    insight.dismissed = true;
    store.put(insight);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLatestWeeklyInsight(): Promise<WeeklyInsight | undefined> {
  const db = await openDB();
  const tx = db.transaction('insights', 'readonly');
  const all = await txPromise(tx.objectStore('insights').getAll());
  if (all.length === 0) return undefined;
  return all.sort((a: WeeklyInsight, b: WeeklyInsight) => b.date.localeCompare(a.date))[0];
}

export async function saveNudges(nudges: PatternNudge[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('nudges', 'readwrite');
  const store = tx.objectStore('nudges');
  store.clear();
  for (const nudge of nudges) {
    store.put(nudge);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getNudges(): Promise<PatternNudge[]> {
  const db = await openDB();
  const tx = db.transaction('nudges', 'readonly');
  const all = await txPromise(tx.objectStore('nudges').getAll());
  return all.filter((n: PatternNudge) => !n.dismissed);
}

export async function dismissNudge(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('nudges', 'readwrite');
  const store = tx.objectStore('nudges');
  const nudge = await txPromise(store.get(id));
  if (nudge) {
    nudge.dismissed = true;
    store.put(nudge);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Habits ──────────────────────────────────────────────

export async function saveHabit(habit: Habit): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('habits', 'readwrite');
  tx.objectStore('habits').put(habit);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllHabits(): Promise<Habit[]> {
  const db = await openDB();
  const tx = db.transaction('habits', 'readonly');
  const habits = await txPromise(tx.objectStore('habits').getAll());
  return habits
    .filter((h: Habit) => !h.archived)
    .sort((a: Habit, b: Habit) => a.createdAt - b.createdAt);
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await openDB();
  // Delete habit and all its logs
  const tx = db.transaction(['habits', 'habitLogs'], 'readwrite');
  tx.objectStore('habits').delete(id);
  const logStore = tx.objectStore('habitLogs');
  const index = logStore.index('habitId');
  const logs = await txPromise(index.getAll(id));
  for (const log of logs) {
    logStore.delete(log.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function archiveHabit(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('habits', 'readwrite');
  const store = tx.objectStore('habits');
  const habit = await txPromise(store.get(id));
  if (habit) {
    habit.archived = true;
    store.put(habit);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveHabitLog(log: HabitLog): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('habitLogs', 'readwrite');
  tx.objectStore('habitLogs').put(log);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHabitLogsForDate(date: string): Promise<HabitLog[]> {
  const db = await openDB();
  const tx = db.transaction('habitLogs', 'readonly');
  const index = tx.objectStore('habitLogs').index('date');
  return txPromise(index.getAll(date));
}

export async function getHabitLogsForRange(habitId: string, startDate: string, endDate: string): Promise<HabitLog[]> {
  const db = await openDB();
  const tx = db.transaction('habitLogs', 'readonly');
  const index = tx.objectStore('habitLogs').index('habitId');
  const allLogs = await txPromise(index.getAll(habitId));
  return allLogs.filter((l: HabitLog) => l.date >= startDate && l.date <= endDate);
}

export async function toggleHabitLog(habitId: string, date: string): Promise<boolean> {
  const db = await openDB();
  const id = `${habitId}_${date}`;
  const tx = db.transaction('habitLogs', 'readwrite');
  const store = tx.objectStore('habitLogs');
  const existing = await txPromise(store.get(id));
  const newCompleted = existing ? !existing.completed : true;
  store.put({
    id,
    habitId,
    date,
    completed: newCompleted,
    timestamp: Date.now(),
  } as HabitLog);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return newCompleted;
}

export async function clearAllData(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['entries', 'context', 'insights', 'deepInsights', 'nudges', 'habits', 'habitLogs'], 'readwrite');
  tx.objectStore('entries').clear();
  tx.objectStore('context').clear();
  tx.objectStore('insights').clear();
  tx.objectStore('deepInsights').clear();
  tx.objectStore('nudges').clear();
  tx.objectStore('habits').clear();
  tx.objectStore('habitLogs').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportEntries(): Promise<string> {
  const entries = await getAllEntries();
  return JSON.stringify(entries, null, 2);
}
