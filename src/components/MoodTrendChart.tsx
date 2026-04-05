import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { JournalEntry } from '../lib/types';

interface MoodTrendChartProps {
  entries: JournalEntry[];
}

export default function MoodTrendChart({ entries }: MoodTrendChartProps) {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = sorted.filter(e => new Date(e.date) >= thirtyDaysAgo);

  if (recent.length < 2) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-2xl px-5 py-6 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Two or more entries needed to show mood trends.
        </p>
      </div>
    );
  }

  const data = recent.map(e => {
    const d = new Date(e.date + 'T12:00:00');
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      mood: e.mood,
      energy: e.energy,
    };
  });

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl px-3 pt-4 pb-2">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7f8a' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[1, 10]}
            ticks={[1, 5, 10]}
            tick={{ fontSize: 11, fill: '#6b7f8a' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fbfcfd',
              border: '1px solid #dce3e8',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#0b161b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="#c69775"
            strokeWidth={2}
            dot={{ r: 3, fill: '#c69775', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#c69775', strokeWidth: 0 }}
            name="Mood"
          />
          <Line
            type="monotone"
            dataKey="energy"
            stroke="#87aec0"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4, fill: '#87aec0', strokeWidth: 0 }}
            name="Energy"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 pb-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[var(--color-accent)] rounded-full inline-block" />
          Mood
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-[var(--color-energy)] inline-block" />
          Energy
        </div>
      </div>
    </div>
  );
}
