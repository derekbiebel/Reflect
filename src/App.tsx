import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { getAllEntries } from './lib/db';
import Onboarding from './components/Onboarding';
import BottomNav from './components/BottomNav';
import JournalPage from './pages/JournalPage';
import InsightsPage from './pages/InsightsPage';
import SettingsPage from './pages/SettingsPage';
import HabitsPage from './pages/HabitsPage';

export default function App() {
  const { onboardingComplete, currentPage, activeSession, setEntries } = useAppStore();

  useEffect(() => {
    getAllEntries().then(setEntries);
  }, [setEntries]);

  if (!onboardingComplete) {
    return <Onboarding />;
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen relative">
      {currentPage === 'journal' && <JournalPage />}
      {currentPage === 'habits' && <HabitsPage />}
      {currentPage === 'insights' && <InsightsPage />}
      {currentPage === 'settings' && <SettingsPage />}
      {!activeSession && <BottomNav />}
    </div>
  );
}
