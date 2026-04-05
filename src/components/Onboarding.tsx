import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { ToneMode } from '../lib/types';

const tones: { mode: ToneMode; label: string; desc: string }[] = [
  { mode: 'companion', label: 'Companion', desc: 'Warm, curious, gently encouraging. Like a thoughtful friend.' },
  { mode: 'coach', label: 'Coach', desc: 'Neutral, focused, direct. Present but not leading.' },
  { mode: 'minimal', label: 'Minimal', desc: 'Sparse, clean, no-frills. Just the prompt.' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<ToneMode>('companion');
  const { setToneMode, completeOnboarding } = useAppStore();

  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-4xl mb-4 text-[var(--color-text)]">Reflect</h1>
          <p className="text-[var(--color-text-muted)] text-lg mb-10">A journal that learns you.</p>
          <button
            onClick={() => setStep(1)}
            className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-lg hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full">
        <h2 className="font-serif text-2xl mb-2 text-center">Choose your tone</h2>
        <p className="text-[var(--color-text-muted)] text-sm mb-8 text-center">How should your journal talk to you? You can change this anytime.</p>

        <div className="space-y-3 mb-8">
          {tones.map(({ mode, label, desc }) => (
            <button
              key={mode}
              onClick={() => setSelected(mode)}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ${
                selected === mode
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border-[var(--color-bg-hover)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <div className="font-medium text-[var(--color-text)] mb-1">{label}</div>
              <div className="text-sm text-[var(--color-text-muted)]">{desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setToneMode(selected);
            completeOnboarding();
          }}
          className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-lg hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
        >
          Start Journaling
        </button>
      </div>
    </div>
  );
}
