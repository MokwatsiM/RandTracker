'use client';

import { formatZAR } from '@/lib/currency';
import type { CalendarDay } from '@/lib/reports/reports';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A month grid: what was spent each day, and scheduled payments still to come. */
export function CalendarView({ days, today }: { days: CalendarDay[]; today: string }) {
  if (days.length === 0) return null;
  const firstWeekday = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const maxSpent = Math.max(1, ...days.map((d) => d.spent));
  return (
    <div className="grid grid-cols-7 gap-1 text-xs">
      {WEEKDAYS.map((d) => <div key={d} className="py-1 text-center font-medium text-muted-foreground">{d}</div>)}
      {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad${i}`} />)}
      {days.map((d) => (
        <div
          key={d.date}
          className={`min-h-[4.5rem] rounded-md border p-1 ${d.date === today ? 'border-primary' : ''}`}
          style={{ backgroundColor: d.spent ? `rgba(239, 68, 68, ${0.06 + 0.3 * (d.spent / maxSpent)})` : undefined }}
        >
          <p className="font-medium">{Number(d.date.slice(8))}</p>
          {d.spent > 0 && <p className="text-red-700 dark:text-red-300">-{formatZAR(d.spent)}</p>}
          {d.income > 0 && <p className="text-green-700 dark:text-green-400">+{formatZAR(d.income)}</p>}
          {d.scheduled.map((s, i) => (
            <p key={i} className="truncate text-blue-700 dark:text-blue-300" title={`${s.name} ${formatZAR(s.amount)}`}>
              ⏱ {s.name}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
