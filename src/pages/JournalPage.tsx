import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { getAllEntries, getTodayEntry } from '../lib/db';
import { calculateStreak } from '../lib/context';
import Session from '../components/Session';
import EntryView from '../components/EntryView';
import type { JournalEntry } from '../lib/types';

export default function JournalPage() {
  const { entries, setEntries, activeSession, setActiveSession, viewingEntry, setViewingEntry } = useAppStore();
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    const all = await getAllEntries();
    setEntries(all);
    const today = await getTodayEntry();
    setTodayEntry(today || null);
    setLoading(false);
  }

  // Collect all unique themes for the filter
  const allThemes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      for (const t of e.themes) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([theme]) => theme);
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (themeFilter) {
      result = result.filter(e => e.themes.includes(themeFilter));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.responses.some(r => r.content.toLowerCase().includes(q)) ||
        e.themes.some(t => t.toLowerCase().includes(q)) ||
        e.date.includes(q)
      );
    }

    return result;
  }, [entries, search, themeFilter]);

  if (activeSession) {
    return (
      <Session
        onClose={() => {
          setActiveSession(false);
          loadEntries();
        }}
      />
    );
  }

  if (viewingEntry) {
    return <EntryView entry={viewingEntry} onBack={() => setViewingEntry(null)} />;
  }

  const streak = calculateStreak(entries);
  const isFiltering = search.trim() || themeFilter;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl mb-1">Reflect</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Streak */}
      {streak.current > 0 && (
        <div className="flex items-center gap-2 mb-6 text-sm text-[var(--color-accent)]">
          <span className="font-serif italic">{streak.current} day streak</span>
        </div>
      )}

      {/* Start / Continue CTA */}
      {todayEntry ? (
        <button
          onClick={() => setViewingEntry(todayEntry)}
          className="w-full py-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-bg-hover)] text-left px-5 mb-8 hover:border-[var(--color-text-muted)] transition-colors duration-200"
        >
          <div className="text-sm text-[var(--color-text-muted)] mb-1">Today's entry</div>
          <div className="text-[var(--color-text)]">
            {todayEntry.responses.find(r => r.role === 'user')?.content.slice(0, 80)}
            {(todayEntry.responses.find(r => r.role === 'user')?.content.length || 0) > 80 ? '...' : ''}
          </div>
          <div className="flex gap-2 mt-2">
            {todayEntry.themes.map((t, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                {t}
              </span>
            ))}
          </div>
        </button>
      ) : (
        <button
          onClick={() => setActiveSession(true)}
          className="w-full py-5 rounded-2xl bg-[var(--color-accent)] text-white font-medium text-lg mb-8 hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
        >
          Start Today's Entry
        </button>
      )}

      {/* Search & Filter */}
      {entries.length > 0 && (
        <div className="mb-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] border border-transparent focus:border-[var(--color-bg-hover)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Theme filter pills */}
          {allThemes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {themeFilter && (
                <button
                  onClick={() => setThemeFilter(null)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                >
                  All
                </button>
              )}
              {allThemes.map(theme => (
                <button
                  key={theme}
                  onClick={() => setThemeFilter(themeFilter === theme ? null : theme)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    themeFilter === theme
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entries list */}
      {filteredEntries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              {isFiltering ? `${filteredEntries.length} result${filteredEntries.length === 1 ? '' : 's'}` : 'Past Entries'}
            </h2>
          </div>
          <div className="space-y-2">
            {filteredEntries.map(entry => {
              const date = new Date(entry.date + 'T12:00:00');
              const formatted = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

              return (
                <button
                  key={entry.id}
                  onClick={() => setViewingEntry(entry)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text)]">{formatted}</span>
                    <span className="text-sm" style={{
                      color: entry.mood <= 3 ? 'var(--color-mood-low)' : entry.mood <= 6 ? 'var(--color-mood-mid)' : 'var(--color-mood-high)'
                    }}>
                      {entry.mood}/10
                    </span>
                  </div>
                  {entry.themes.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {entry.themes.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isFiltering && filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">No entries match your search.</p>
        </div>
      )}

      {entries.length === 0 && !todayEntry && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">Your journal is empty. Start your first entry above.</p>
        </div>
      )}
    </div>
  );
}
