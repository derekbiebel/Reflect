import type { JournalEntry } from '../lib/types';

interface MoodDistributionProps {
  entries: JournalEntry[];
}

export default function MoodDistribution({ entries }: MoodDistributionProps) {
  if (entries.length === 0) return null;

  // Count occurrences of each mood score
  const counts: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) counts[i] = 0;
  for (const e of entries) {
    counts[e.mood] = (counts[e.mood] || 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);

  function barColor(score: number): string {
    if (score <= 3) return 'var(--color-mood-low)';
    if (score <= 6) return 'var(--color-mood-mid)';
    return 'var(--color-mood-high)';
  }

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-4">
      <div className="flex items-end justify-between gap-1.5" style={{ height: '100px' }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(score => (
          <div key={score} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            {counts[score] > 0 && (
              <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{counts[score]}</span>
            )}
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: counts[score] > 0 ? `${Math.max((counts[score] / max) * 70, 4)}px` : '2px',
                backgroundColor: counts[score] > 0 ? barColor(score) : 'var(--color-bg-hover)',
                minHeight: '2px',
              }}
            />
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
