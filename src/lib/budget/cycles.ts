import { addDays, adjustForWorkingDay, toDate, toIso } from '@/lib/schedules/dates';

// A budget month runs from one payday to the day before the next. When payday falls on a
// weekend or public holiday, employers pay on the working day before, so the cycle starts
// then. The same rules are in migration 017 (payday_cycle_start).

function paydayIn(year: number, month: number, payday: number): string {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return adjustForWorkingDay(toIso(new Date(Date.UTC(year, month, Math.min(payday, last)))), 'before');
}

function candidates(payday: number, around: string): string[] {
  const d = toDate(around);
  return [-1, 0, 1, 2].map((offset) => paydayIn(d.getUTCFullYear(), d.getUTCMonth() + offset, payday));
}

/** The start of the budget cycle that `date` falls in. */
export function cycleStart(payday: number, date: string): string {
  return candidates(payday, date)
    .filter((c) => c <= date)
    .sort()
    .at(-1)!;
}

export function nextCycleStart(payday: number, start: string): string {
  return candidates(payday, start)
    .filter((c) => c > start)
    .sort()[0];
}

export function previousCycleStart(payday: number, start: string): string {
  return cycleStart(payday, addDays(start, -1));
}

export function cycleEnd(payday: number, start: string): string {
  return addDays(nextCycleStart(payday, start), -1);
}

export function cycleLabel(payday: number, start: string): string {
  const fmt = (iso: string) => toDate(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(cycleEnd(payday, start))}`;
}

/** How many cycles from `start` up to and including the one containing `date` (at least 1). */
export function cyclesUntil(payday: number, start: string, date: string): number {
  let count = 1;
  let current = start;
  while (count < 600) {
    const next = nextCycleStart(payday, current);
    if (next > date) break;
    current = next;
    count += 1;
  }
  return count;
}
