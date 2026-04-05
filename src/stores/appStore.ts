import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ToneMode, JournalEntry } from '../lib/types';

interface AppState {
  // Settings
  toneMode: ToneMode;
  onboardingComplete: boolean;
  setToneMode: (mode: ToneMode) => void;
  completeOnboarding: () => void;

  // Navigation
  currentPage: 'journal' | 'insights' | 'settings';
  setCurrentPage: (page: 'journal' | 'insights' | 'settings') => void;

  // Active session
  activeSession: boolean;
  sessionStartTime: number | null;
  viewingEntry: JournalEntry | null;
  setActiveSession: (active: boolean) => void;
  setSessionStartTime: (time: number | null) => void;
  setViewingEntry: (entry: JournalEntry | null) => void;

  // Entries cache (refreshed from IndexedDB)
  entries: JournalEntry[];
  setEntries: (entries: JournalEntry[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      toneMode: 'companion',
      onboardingComplete: false,
      setToneMode: (mode) => set({ toneMode: mode }),
      completeOnboarding: () => set({ onboardingComplete: true }),

      currentPage: 'journal',
      setCurrentPage: (page) => set({ currentPage: page }),

      activeSession: false,
      sessionStartTime: null,
      viewingEntry: null,
      setActiveSession: (active) => set({ activeSession: active }),
      setSessionStartTime: (time) => set({ sessionStartTime: time }),
      setViewingEntry: (entry) => set({ viewingEntry: entry }),

      entries: [],
      setEntries: (entries) => set({ entries }),
    }),
    {
      name: 'reflect-settings',
      partialize: (state) => ({
        toneMode: state.toneMode,
        onboardingComplete: state.onboardingComplete,
      }),
    }
  )
);
