import type { JournalEntry, UserContext, WeeklyInsight, DeepInsight, PatternNudge } from './types';

const DB_NAME = 'reflect-journal';
const DB_VERSION = 3;

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

export async function clearAllData(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['entries', 'context', 'insights', 'deepInsights', 'nudges'], 'readwrite');
  tx.objectStore('entries').clear();
  tx.objectStore('context').clear();
  tx.objectStore('insights').clear();
  tx.objectStore('deepInsights').clear();
  tx.objectStore('nudges').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportEntries(): Promise<string> {
  const entries = await getAllEntries();
  return JSON.stringify(entries, null, 2);
}
