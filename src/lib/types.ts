export type ToneMode = 'companion' | 'coach' | 'minimal';

export interface EntryResponse {
  role: 'user' | 'claude';
  content: string;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  timestamp: number;
  mood: number;
  moodLabel: string;
  energy: number;
  prompt: string;
  responses: EntryResponse[];
  themes: string[];
  wordCount: number;
  sessionDuration: number;
  toneMode: ToneMode;
  closingReflection?: string;
}

export interface UserContext {
  recentThemes: { theme: string; count: number }[];
  moodBaseline: number;
  openThreads: string[];
  avoidancePatterns: string[];
  longestStreak: number;
  totalEntries: number;
  toneMode: ToneMode;
}

export interface AppSettings {
  toneMode: ToneMode;
  onboardingComplete: boolean;
  apiKey: string;
}

export interface StreakData {
  current: number;
  longest: number;
  lastEntryDate: string | null;
}

export interface WeeklyInsight {
  id: string;
  date: string;
  content: string;
  weekStart: string;
  weekEnd: string;
}

export type DeepInsightType =
  | 'hidden_joy'       // Things correlated with better mood the user might not notice
  | 'silent_drain'     // Things correlated with worse mood
  | 'unspoken'         // Mentioned briefly but never explored
  | 'blind_spot'       // Patterns the user can't see from inside
  | 'shift'            // Something that's changing over time
  | 'observation';     // General qualitative insight

export interface DeepInsight {
  id: string;
  type: DeepInsightType;
  title: string;        // Short label, e.g. "Morning walks"
  content: string;      // The actual insight text
  confidence: number;   // 1-3: how much data supports this (shows as subtle indicator)
  generatedAt: number;  // timestamp
  basedOnEntries: number; // how many entries were analyzed
  dismissed?: boolean;  // user can dismiss stale insights
}

export interface PatternNudge {
  id: string;
  content: string;
  generatedAt: number;
  dismissed?: boolean;
}
