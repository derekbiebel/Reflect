import { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../stores/appStore';
import { generateOpeningPrompt, generateFollowUp, extractThemes, generateClosingReflection } from '../lib/claude';
import { saveEntry, getAllEntries } from '../lib/db';
import { rebuildContext } from '../lib/context';
import type { EntryResponse, JournalEntry } from '../lib/types';
import MoodCheckin from './MoodCheckin';
import CompletionScreen from './CompletionScreen';

type SessionPhase = 'checkin' | 'loading' | 'writing' | 'closing' | 'done';

export default function Session({ onClose }: { onClose: () => void }) {
  const { toneMode } = useAppStore();
  const [phase, setPhase] = useState<SessionPhase>('checkin');
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [responses, setResponses] = useState<EntryResponse[]>([]);
  const [input, setInput] = useState('');
  const [followUpCount, setFollowUpCount] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [closingReflection, setClosingReflection] = useState('');
  const [error, setError] = useState('');
  const sessionStart = useRef(Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses, isThinking]);

  useEffect(() => {
    if (phase === 'writing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, responses]);

  async function handleCheckinComplete(m: number, e: number) {
    setMood(m);
    setEnergy(e);
    setPhase('loading');
    setError('');

    try {
      const context = await rebuildContext(toneMode);
      const openingPrompt = await generateOpeningPrompt(toneMode, m, e, context);
      setPrompt(openingPrompt);
      setResponses([{ role: 'claude', content: openingPrompt, timestamp: Date.now() }]);
      setPhase('writing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
      setPhase('checkin');
    }
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userResponse: EntryResponse = { role: 'user', content: input.trim(), timestamp: Date.now() };
    const newResponses = [...responses, userResponse];
    setResponses(newResponses);
    setInput('');

    // Decide whether to follow up or let the user keep writing
    if (followUpCount < 2) {
      setIsThinking(true);
      try {
        const context = await rebuildContext(toneMode);
        const followUp = await generateFollowUp(toneMode, mood, energy, newResponses, context);
        const claudeResponse: EntryResponse = { role: 'claude', content: followUp, timestamp: Date.now() };
        setResponses([...newResponses, claudeResponse]);
        setFollowUpCount(f => f + 1);
      } catch {
        // Silently skip follow-up on error
      } finally {
        setIsThinking(false);
      }
    }
  }

  async function handleClose() {
    setPhase('closing');

    try {
      // Extract themes and closing reflection in parallel
      const transcript = responses.filter(r => r.role === 'user').map(r => r.content).join('\n\n');
      const [themes, reflection] = await Promise.all([
        extractThemes(transcript).catch(() => []),
        generateClosingReflection(toneMode, responses).catch(() => ''),
      ]);

      setClosingReflection(reflection);

      const wordCount = responses
        .filter(r => r.role === 'user')
        .reduce((sum, r) => sum + r.content.split(/\s+/).length, 0);

      const entry: JournalEntry = {
        id: uuid(),
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        mood,
        moodLabel: getMoodLabel(mood),
        energy,
        prompt,
        responses,
        themes,
        wordCount,
        sessionDuration: Math.round((Date.now() - sessionStart.current) / 1000),
        toneMode,
        closingReflection: reflection,
      };

      await saveEntry(entry);

      // Refresh entries in store
      const allEntries = await getAllEntries();
      useAppStore.getState().setEntries(allEntries);

      // Rebuild context in background
      rebuildContext(toneMode);

      setPhase('done');
    } catch {
      setPhase('done');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (phase === 'checkin') {
    return (
      <div>
        {error && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-[var(--color-mood-low)] text-white px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <MoodCheckin onComplete={handleCheckinComplete} />
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Preparing your prompt...</p>
      </div>
    );
  }

  if (phase === 'done') {
    const wordCount = responses
      .filter(r => r.role === 'user')
      .reduce((sum, r) => sum + r.content.split(/\s+/).length, 0);
    const sessionMinutes = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000));

    return (
      <CompletionScreen
        closingReflection={closingReflection}
        wordCount={wordCount}
        sessionMinutes={sessionMinutes}
        onDone={onClose}
      />
    );
  }

  // Writing / Closing phase
  return (
    <div className="flex flex-col h-screen writing-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-hover)]">
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i <= followUpCount ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)]'
              }`}
            />
          ))}
        </div>
        <button
          onClick={handleClose}
          disabled={phase === 'closing'}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-200 disabled:opacity-50"
        >
          {phase === 'closing' ? 'Saving...' : 'Close Session'}
        </button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {responses.map((r, i) => (
          <div key={i} className={r.role === 'claude' ? 'pr-8' : 'pl-8'}>
            {r.role === 'claude' ? (
              <p className="font-serif text-lg text-[var(--color-text)] leading-relaxed italic">
                {r.content}
              </p>
            ) : (
              <div className="bg-[var(--color-bg-card)] rounded-2xl px-4 py-3">
                <p className="text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{r.content}</p>
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="pr-8">
            <div className="flex gap-1 py-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input / Finish */}
      {phase === 'writing' && (
        <div className="px-4 pb-6 pt-2 border-t border-[var(--color-bg-hover)]">
          {/* Text input */}
          <div className="flex items-end gap-2 bg-[var(--color-bg-input)] rounded-2xl px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={followUpCount >= 2 && !isThinking ? 'Anything else before you finish?' : 'Write what comes to mind...'}
              rows={1}
              className="flex-1 bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] resize-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '24px', height: 'auto' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            {input.trim() && (
              <button
                onClick={handleSend}
                className="p-2 rounded-full text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] transition-colors duration-200"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>

          {/* Finish button — appears after follow-ups are done */}
          {followUpCount >= 2 && !isThinking && (
            <button
              onClick={handleClose}
              className="w-full mt-3 py-3 rounded-2xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors duration-200"
            >
              Finish Entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getMoodLabel(mood: number): string {
  if (mood <= 2) return 'rough';
  if (mood <= 4) return 'low';
  if (mood <= 6) return 'okay';
  if (mood <= 8) return 'good';
  return 'great';
}
