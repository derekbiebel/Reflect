import { useMemo } from 'react';
import type { Habit, HabitLog, JournalEntry } from '../lib/types';

interface HabitInsightsProps {
  habits: Habit[];
  logs: HabitLog[];
  entries: JournalEntry[];
}

// ── Helpers ──────────────────────────────────────────────

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isScheduledDay(habit: Habit, date: string): boolean {
  const d = new Date(date + 'T12:00:00');
  const day = d.getDay();
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return day >= 1 && day <= 5;
  if (habit.frequency === 'custom' && habit.customDays) {
    return habit.customDays.includes(day);
  }
  return true;
}

function dayName(dayIndex: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return formatDate(d);
}

// ── Analytics Computations ──────────────────────────────

interface MoodCorrelation {
  habit: Habit;
  avgWhenDone: number;
  avgWhenSkipped: number;
  diff: number;
  doneCount: number;
  skippedCount: number;
}

function computeMoodCorrelations(
  habits: Habit[],
  logsByDate: Map<string, Map<string, boolean>>,
  entriesByDate: Map<string, JournalEntry>,
  field: 'mood' | 'energy'
): MoodCorrelation[] {
  const results: MoodCorrelation[] = [];

  for (const habit of habits) {
    let doneSum = 0, doneCount = 0;
    let skippedSum = 0, skippedCount = 0;

    for (const [date, entry] of entriesByDate) {
      if (!isScheduledDay(habit, date)) continue;
      const habitLogs = logsByDate.get(date);
      const completed = habitLogs?.get(habit.id) ?? false;
      const value = entry[field];

      if (completed) {
        doneSum += value;
        doneCount++;
      } else {
        skippedSum += value;
        skippedCount++;
      }
    }

    if (doneCount >= 5 && skippedCount >= 5) {
      const avgDone = doneSum / doneCount;
      const avgSkipped = skippedSum / skippedCount;
      results.push({
        habit,
        avgWhenDone: avgDone,
        avgWhenSkipped: avgSkipped,
        diff: avgDone - avgSkipped,
        doneCount,
        skippedCount,
      });
    }
  }

  return results.sort((a, b) => b.diff - a.diff);
}

interface StreakInfo {
  habit: Habit;
  current: number;
  longest: number;
}

function computeStreaks(
  habits: Habit[],
  logsByDate: Map<string, Map<string, boolean>>
): StreakInfo[] {
  const today = new Date();
  const results: StreakInfo[] = [];

  for (const habit of habits) {
    let current = 0;
    let longest = 0;
    let currentStreak = 0;
    let foundBreak = false;

    // Go back up to 365 days
    const d = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dateStr = formatDate(d);
      if (!isScheduledDay(habit, dateStr)) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      const completed = logsByDate.get(dateStr)?.get(habit.id) ?? false;
      if (completed) {
        currentStreak++;
        if (currentStreak > longest) longest = currentStreak;
      } else {
        if (i === 0) {
          // today not done yet, skip
          d.setDate(d.getDate() - 1);
          continue;
        }
        if (!foundBreak) {
          current = currentStreak;
          foundBreak = true;
        }
        currentStreak = 0;
      }
      d.setDate(d.getDate() - 1);
    }
    if (!foundBreak) current = currentStreak;

    results.push({ habit, current, longest });
  }

  return results.sort((a, b) => b.longest - a.longest);
}

interface CompletionRate {
  habit: Habit;
  rate: number;
  completed: number;
  scheduled: number;
}

function computeCompletionRates(
  habits: Habit[],
  logsByDate: Map<string, Map<string, boolean>>
): CompletionRate[] {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results: CompletionRate[] = [];

  for (const habit of habits) {
    let scheduled = 0, completed = 0;
    const d = new Date(thirtyDaysAgo);
    while (d <= today) {
      const dateStr = formatDate(d);
      if (isScheduledDay(habit, dateStr)) {
        scheduled++;
        if (logsByDate.get(dateStr)?.get(habit.id)) completed++;
      }
      d.setDate(d.getDate() + 1);
    }
    results.push({
      habit,
      rate: scheduled > 0 ? (completed / scheduled) * 100 : 0,
      completed,
      scheduled,
    });
  }

  return results.sort((a, b) => b.rate - a.rate);
}

interface DayOfWeekStats {
  day: number;
  name: string;
  rate: number;
  completed: number;
  scheduled: number;
}

