import { useState } from 'react';

interface MoodCheckinProps {
  onComplete: (mood: number, energy: number) => void;
}

export default function MoodCheckin({ onComplete }: MoodCheckinProps) {
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full">
        <h2 className="font-serif text-2xl mb-8 text-center">How are you right now?</h2>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-[var(--color-text-muted)]">Mood</span>
            <span className="text-lg font-medium tabular-nums">{mood}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={e => setMood(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-mood-low), var(--color-mood-mid) 50%, var(--color-mood-high))`,
            }}
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
            <span>rough</span>
            <span>great</span>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-[var(--color-text-muted)]">Energy</span>
            <span className="text-lg font-medium tabular-nums">{energy}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={energy}
            onChange={e => setEnergy(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-bg-hover), var(--color-energy))`,
            }}
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
            <span>drained</span>
            <span>wired</span>
          </div>
        </div>

        <button
          onClick={() => onComplete(mood, energy)}
          className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium text-lg hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
        >
          Begin
        </button>
      </div>
    </div>
  );
}
