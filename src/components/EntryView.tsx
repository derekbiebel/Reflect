import type { JournalEntry } from '../lib/types';

interface EntryViewProps {
  entry: JournalEntry;
  onBack: () => void;
}

export default function EntryView({ entry, onBack }: EntryViewProps) {
  const date = new Date(entry.date + 'T12:00:00');
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-bg-hover)]">
        <button
          onClick={onBack}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <div className="text-sm font-medium">{formatted}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Mood {entry.mood}/10 · Energy {entry.energy}/10
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {entry.themes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {entry.themes.map((theme, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
              >
                {theme}
              </span>
            ))}
          </div>
        )}

        {entry.responses.map((r, i) => (
          <div key={i} className={r.role === 'claude' ? 'pr-8' : 'pl-8'}>
            {r.role === 'claude' ? (
              <p className="font-serif text-lg text-[var(--color-text)] leading-relaxed italic">
                {r.content}
              </p>
            ) : (
              <div className="bg-[var(--color-bg-card)] rounded-2xl px-4 py-3">
                <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{r.content}</p>
              </div>
            )}
          </div>
        ))}

        {entry.closingReflection && (
          <div className="pt-4 border-t border-[var(--color-bg-hover)]">
            <p className="font-serif text-lg text-[var(--color-text-muted)] leading-relaxed italic text-center">
              "{entry.closingReflection}"
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[var(--color-bg-hover)] text-center">
        <span className="text-xs text-[var(--color-text-muted)]">
          {entry.wordCount} words · {Math.round(entry.sessionDuration / 60)} min session
        </span>
      </div>
    </div>
  );
}