function computeBestDayOfWeek(
  habits: Habit[],
  logsByDate: Map<string, Map<string, boolean>>
): DayOfWeekStats[] {
  const today = new Date();
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const days: { scheduled: number; completed: number }[] = Array.from(
    { length: 7 },
    () => ({ scheduled: 0, completed: 0 })
  );

  const d = new Date(sixtyDaysAgo);
  while (d <= today) {
    const dateStr = formatDate(d);
    const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
    for (const habit of habits) {
      if (isScheduledDay(habit, dateStr)) {
        days[dayOfWeek].scheduled++;
        if (logsByDate.get(dateStr)?.get(habit.id)) {
          days[dayOfWeek].completed++;
        }
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return days.map((s, i) => ({
    day: i,
    name: dayName(i),
    rate: s.scheduled > 0 ? (s.completed / s.scheduled) * 100 : 0,
    completed: s.completed,
    scheduled: s.scheduled,
  }));
}

interface WeeklyTrend {
  weekLabel: string;
  count: number;
}

function computeWeeklyTrend(
  logs: HabitLog[]
): WeeklyTrend[] {
  const today = new Date();
  const eightWeeksAgo = new Date(today);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  // Group completed logs by week
  const weekCounts = new Map<string, number>();
  for (const log of logs) {
    if (!log.completed) continue;
    const logDate = new Date(log.date + 'T12:00:00');
    if (logDate < eightWeeksAgo) continue;
    const weekStart = getWeekStart(logDate);
    weekCounts.set(weekStart, (weekCounts.get(weekStart) || 0) + 1);
  }

  // Build 8 weeks of data
  const weeks: WeeklyTrend[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const weekStart = getWeekStart(d);
    const weekDate = new Date(weekStart + 'T12:00:00');
    const label = `${weekDate.getMonth() + 1}/${weekDate.getDate()}`;
    weeks.push({
      weekLabel: label,
      count: weekCounts.get(weekStart) || 0,
    });
  }

  return weeks;
}

// ── Card Components ─────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-4 rounded-xl mb-3"
      style={{ backgroundColor: 'var(--color-bg-hover)' }}
    >
      <h3
        className="text-sm font-sans font-medium mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export default function HabitInsights({ habits, logs, entries }: HabitInsightsProps) {
  // Pre-process data into lookup maps
  const { logsByDate, entriesByDate } = useMemo(() => {
    const lbd = new Map<string, Map<string, boolean>>();
    for (const log of logs) {
      if (!lbd.has(log.date)) lbd.set(log.date, new Map());
      lbd.get(log.date)!.set(log.habitId, log.completed);
    }
    const ebd = new Map<string, JournalEntry>();
    for (const entry of entries) {
      ebd.set(entry.date, entry);
    }
    return { logsByDate: lbd, entriesByDate: ebd };
  }, [logs, entries]);

  const moodCorrelations = useMemo(
    () => computeMoodCorrelations(habits, logsByDate, entriesByDate, 'mood'),
    [habits, logsByDate, entriesByDate]
  );

  const energyCorrelations = useMemo(
    () => computeMoodCorrelations(habits, logsByDate, entriesByDate, 'energy'),
    [habits, logsByDate, entriesByDate]
  );

  const streaks = useMemo(
    () => computeStreaks(habits, logsByDate),
    [habits, logsByDate]
  );

  const completionRates = useMemo(
    () => computeCompletionRates(habits, logsByDate),
    [habits, logsByDate]
  );

  const dayOfWeekStats = useMemo(
    () => computeBestDayOfWeek(habits, logsByDate),
    [habits, logsByDate]
  );

  const weeklyTrend = useMemo(
    () => computeWeeklyTrend(logs),
    [logs]
  );

  const maxWeekly = useMemo(
    () => Math.max(...weeklyTrend.map(w => w.count), 1),
    [weeklyTrend]
  );

  if (habits.length === 0) {
    return (
      <div className="text-center mt-20">
        <div className="text-4xl mb-3">📊</div>
        <p style={{ color: 'var(--color-text-muted)' }} className="text-sm font-sans">
          Add some habits to see insights
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Mood Correlation */}
      <Card title="Mood Correlation">
        {moodCorrelations.length === 0 ? (
          <p className="text-xs font-sans" style={{ color: 'var(--color-text-muted)' }}>
            Need 5+ journal entries on days with and without each habit to show correlations.
          </p>
        ) : (
          <div className="space-y-3">
            {moodCorrelations.map(c => (
              <div key={c.habit.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-sans" style={{ color: 'var(--color-text)' }}>
                    {c.habit.icon} {c.habit.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: c.diff >= 0 ? 'var(--color-secondary)' : 'var(--color-accent)' }}
                  >
                    {c.diff >= 0 ? '+' : ''}{c.diff.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{c.avgWhenDone.toFixed(1)} when done</span>
                  <span>vs</span>
                  <span>{c.avgWhenSkipped.toFixed(1)} when skipped</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Best Streaks */}
      <Card title="Best Streaks">
        <div className="space-y-2.5">
          {streaks.map(s => {
            const maxStreak = Math.max(...streaks.map(x => x.longest), 1);
            return (
              <div key={s.habit.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-sans" style={{ color: 'var(--color-text)' }}>
                    {s.habit.icon} {s.habit.name}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    <span>now: {s.current}d</span>
                    <span>best: {s.longest}d</span>
                  </div>
                </div>
                <div className="flex gap-1 items-end h-4">
                  {/* Current streak bar */}
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${Math.max((s.current / maxStreak) * 100, 2)}%`,
                      backgroundColor: 'var(--color-accent)',
                      opacity: 0.6,
                    }}
                  />
                  {/* Longest streak bar */}
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${Math.max((s.longest / maxStreak) * 100, 2)}%`,
                      backgroundColor: 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Completion Rate (Last 30 Days) */}
      <Card title="Completion Rate — Last 30 Days">
        <div className="space-y-2.5">
          {completionRates.map(c => {
            const rateColor =
              c.rate > 80 ? 'var(--color-secondary)' :
              c.rate >= 50 ? '#d4a843' :
              'var(--color-accent)';
            return (
              <div key={c.habit.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-sans" style={{ color: 'var(--color-text)' }}>
                    {c.habit.icon} {c.habit.name}
                  </span>
                  <span className="text-xs font-mono" style={{ color: rateColor }}>
                    {Math.round(c.rate)}%
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${c.rate}%`,
                      backgroundColor: rateColor,
                    }}
                  />
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {c.completed}/{c.scheduled}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Best Day of Week */}
      <Card title="Best Day of Week">
        <div className="flex gap-1.5 items-end" style={{ height: '80px' }}>
          {dayOfWeekStats.map(d => {
            const maxRate = Math.max(...dayOfWeekStats.map(x => x.rate), 1);
            const barHeight = d.rate > 0 ? Math.max((d.rate / maxRate) * 100, 8) : 4;
            const isBest = d.rate === Math.max(...dayOfWeekStats.map(x => x.rate)) && d.rate > 0;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                <span
                  className="text-xs font-mono mb-1"
                  style={{
                    color: isBest ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontSize: '10px',
                  }}
                >
                  {Math.round(d.rate)}%
                </span>
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: isBest ? 'var(--color-accent)' : 'var(--color-primary)',
                    opacity: isBest ? 1 : 0.5,
                  }}
                />
                <span
                  className="text-xs font-sans mt-1"
                  style={{
                    color: isBest ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontSize: '10px',
                    fontWeight: isBest ? 600 : 400,
                  }}
                >
                  {d.name}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Habit + Energy */}
      <Card title="Energy Correlation">
        {energyCorrelations.length === 0 ? (
          <p className="text-xs font-sans" style={{ color: 'var(--color-text-muted)' }}>
            Need 5+ journal entries on days with and without each habit to show correlations.
          </p>
        ) : (
          <div className="space-y-3">
            {energyCorrelations.map(c => (
              <div key={c.habit.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-sans" style={{ color: 'var(--color-text)' }}>
                    {c.habit.icon} {c.habit.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: c.diff >= 0 ? 'var(--color-secondary)' : 'var(--color-accent)' }}
                  >
                    {c.diff >= 0 ? '+' : ''}{c.diff.toFixed(1)} energy
                  </span>
                </div>
                <p className="text-xs font-sans" style={{ color: 'var(--color-text-muted)' }}>
                  {c.avgWhenDone.toFixed(1)} when done vs {c.avgWhenSkipped.toFixed(1)} when skipped
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Monthly Trend */}
      <Card title="Weekly Completions — Last 8 Weeks">
        <div className="flex gap-1.5 items-end" style={{ height: '80px' }}>
          {weeklyTrend.map((w, i) => {
            const barHeight = w.count > 0 ? Math.max((w.count / maxWeekly) * 100, 6) : 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span
                  className="font-mono mb-1"
                  style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}
                >
                  {w.count > 0 ? w.count : ''}
                </span>
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: 'var(--color-primary)',
                    opacity: w.count > 0 ? 0.7 : 0.2,
                  }}
                />
                <span
                  className="font-mono mt-1"
                  style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}
                >
                  {w.weekLabel}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
