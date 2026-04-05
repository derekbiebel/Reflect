# Reflect — AI Journal App

## What this is
A personal journaling app powered by Claude. Daily entries are short and frictionless. Claude adapts its prompts based on your patterns, moods, and recurring themes. All data stays local in IndexedDB.

## Tech Stack
- **React + Vite + TypeScript** — frontend
- **Tailwind CSS v4** — styling via `@theme` in index.css
- **Zustand** — state management, persisted settings in localStorage
- **IndexedDB** — journal entries, context, insights, nudges (db.ts)
- **Recharts** — mood trend line chart
- **react-calendar-heatmap** — activity heatmap
- **Anthropic Claude API** — called directly from browser (claude.ts)
- **Vercel** — hosting (static deploy)

## Project Structure
```
src/
  lib/          # Core logic
    types.ts    # All TypeScript interfaces
    db.ts       # IndexedDB operations (version 3)
    claude.ts   # All Claude API calls
    context.ts  # UserContext builder + streak calc
    notifications.ts  # Service worker + push notifications
  stores/
    appStore.ts # Zustand store (settings, nav, session state)
  components/   # Reusable UI
    Session.tsx          # Full journal session flow
    CompletionScreen.tsx # Animated post-session screen
    MoodCheckin.tsx      # Mood/energy sliders
    EntryView.tsx        # Read-only entry viewer
    BottomNav.tsx        # Tab navigation
    Onboarding.tsx       # First-run tone selection
    MoodTrendChart.tsx   # Recharts line chart
    MoodDistribution.tsx # Bar chart of mood scores
    HeatmapCalendar.tsx  # Year activity heatmap
  pages/
    JournalPage.tsx  # Entry list + search/filter
    InsightsPage.tsx # Dashboard with all insight types
    SettingsPage.tsx # Tone, API key, reminders, data
public/
  sw.js         # Service worker for push notifications
  manifest.json # PWA manifest
```

## Key Design Decisions
- **No server** — API key stored in browser (localStorage or .env)
- **No accounts/sync** — single user, single device
- **Claude is a lens, not a therapist** — observes and reflects, never diagnoses
- **Broken streaks are neutral** — no guilt mechanics
- **Theme extraction runs silently** after every session
- **Temperature varies by call type** — high for creative prompts (0.9), low for theme extraction (0.3)
- **12 random prompt angles** rotate each session to prevent repetition

## Color Theme
Defined in `src/index.css` under `@theme`. Current palette:
- Text: `#0b161b`
- Background: `#fbfcfd`
- Primary: `#87aec0` (dusty blue)
- Secondary: `#9bcab4` (sage green)
- Accent: `#c69775` (warm terracotta)

## IndexedDB Schema (version 3)
- `entries` — JournalEntry objects (keyPath: id)
- `context` — single UserContext object (rebuilt from entries)
- `insights` — WeeklyInsight objects
- `deepInsights` — DeepInsight objects (AI-generated pattern analysis)
- `nudges` — PatternNudge objects (statistical pattern callouts)

## Claude API Calls
All in `src/lib/claude.ts`. Each session makes:
1. Opening prompt (100 tokens, temp 0.9)
2. 1-2 follow-ups (150 tokens each, temp 0.8)
3. Theme extraction (80 tokens, temp 0.3)
4. Closing reflection (60 tokens, temp 0.9)

Dashboard features (on-demand):
- Deep insights (800 tokens) — 6 types: hidden_joy, silent_drain, unspoken, blind_spot, shift, observation
- Weekly reflection (300 tokens)
- Pattern nudges (300 tokens)

## Environment
- API key: `VITE_ANTHROPIC_API_KEY` in `.env` or set in Settings UI
- Dev: `npm run dev` (runs on port 5174 to avoid conflicts)
- Build: `npm run build` (tsc -b && vite build)
- Deploy: push to main, Vercel auto-deploys
