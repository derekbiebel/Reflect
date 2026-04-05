import type { ToneMode, UserContext, EntryResponse, JournalEntry, DeepInsight } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string {
  return localStorage.getItem('reflect-api-key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number, temperature = 0.7): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('API key not configured. Go to Settings to add your Anthropic API key.');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

function buildSystemPrompt(toneMode: ToneMode, context?: UserContext, mood?: number, energy?: number): string {
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  let prompt = `You are a journaling assistant. Tone: ${toneMode}.

Tone definitions:
- companion: warm, curious, gently encouraging. Like a thoughtful friend who asks good questions.
- coach: neutral, focused, direct. Present but not leading.
- minimal: sparse. Just the prompt. No filler.

Today: ${timeOfDay}, ${dayOfWeek}.`;

  if (mood !== undefined && energy !== undefined) {
    prompt += `\nUser's current mood: ${mood}/10, energy: ${energy}/10.`;
  }

  if (context) {
    prompt += `\n\nUser context (recent patterns):
- Average mood: ${context.moodBaseline.toFixed(1)}/10
- Recurring themes: ${context.recentThemes.map(t => t.theme).join(', ') || 'none yet'}
- Open threads: ${context.openThreads.join(', ') || 'none'}
- Total entries: ${context.totalEntries}`;
  }

  prompt += `\n\nRules:
- Never be generic. Use the context provided.
- Never praise the user for journaling. Just engage.
- Ask one question at a time.
- If tone is minimal, one sentence maximum.
- Do not diagnose, advise medically, or push hard on sensitive topics.
- You are a lens, not a therapist. Observe and reflect.`;

  return prompt;
}

export async function generateOpeningPrompt(
  toneMode: ToneMode,
  mood: number,
  energy: number,
  context?: UserContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(toneMode, context, mood, energy);

  // Vary the prompt angle so sessions don't feel repetitive
  const angles = [
    'Ask about something specific happening in their life right now.',
    'Ask about a feeling or sensation they are carrying today.',
    'Ask about something they are looking forward to or dreading.',
    'Ask about a person who has been on their mind.',
    'Ask about something small that happened recently that stuck with them.',
    'Ask about a decision or tension they are sitting with.',
    'Ask what they would tell a friend who felt the way they do right now.',
    'Ask about what felt different about today compared to yesterday.',
    'Ask about something they have been putting off thinking about.',
    'Ask about a moment from the past few days that surprised them.',
    'Ask about what they need but haven\'t given themselves.',
    'Ask about the gap between how they are doing and how they want to be doing.',
  ];
  const angle = angles[Math.floor(Math.random() * angles.length)];

  let userMsg = `Generate a single opening journal prompt. Mood: ${mood}/10, Energy: ${energy}/10.\n\nAngle: ${angle}`;

  if (context && context.recentThemes.length > 0) {
    userMsg += `\nRecent themes: ${context.recentThemes.map(t => t.theme).join(', ')}.`;
  }
  if (context && context.openThreads.length > 0) {
    userMsg += `\nOpen threads: ${context.openThreads.join(', ')}.`;
  }

  userMsg += `\n\nReturn ONLY the prompt question, nothing else. No quotation marks.`;

  return callClaude(systemPrompt, userMsg, 100, 0.9);
}

export async function generateFollowUp(
  toneMode: ToneMode,
  mood: number,
  energy: number,
  responses: EntryResponse[],
  context?: UserContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(toneMode, context, mood, energy);

  const transcript = responses.map(r =>
    `${r.role === 'user' ? 'User' : 'Journal assistant'}: ${r.content}`
  ).join('\n\n');

  const userMsg = `Here's the journal session so far:\n\n${transcript}\n\nGenerate a single follow-up question or observation. Be specific to what they wrote. Return ONLY the response, nothing else. No quotation marks.`;

  return callClaude(systemPrompt, userMsg, 150, 0.8);
}

export async function extractThemes(transcript: string): Promise<string[]> {
  const systemPrompt = 'You extract themes from journal entries. Return 2-4 short theme tags.';
  const userMsg = `Extract 2-4 theme tags from this journal entry. Return them as a comma-separated list, nothing else. Examples: "work stress, relationship, self-doubt, gratitude"\n\nEntry:\n${transcript}`;

  const result = await callClaude(systemPrompt, userMsg, 80, 0.3);
  return result.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

export async function generateClosingReflection(
  toneMode: ToneMode,
  responses: EntryResponse[]
): Promise<string> {
  const transcript = responses.map(r =>
    `${r.role === 'user' ? 'User' : 'Journal assistant'}: ${r.content}`
  ).join('\n\n');

  const systemPrompt = `You are a journaling assistant. Tone: ${toneMode}. Generate a closing reflection — one sentence. Not praise. Not a summary. Something worth sitting with.`;
  const userMsg = `Based on this journal session, write one closing sentence. Return ONLY the sentence, nothing else. No quotation marks.\n\n${transcript}`;

  return callClaude(systemPrompt, userMsg, 60, 0.9);
}

export async function generateDeepInsights(entries: JournalEntry[]): Promise<DeepInsight[]> {
  if (entries.length < 3) return [];

  // Build a rich summary of all entries for Claude to analyze
  const entrySummaries = entries
    .slice(0, 30) // Last 30 entries max
    .map(e => {
      const userText = e.responses.filter(r => r.role === 'user').map(r => r.content).join(' ');
      const date = new Date(e.date + 'T12:00:00');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return `[${e.date} (${dayName}) | mood: ${e.mood}/10 | energy: ${e.energy}/10 | themes: ${e.themes.join(', ')}]\n${userText}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are an insight engine for a personal journal app. Your job is to find patterns the user CAN'T see from inside their own life. You have access to their full journal history.

You are looking for these specific types of insight:

1. **hidden_joy** — Things that correlate with higher mood or energy that the user probably doesn't realize. Maybe they're happier on days they mention a certain person, activity, or place. Maybe their mood lifts when they write about certain topics. Find the quiet good things.

2. **silent_drain** — The opposite. Things that correlate with lower mood or drained energy. The user might not connect these dots. A recurring obligation, a relationship dynamic, a pattern of overcommitting.

3. **unspoken** — Topics the user has mentioned once or twice but never gone deeper on. Things that got dropped or deflected. These are often the most interesting things to explore. What are they circling around but not landing on?

4. **blind_spot** — Patterns the user likely can't see. Maybe they always journal about others' needs but never their own. Maybe they describe situations as "fine" when their mood scores tell a different story. Contradictions between what they say and what the data shows.

5. **shift** — Something that's genuinely changing over time. A theme fading or growing. Mood trending in a direction. Energy patterns shifting. Not just noise — real movement.

6. **observation** — A general qualitative insight that doesn't fit the above but is worth surfacing. Something a wise friend would notice after reading all their entries.

Rules:
- Be SPECIFIC. Reference actual things from their entries. Never be generic.
- Be gentle but honest. You're a lens, not a therapist.
- Don't praise them for journaling.
- Each insight should feel like something only YOU could see — something they'd read and think "huh, I never noticed that."
- Quality over quantity. Only return insights you're genuinely confident about.
- Assign confidence 1-3: 1 = early signal (few data points), 2 = pattern forming, 3 = strong pattern across multiple entries.`;

  const userMsg = `Here are the user's journal entries (most recent first). Analyze them for deep patterns.

${entrySummaries}

Return your insights as a JSON array. Each object must have:
- "type": one of "hidden_joy", "silent_drain", "unspoken", "blind_spot", "shift", "observation"
- "title": 2-5 word label (e.g. "Morning energy spike", "The work thing")
- "content": 1-3 sentences. Specific, observational, insightful.
- "confidence": 1, 2, or 3

Return 3-6 insights. Return ONLY the JSON array, no other text.`;

  try {
    const result = await callClaude(systemPrompt, userMsg, 800);

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: Record<string, unknown>, i: number) => ({
      id: `insight-${Date.now()}-${i}`,
      type: item.type as DeepInsight['type'],
      title: String(item.title || ''),
      content: String(item.content || ''),
      confidence: Number(item.confidence) || 1,
      generatedAt: Date.now(),
      basedOnEntries: entries.length,
    }));
  } catch {
    return [];
  }
}

export async function generateWeeklyInsight(entries: JournalEntry[], toneMode: ToneMode): Promise<string> {
  if (entries.length < 3) return '';

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekEntries = entries.filter(e => new Date(e.date) >= sevenDaysAgo);

  if (weekEntries.length === 0) return '';

  const summaries = weekEntries.map(e => {
    const userText = e.responses.filter(r => r.role === 'user').map(r => r.content).join(' ');
    return `[${e.date} | mood: ${e.mood}/10 | energy: ${e.energy}/10 | themes: ${e.themes.join(', ')}]\n${userText}`;
  }).join('\n\n---\n\n');

  const avgMood = (weekEntries.reduce((s, e) => s + e.mood, 0) / weekEntries.length).toFixed(1);
  const avgEnergy = (weekEntries.reduce((s, e) => s + e.energy, 0) / weekEntries.length).toFixed(1);

  const systemPrompt = `You write weekly journal summaries. Tone: ${toneMode}. You are observational, never prescriptive. You notice what a person might not see about their own week. Be specific — reference actual themes and patterns from their entries, not generic advice.`;

  const userMsg = `Here are this week's journal entries (${weekEntries.length} total). Average mood: ${avgMood}/10. Average energy: ${avgEnergy}/10.

${summaries}

Write a short weekly reflection (2-4 sentences). Observe patterns, note what changed, surface what's interesting. Be specific to what they actually wrote. Never praise them for journaling. Return ONLY the paragraph, nothing else.`;

  return callClaude(systemPrompt, userMsg, 300, 0.8);
}

export async function generatePatternNudges(entries: JournalEntry[]): Promise<string[]> {
  if (entries.length < 5) return [];

  // Build statistical context for Claude
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const last14 = sorted.slice(-14);

  // Mood by day of week
  const dayMoods: Record<string, number[]> = {};
  for (const e of last14) {
    const day = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayMoods[day]) dayMoods[day] = [];
    dayMoods[day].push(e.mood);
  }
  const dayAvgs = Object.entries(dayMoods).map(([day, moods]) => ({
    day,
    avg: (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1),
    count: moods.length,
  }));

  // Energy vs mood divergence
  const divergences = last14.filter(e => Math.abs(e.mood - e.energy) >= 4);

  // Theme frequency shifts
  const half = Math.floor(last14.length / 2);
  const firstHalf = last14.slice(0, half);
  const secondHalf = last14.slice(half);
  const countThemes = (arr: JournalEntry[]) => {
    const c: Record<string, number> = {};
    for (const e of arr) for (const t of e.themes) c[t] = (c[t] || 0) + 1;
    return c;
  };
  const firstThemes = countThemes(firstHalf);
  const secondThemes = countThemes(secondHalf);

  const systemPrompt = `You detect patterns in journal data. Return short, specific observations — one sentence each. Never generic. Never prescriptive. Just note what the data shows.`;

  const userMsg = `Analyze these journal patterns and return 2-4 short pattern observations as a JSON array of strings.

Mood by day of week: ${JSON.stringify(dayAvgs)}
Entries with large mood/energy divergence (4+ gap): ${divergences.length} of ${last14.length}${divergences.length > 0 ? '. Examples: ' + divergences.slice(0, 3).map(e => `${e.date}: mood ${e.mood}, energy ${e.energy}`).join('; ') : ''}
Theme frequency first half vs second half:
  First: ${JSON.stringify(firstThemes)}
  Second: ${JSON.stringify(secondThemes)}
Total entries analyzed: ${last14.length}

Only return observations where there's a real signal, not noise. Return a JSON array of strings. Return ONLY the JSON array.`;

  try {
    const result = await callClaude(systemPrompt, userMsg, 300, 0.5);
    const jsonStr = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s: unknown) => typeof s === 'string').slice(0, 4);
  } catch {
    return [];
  }
}
