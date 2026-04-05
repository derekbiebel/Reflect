import CalendarHeatmap from 'react-calendar-heatmap';
import type { JournalEntry } from '../lib/types';
import 'react-calendar-heatmap/dist/styles.css';

interface HeatmapCalendarProps {
  entries: JournalEntry[];
}

interface HeatmapValue {
  date: string;
  count: number;
}

export default function HeatmapCalendar({ entries }: HeatmapCalendarProps) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 1);

  const dateMap: Record<string, number> = {};
  for (const e of entries) {
    dateMap[e.date] = e.mood;
  }

  const values: HeatmapValue[] = [];
  const d = new Date(startDate);
  while (d <= today) {
    const dateStr = d.toISOString().split('T')[0];
    values.push({
      date: dateStr,
      count: dateMap[dateStr] || 0,
    });
    d.setDate(d.getDate() + 1);
  }

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl px-4 py-4 overflow-x-auto">
      <CalendarHeatmap
        startDate={startDate}
        endDate={today}
        values={values}
        classForValue={(value: unknown) => {
          const v = value as HeatmapValue | undefined;
          if (!v || v.count === 0) return 'heatmap-empty';
          if (v.count <= 3) return 'heatmap-low';
          if (v.count <= 5) return 'heatmap-mid-low';
          if (v.count <= 7) return 'heatmap-mid';
          if (v.count <= 9) return 'heatmap-high';
          return 'heatmap-max';
        }}
        showWeekdayLabels
        gutterSize={3}
        titleForValue={(value: unknown) => {
          const v = value as HeatmapValue | undefined;
          if (!v || v.count === 0) return 'No entry';
          return `${v.date}: mood ${v.count}/10`;
        }}
      />
    </div>
  );
}
