import { useEffect, useState } from 'react';

interface CompletionScreenProps {
  closingReflection: string;
  wordCount: number;
  sessionMinutes: number;
  onDone: () => void;
}

const celebrations = [
  'You showed up today. That matters.',
  'Another page written.',
  'Noted. Felt. Stored.',
  'That was worth your time.',
  'A little clearer now.',
];

export default function CompletionScreen({ closingReflection, wordCount, sessionMinutes, onDone }: CompletionScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const celebration = celebrations[Math.floor(Math.random() * celebrations.length)];

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden">
      {/* Floating particles */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                backgroundColor: [
                  'var(--color-accent)',
                  'var(--color-mood-high)',
                  'var(--color-energy)',
                  'var(--color-mood-mid)',
                ][i % 4],
                left: `${10 + Math.random() * 80}%`,
                top: `${20 + Math.random() * 30}%`,
                opacity: 0,
                animation: `sparkle ${1.5 + Math.random()}s ease-in-out ${Math.random() * 0.8}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-sm w-full text-center">
        {/* Checkmark circle */}
        <div className="animate-rise mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-mood-high)]/15 flex items-center justify-center animate-soft-pulse">
            <div className="w-14 h-14 rounded-full bg-[var(--color-mood-high)]/25 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-mood-high)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Celebration text */}
        <p className="animate-rise text-lg font-medium text-[var(--color-text)] mb-6">
          {celebration}
        </p>

        {/* Closing reflection */}
        {closingReflection && (
          <div className="animate-rise-delay mb-8 px-4">
            <p className="font-serif text-xl text-[var(--color-text)] leading-relaxed italic">
              "{closingReflection}"
            </p>
          </div>
        )}

        {/* Session stats */}
        <div className="animate-rise-delay-2 flex justify-center gap-6 mb-10 text-sm text-[var(--color-text-muted)]">
          <div className="text-center">
            <div className="text-lg font-medium text-[var(--color-text)]">{wordCount}</div>
            <div>words</div>
          </div>
          <div className="w-px bg-[var(--color-border)]" />
          <div className="text-center">
            <div className="text-lg font-medium text-[var(--color-text)]">{sessionMinutes}</div>
            <div>{sessionMinutes === 1 ? 'minute' : 'minutes'}</div>
          </div>
        </div>

        {/* Done button */}
        <div className="animate-rise-delay-2">
          <button
            onClick={onDone}
            className="px-10 py-3 rounded-2xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
