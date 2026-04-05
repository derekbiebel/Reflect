import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { calculateStreak } from '../lib/context';
import { generateDeepInsights, generateWeeklyInsight, generatePatternNudges } from '../lib/claude';
import { getDeepInsights, saveDeepInsights, dismissDeepInsight, saveInsight, getLatestWeeklyInsight, saveNudges, getNudges, dismissNudge, getContext } from '../lib/db';
import type { DeepInsight, DeepInsightType, WeeklyInsight, PatternNudge, UserContext } from '../lib/types';
import MoodTrendChart from '../components/MoodTrendChart';
import MoodDistribution from '../components/MoodDistribution';
import HeatmapCalendar from '../components/HeatmapCalendar';
import { v4 as uuid } from 'uuid';

function InsightIcon({ type, color }: { type: DeepInsightType; color: string }) {
  const style = { color };
  switch (type) {
    case 'hidden_joy':
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      );
    case 'silent_drain':
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 17 12 22 7 17"/>
        </svg>
      );
    case 'unspoken':
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>
        </svg>
      );
    case 'blind_spot':
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/>
        </svg>
      );
    case 'shift':
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      );
    default:
      return (
        <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
  }
}

const insightMeta: Record<string, { label: string; color: string }> = {
  hidden_joy:   { label: 'Hidden Joy',   color: 'var(--color-mood-high)' },
  silent_drain: { label: 'Silent Drain',  color: 'var(--color-mood-low)' },
  unspoken:     { label: 'Unspoken',      color: 'var(--color-energy)' },
  blind_spot:   { label: 'Blind Spot',    color: 'var(--color-mood-mid)' },
  shift:        { label: 'Shift',         color: 'var(--color-accent)' },
  observation:  { label: 'Observation',   color: 'var(--color-text-muted)' },
};

