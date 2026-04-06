import { useState, useEffect, useCallback } from 'react';
import type { Habit, HabitLog } from '../lib/types';
import {
  getAllHabits,
  saveHabit,
  deleteHabit,
  toggleHabitLog,
  getHabitLogsForDate,
  getHabitLogsForRange,
} from '../lib/db';

const EMOJI_OPTIONS = [
  '✅', '📖', '🏃', '💧', '😴', '🧘', '💪', '🎯',
  '✍️', '🥗', '💊', '🎵', '🧹', '📵', '🌅', '🚶',
  '🧠', '❤️', '🎨', '🌿',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getToday(): string {
  return formatDate(new Date());
}

function getPastDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
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

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLogs, setTodayLogs] = useState<Map<string, HabitLog>>(new Map());
  const [weekLogs, setWeekLogs] = useState<Map<string, HabitLog[]>>(new Map());
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = getToday();
  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const loadData = useCallback(async () => {
    const allHabits = await getAllHabits();
    setHabits(allHabits);

    // Load today's logs
    const logs = await getHabitLogsForDate(today);
    const logMap = new Map<string, HabitLog>();
    for (const l of logs) logMap.set(l.habitId, l);
    setTodayLogs(logMap);

    // Load last 7 days of logs for each habit + calculate streaks
    const past7 = getPastDates(7);
    const startDate = past7[0];
    const endDate = past7[past7.length - 1];
    const newWeekLogs = new Map<string, HabitLog[]>();
    const newStreaks = new Map<string, number>();

    for (const habit of allHabits) {
      // Week logs
      const hLogs = await getHabitLogsForRange(habit.id, startDate, endDate);
      newWeekLogs.set(habit.id, hLogs);

      // Streak calculation - go back up to 365 days
      const streakLogs = await getHabitLogsForRange(
        habit.id,
        formatDate((() => { const d = new Date(); d.setDate(d.getDate() - 365); return d; })()),
        today
      );
      const logsByDate = new Map<string, boolean>();
      for (const l of streakLogs) logsByDate.set(l.date, l.completed);

      let streak = 0;
      const d = new Date();
      // Start from today and go backwards
      for (let i = 0; i < 365; i++) {
        const dateStr = formatDate(d);
        if (!isScheduledDay(habit, dateStr)) {
          d.setDate(d.getDate() - 1);
          continue; // skip non-scheduled days
        }
        if (logsByDate.get(dateStr)) {
          streak++;
        } else {
          // If today and not yet done, don't break - just skip today
          if (i === 0) {
            d.setDate(d.getDate() - 1);
            continue;
          }
          break;
        }
        d.setDate(d.getDate() - 1);
      }
      newStreaks.set(habit.id, streak);
    }

    setWeekLogs(newWeekLogs);
    setStreaks(newStreaks);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if all today's habits are done
  useEffect(() => {
    if (habits.length === 0) return;
    const todayHabits = habits.filter(h => isScheduledDay(h, today));
    if (todayHabits.length === 0) return;
    const allCompleted = todayHabits.every(h => {
      const log = todayLogs.get(h.id);
      return log?.completed;
    });
    if (allCompleted && !allDone) {
      setAllDone(true);
      setTimeout(() => setAllDone(false), 3000);
    }
  }, [todayLogs, habits, today, allDone]);

  async function handleToggle(habitId: string) {
    setTogglingId(habitId);
    const newCompleted = await toggleHabitLog(habitId, today);
    // Update local state
    setTodayLogs(prev => {
      const next = new Map(prev);
      next.set(habitId, {
        id: `${habitId}_${today}`,
        habitId,
        date: today,
        completed: newCompleted,
        timestamp: Date.now(),
      });
      return next;
    });
    setTimeout(() => setTogglingId(null), 400);
    // Reload streaks
    await loadData();
  }

  async function handleDelete(habitId: string) {
    await deleteHabit(habitId);
    await loadData();
  }

  // Weekly completion rate
  const weekDates = getPastDates(7);
  const weeklyStats = (() => {
    let scheduled = 0;
    let completed = 0;
    for (const habit of habits) {
      for (const date of weekDates) {
        if (isScheduledDay(habit, date)) {
          scheduled++;
          const logs = weekLogs.get(habit.id) || [];
          const log = logs.find(l => l.date === date);
          if (log?.completed) completed++;
        }
      }
    }
    return { scheduled, completed, rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0 };
  })();

  if (loading) {
    return (
      <div className="px-5 pt-14 pb-24">
        <div className="text-[var(--color-text-muted)] text-center mt-20">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-sans font-semibold text-[var(--color-text)]">Habits</h1>
        <button
          onClick={() => setShowModal(true)}
          className="w-9 h-9 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xl leading-none hover:opacity-90 transition-opacity"
        >
          +
        </button>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">{todayDisplay}</p>

      {/* All done celebration */}
      {allDone && (
        <div className="mb-4 py-3 px-4 rounded-xl bg-[var(--color-secondary)] text-[var(--color-text)] text-center text-sm font-sans transition-all duration-500">
          All habits done for today — nice work!
        </div>
      )}

      {/* Habit list */}
      {habits.length === 0 ? (
        <div className="text-center mt-20">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-[var(--color-text-muted)] mb-4">No habits yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-sans text-sm hover:opacity-90 transition-opacity"
          >
            Add your first habit
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(habit => {
            const log = todayLogs.get(habit.id);
            const isCompleted = log?.completed ?? false;
            const isToggling = togglingId === habit.id;
            const streak = streaks.get(habit.id) ?? 0;
            const scheduled = isScheduledDay(habit, today);

            return (
              <div
                key={habit.id}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300"
                style={{
                  backgroundColor: isToggling && isCompleted
                    ? 'var(--color-secondary)'
                    : 'var(--color-bg-hover)',
                  opacity: scheduled ? 1 : 0.5,
                }}
              >
                {/* Toggle button */}
                <button
                  onClick={() => scheduled && handleToggle(habit.id)}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{
                    borderColor: isCompleted ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    backgroundColor: isCompleted ? 'var(--color-accent)' : 'transparent',
                  }}
                  disabled={!scheduled}
                >
                  {isCompleted && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isToggling ? 'animate-check' : ''}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Emoji + name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{habit.icon}</span>
                  <span
                    className="font-sans text-sm truncate"
                    style={{
                      color: isCompleted ? 'var(--color-text-muted)' : 'var(--color-text)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                    }}
                  >
                    {habit.name}
                  </span>
                </div>

                {/* Streak */}
                {streak > 0 && (
                  <span className="font-mono text-xs text-[var(--color-accent)] flex-shrink-0">
                    {streak}d
                  </span>
                )}

                {/* 7-day dot grid */}
                <div className="flex gap-1 flex-shrink-0">
                  {weekDates.map(date => {
                    const dayScheduled = isScheduledDay(habit, date);
                    const logs = weekLogs.get(habit.id) || [];
                    const dayLog = logs.find(l => l.date === date);
                    const done = dayLog?.completed ?? false;

                    let bg: string;
                    if (!dayScheduled) bg = 'var(--color-bg)';
                    else if (done) bg = 'var(--color-accent)';
                    else bg = 'var(--color-text-muted)';

                    return (
                      <div
                        key={date}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: bg,
                          opacity: !dayScheduled ? 0.3 : done ? 1 : 0.25,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(habit.id)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Delete habit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly summary */}
      {habits.length > 0 && (
        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-hover)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-sans text-[var(--color-text-muted)]">This week</span>
            <span className="font-mono text-sm text-[var(--color-text)]">{weeklyStats.rate}%</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${weeklyStats.rate}%`,
                backgroundColor: 'var(--color-accent)',
              }}
            />
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1.5 font-mono">
            {weeklyStats.completed}/{weeklyStats.scheduled} completed
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {showModal && (
        <AddHabitModal
          onClose={() => setShowModal(false)}
          onSave={async (habit) => {
            await saveHabit(habit);
            setShowModal(false);
            await loadData();
          }}
        />
      )}

      {/* Inline keyframe style for check animation */}
      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .animate-check {
          animation: checkPop 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// ── Add Habit Modal ──────────────────────────────────────

function AddHabitModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (habit: Habit) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✅');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

  function handleSave() {
    if (!name.trim()) return;
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon,
      color: 'accent',
      frequency,
      customDays: frequency === 'custom' ? customDays : undefined,
      createdAt: Date.now(),
    };
    onSave(habit);
  }

  function toggleDay(day: number) {
    setCustomDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-t-2xl p-6 pb-10"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-sans font-semibold text-[var(--color-text)]">New Habit</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <label className="block text-sm text-[var(--color-text-muted)] mb-1.5 font-sans">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Read 20 minutes"
          className="w-full px-3 py-2.5 rounded-xl text-sm font-sans mb-4 outline-none"
          style={{
            backgroundColor: 'var(--color-bg-hover)',
            color: 'var(--color-text)',
            border: 'none',
          }}
          autoFocus
        />

        {/* Emoji picker */}
        <label className="block text-sm text-[var(--color-text-muted)] mb-1.5 font-sans">Icon</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {EMOJI_OPTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setIcon(emoji)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all"
              style={{
                backgroundColor: icon === emoji ? 'var(--color-accent)' : 'var(--color-bg-hover)',
                opacity: icon === emoji ? 1 : 0.7,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Frequency */}
        <label className="block text-sm text-[var(--color-text-muted)] mb-1.5 font-sans">Frequency</label>
        <div className="flex gap-2 mb-4">
          {(['daily', 'weekdays', 'custom'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-sans capitalize transition-all"
              style={{
                backgroundColor: frequency === f ? 'var(--color-accent)' : 'var(--color-bg-hover)',
                color: frequency === f ? 'white' : 'var(--color-text)',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Custom day toggles */}
        {frequency === 'custom' && (
          <div className="flex gap-2 mb-4">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className="w-9 h-9 rounded-full text-xs font-sans font-medium transition-all"
                style={{
                  backgroundColor: customDays.includes(i) ? 'var(--color-accent)' : 'var(--color-bg-hover)',
                  color: customDays.includes(i) ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl text-sm font-sans font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          Save Habit
        </button>
      </div>
    </div>
  );
}
