import CalendarHeatmap from 'react-calendar-heatmap';
import type { JournalEntry } from '../lib/types';
import 'react-calendar-heatmap/dist/styles.css';

interface HeatmapCalendarProps {
  entries: JournalEntry[];
}

export default function HeatmapCalendar({ entries }: HeatmapCalendarProps) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 1);

  // Build a map of date -> mood
  const dateMap: Record<string, number> = {};
  for (const e of entries) {
    dateMap[e.date] = e.mood;
  }

  const values = [];
  const d = new Date(startDate);
  while (d <= today) {
    const dateStr = d.toISOString().split('T')[0];
    values.push({
      date: dateStr,
      count: dateMap[dateStr] || 0,
    });
    d.setDate(d.getDate() + 1);
  }

  function classForValue(value: { date: string; count: number } | null) {
    if (!value || value.count === 0) return 'heatmap-empty';
    if (value.count <= 3) return 'heatmap-low';
    if (value.count <= 5) return 'heatmap-mid-low';
    if (value.count <= 7) return 'heatmap-mid';
    if (value.count <= 9) return 'heatmap-high';
    return 'heatmap-max';
  }

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl px-4 py-4 overflow-x-auto">
      <CalendarHeatmap
        startDate={startDate}
        endDate={today}
        values={values}
        classForValue={classForValue}
        showWeekdayLabels
        gutterSize={3}
        titleForValue={(value) => {
          if (!value || value.count === 0) return 'No entry';
          return `${value.date}: mood ${value.count}/10`;
        }}
      />
    </div>
  );
}