export default function InsightsPage() {
  const { entries, toneMode } = useAppStore();
  const streak = calculateStreak(entries);
  const [deepInsights, setDeepInsights] = useState<DeepInsight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [nudges, setNudges] = useState<PatternNudge[]>([]);
  const [nudgesLoading, setNudgesLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  useEffect(() => {
    getDeepInsights().then(insights => {
      setDeepInsights(insights);
      if (insights.length > 0) {
        setLastGenerated(insights[0].generatedAt);
      }
    });
    getLatestWeeklyInsight().then(w => setWeeklyInsight(w || null));
    getNudges().then(setNudges);
    getContext().then(ctx => setUserContext(ctx || null));
  }, []);

  async function handleGenerateInsights() {
    if (entries.length < 3) return;
    setGenerating(true);
    try {
      const insights = await generateDeepInsights(entries);
      if (insights.length > 0) {
        await saveDeepInsights(insights);
        setDeepInsights(insights);
        setLastGenerated(Date.now());
      }
    } catch {
      // Silent fail
    } finally {
      setGenerating(false);
    }
  }

  async function handleDismiss(id: string) {
    await dismissDeepInsight(id);
    setDeepInsights(prev => prev.filter(i => i.id !== id));
  }

  async function handleGenerateWeekly() {
    setWeeklyLoading(true);
    try {
      const content = await generateWeeklyInsight(entries, toneMode);
      if (content) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        const insight: WeeklyInsight = {
          id: uuid(),
          date: now.toISOString(),
          content,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: now.toISOString().split('T')[0],
        };
        await saveInsight(insight);
        setWeeklyInsight(insight);
      }
    } catch {
      // Silent fail
    } finally {
      setWeeklyLoading(false);
    }
  }

  async function handleGenerateNudges() {
    setNudgesLoading(true);
    try {
      const texts = await generatePatternNudges(entries);
      const newNudges: PatternNudge[] = texts.map((content, i) => ({
        id: `nudge-${Date.now()}-${i}`,
        content,
        generatedAt: Date.now(),
      }));
      if (newNudges.length > 0) {
        await saveNudges(newNudges);
        setNudges(newNudges);
      }
    } catch {
      // Silent fail
    } finally {
      setNudgesLoading(false);
    }
  }

  async function handleDismissNudge(id: string) {
    await dismissNudge(id);
    setNudges(prev => prev.filter(n => n.id !== id));
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-6 pb-24">
        <h1 className="font-serif text-3xl mb-6">Insights</h1>
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)]">Start journaling to unlock your insights.</p>
          <p className="text-[var(--color-text-muted)] text-sm mt-2">The more you write, the more patterns emerge.</p>
        </div>
      </div>
    );
  }

  const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);
  const avgMood = (entries.reduce((sum, e) => sum + e.mood, 0) / entries.length).toFixed(1);

  const themeCounts: Record<string, number> = {};
  for (const entry of entries) {
    for (const theme of entry.themes) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const latestEntry = entries[0]?.timestamp || 0;
  const insightsStale = lastGenerated ? latestEntry > lastGenerated : true;
  const hasEnoughEntries = entries.length >= 3;

  // Weekly insight is stale if older than 6 days
  const weeklyStale = !weeklyInsight || (Date.now() - new Date(weeklyInsight.date).getTime()) > 6 * 24 * 60 * 60 * 1000;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-serif text-3xl mb-6">Insights</h1>

      {/* Weekly Insight */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Weekly Reflection
          </h2>
          {entries.length >= 3 && (
            <button
              onClick={handleGenerateWeekly}
              disabled={weeklyLoading}
              className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
            >
              {weeklyLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                  Writing
                </span>
              ) : weeklyStale ? 'Generate' : 'Refresh'}
            </button>
          )}
        </div>
        {weeklyInsight ? (
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-4">
            <p className="font-serif text-[var(--color-text)] leading-relaxed italic">
              {weeklyInsight.content}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-3 opacity-50">
              {weeklyInsight.weekStart} &mdash; {weeklyInsight.weekEnd}
            </p>
          </div>
        ) : entries.length >= 3 ? (
          <button
            onClick={handleGenerateWeekly}
            disabled={weeklyLoading}
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-bg-hover)] rounded-2xl px-5 py-6 text-center hover:border-[var(--color-accent)] transition-colors duration-300"
          >
            {weeklyLoading ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--color-text-muted)]">Reflecting on your week...</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Tap to generate your weekly reflection</p>
            )}
          </button>
        ) : (
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">A few more entries needed for your first weekly reflection.</p>
          </div>
        )}
      </section>

      {/* Pattern Nudges */}
      {entries.length >= 5 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Patterns
            </h2>
            <button
              onClick={handleGenerateNudges}
              disabled={nudgesLoading}
              className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
            >
              {nudgesLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                  Scanning
                </span>
              ) : nudges.length > 0 ? 'Refresh' : 'Detect'}
            </button>
          </div>
          {nudges.length > 0 ? (
            <div className="space-y-2">
              {nudges.map(nudge => (
                <div key={nudge.id} className="bg-[var(--color-bg-card)] rounded-xl px-4 py-3 flex items-start gap-3 group relative">
                  <svg className="mt-0.5 shrink-0 text-[var(--color-accent)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed flex-1">{nudge.content}</p>
                  <button
                    onClick={() => handleDismissNudge(nudge.id)}
                    className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label="Dismiss"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : !nudgesLoading ? (
            <button
              onClick={handleGenerateNudges}
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-bg-hover)] rounded-2xl px-5 py-6 text-center hover:border-[var(--color-accent)] transition-colors duration-300"
            >
              <p className="text-sm text-[var(--color-text-muted)]">Tap to scan for patterns in your data</p>
            </button>
          ) : (
            <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-6 text-center">
              <div className="w-4 h-4 mx-auto mb-2 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--color-text-muted)]">Scanning your entries...</p>
            </div>
          )}
        </section>
      )}

      {/* Open Threads */}
      {userContext && userContext.openThreads.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Open Threads</h2>
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Topics you've touched on but haven't come back to.</p>
            <div className="flex flex-wrap gap-2">
              {userContext.openThreads.map((thread, i) => (
                <span key={i} className="text-sm px-3 py-1.5 rounded-full border border-[var(--color-bg-hover)] text-[var(--color-text)]">
                  {thread}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Avoidance Patterns */}
      {userContext && userContext.avoidancePatterns.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Dropped Themes</h2>
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Topics that used to come up but have gone quiet.</p>
            <div className="flex flex-wrap gap-2">
              {userContext.avoidancePatterns.map((pattern, i) => (
                <span key={i} className="text-sm px-3 py-1.5 rounded-full border border-[var(--color-mood-low)]/30 text-[var(--color-text-muted)]">
                  {pattern}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Deep Insights Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            What I've Noticed
          </h2>
          {hasEnoughEntries && deepInsights.length > 0 && (
            <button
              onClick={handleGenerateInsights}
              disabled={generating}
              className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                  Analyzing
                </span>
              ) : insightsStale ? 'Refresh' : 'Regenerate'}
            </button>
          )}
        </div>

        {!hasEnoughEntries && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-6 text-center">
            <p className="text-[var(--color-text-muted)] text-sm">
              Write a few more entries and I'll start finding patterns you might not see yourself.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 opacity-60">
              {3 - entries.length} more {3 - entries.length === 1 ? 'entry' : 'entries'} to go
            </p>
          </div>
        )}

        {hasEnoughEntries && deepInsights.length === 0 && !generating && (
          <button
            onClick={handleGenerateInsights}
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-bg-hover)] rounded-2xl px-5 py-8 text-center hover:border-[var(--color-accent)] transition-colors duration-300"
          >
            <p className="text-[var(--color-text)] font-medium mb-1">Ready to look deeper</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Analyze {entries.length} {entries.length === 1 ? 'entry' : 'entries'} for hidden patterns
            </p>
          </button>
        )}

        {hasEnoughEntries && deepInsights.length === 0 && generating && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-8 text-center">
            <div className="w-5 h-5 mx-auto mb-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Reading between the lines...</p>
          </div>
        )}

        {deepInsights.length > 0 && (
          <div className="space-y-3">
            {deepInsights.map(insight => {
              const meta = insightMeta[insight.type] || insightMeta.observation;
              return (
                <div
                  key={insight.id}
                  className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-4 relative group"
                >
                  <button
                    onClick={() => handleDismiss(insight.id)}
                    className="absolute top-3 right-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    aria-label="Dismiss"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>

                  <div className="flex items-center gap-2 mb-2">
                    <InsightIcon type={insight.type} color={meta.color} />
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <div className="flex gap-0.5 ml-auto">
                      {[1, 2, 3].map(level => (
                        <div
                          key={level}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: level <= insight.confidence
                              ? meta.color
                              : 'var(--color-bg-hover)',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-medium text-[var(--color-text)] mb-1.5">
                    {insight.title}
                  </h3>

                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {insight.content}
                  </p>
                </div>
              );
            })}

            {lastGenerated && (
              <p className="text-xs text-[var(--color-text-muted)] text-center opacity-50 pt-1">
                Based on {deepInsights[0]?.basedOnEntries || entries.length} entries &middot; {timeAgo(lastGenerated)}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Mood Trend */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Mood & Energy</h2>
        <MoodTrendChart entries={entries} />
      </section>

      {/* Heatmap */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Activity</h2>
        <HeatmapCalendar entries={entries} />
      </section>

      {/* Mood Distribution */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Mood Distribution</h2>
        <MoodDistribution entries={entries} />
      </section>

      {/* Stats grid */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">By the Numbers</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Entries" value={entries.length.toString()} />
          <StatCard label="Current Streak" value={streak.current > 0 ? `${streak.current}d` : '0d'} accent={streak.current > 0} />
          <StatCard label="Longest Streak" value={`${streak.longest}d`} />
          <StatCard label="Avg Mood" value={`${avgMood}/10`} />
          <StatCard label="Total Words" value={totalWords.toLocaleString()} />
          <StatCard label="Avg Words/Entry" value={Math.round(totalWords / entries.length).toString()} />
        </div>
      </section>

      {/* Top themes */}
      {topThemes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Top Themes</h2>
          <div className="space-y-2">
            {topThemes.map(([theme, count]) => (
              <div key={theme} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{theme}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{count}x</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                      style={{ width: `${(count / topThemes[0][1]) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl px-4 py-3">
      <div className="text-xs text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className={`text-xl font-medium ${accent ? 'text-[var(--color-accent)]' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
