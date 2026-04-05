import type { JournalEntry, UserContext, ToneMode } from './types';
import { getAllEntries, saveContext } from './db';

export async function rebuildContext(toneMode: ToneMode): Promise<UserContext> {
  const entries = await getAllEntries();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recent30 = entries.filter(e => new Date(e.date) >= thirtyDaysAgo);
  const recent14 = entries.filter(e => new Date(e.date) >= fourteenDaysAgo);

  // Theme frequency from last 30 days
  const themeCounts: Record<string, number> = {};
  for (const entry of recent30) {
    for (const theme of entry.themes) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }
  const recentThemes = Object.entries(themeCounts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Mood baseline from last 14 days
  const moodBaseline = recent14.length > 0
    ? recent14.reduce((sum, e) => sum + e.mood, 0) / recent14.length
    : 5;

  // Open threads: themes that appeared in recent entries but weren't "resolved"
  // Simple heuristic: themes from last 3 entries that appeared only once
  const last3 = entries.slice(0, 3);
  const last3Themes: Record<string, number> = {};
  for (const entry of last3) {
    for (const theme of entry.themes) {
      last3Themes[theme] = (last3Themes[theme] || 0) + 1;
    }
  }
  const openThreads = Object.entries(last3Themes)
    .filter(([, count]) => count === 1)
    .map(([theme]) => theme)
    .slice(0, 3);

  // Avoidance patterns: themes that were frequent then stopped
  const olderEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d < fourteenDaysAgo && d >= thirtyDaysAgo;
  });
  const olderThemeCounts: Record<string, number> = {};
  for (const entry of olderEntries) {
    for (const theme of entry.themes) {
      olderThemeCounts[theme] = (olderThemeCounts[theme] || 0) + 1;
    }
  }
  const recentThemeSet = new Set(recent14.flatMap(e => e.themes));
  const avoidancePatterns = Object.entries(olderThemeCounts)
    .filter(([theme, count]) => count >= 2 && !recentThemeSet.has(theme))
    .map(([theme]) => theme);

  // Streak calculation
  const sortedDates = [...new Set(entries.map(e => e.date))].sort().reverse();
  let longestStreak = 0;
  let currentRun = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentRun++;
      } else {
        currentRun = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentRun);
  }

  const context: UserContext = {
    recentThemes,
    moodBaseline,
    openThreads,
    avoidancePatterns,
    longestStreak,
    totalEntries: entries.length,
    toneMode,
  };

  await saveContext(context);
  return context;
}

export function calculateStreak(entries: JournalEntry[]): { current: number; longest: number } {
  if (entries.length === 0) return { current: 0, longest: 0 };

  const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Current streak
  let current = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  // Longest streak
  let longest = 0;
  let run = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        run++;
      } else {
        run = 1;
      }
    }
    longest = Math.max(longest, run);
  }

  return { current, longest };
}
