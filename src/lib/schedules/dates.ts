import type { Schedule, ScheduleFrequency, WeekendRule } from './types';

// All dates are yyyy-MM-dd strings handled in UTC, so time zones never shift a day.
// The same rules are in migration 015, which posts schedules on the server.

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Adds months, keeping the day where it can: 31 Jan plus one month is 28 (or 29) Feb. */
export function addMonths(iso: string, months: number, monthEnd = false): string {
  const d = toDate(iso);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = monthEnd ? daysInMonth(year, month) : Math.min(d.getUTCDate(), daysInMonth(year, month));
  return toIso(new Date(Date.UTC(year, month, day)));
}

function monthsBetween(from: string, to: string): number {
  const a = toDate(from);
  const b = toDate(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
}

/**
 * The occurrence after `current`. Monthly and yearly occurrences are counted from the start
 * date rather than the previous one, so a schedule on the 31st returns to the 31st after
 * February instead of drifting to the 28th. Null for a one-off schedule.
 */
export function nextOccurrence(
  schedule: Pick<Schedule, 'frequency' | 'interval' | 'start_date' | 'month_end'>,
  current: string
): string | null {
  const step = Math.max(1, schedule.interval || 1);
  switch (schedule.frequency as ScheduleFrequency) {
    case 'once':
      return null;
    case 'daily':
      return addDays(current, step);
    case 'weekly':
      return addDays(current, 7 * step);
    case 'monthly': {
      const since = monthsBetween(schedule.start_date, current);
      const k = Math.floor(since / step) + 1;
      return addMonths(schedule.start_date, k * step, schedule.month_end);
    }
    case 'yearly': {
      const since = Math.floor(monthsBetween(schedule.start_date, current) / 12);
      const k = Math.floor(since / step) + 1;
      return addMonths(schedule.start_date, k * step * 12);
    }
  }
}

// Easter Sunday by the anonymous Gregorian algorithm.
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(new Date(Date.UTC(year, month - 1, day)));
}

const holidayCache = new Map<number, Set<string>>();

/**
 * South Africa's public holidays under the Public Holidays Act, including the Monday after
 * one that falls on a Sunday. One-off holidays (such as election days) aren't included.
 */
export function publicHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const fixed = ['01-01', '03-21', '04-27', '05-01', '06-16', '08-09', '09-24', '12-16', '12-25', '12-26'].map(
    (md) => `${year}-${md}`
  );
  const e = easter(year);
  const days = new Set<string>([...fixed, addDays(e, -2), addDays(e, 1)]);
  for (const day of fixed) {
    if (toDate(day).getUTCDay() === 0) {
      let monday = addDays(day, 1);
      while (days.has(monday)) monday = addDays(monday, 1);
      days.add(monday);
    }
  }
  holidayCache.set(year, days);
  return days;
}

export function isWorkingDay(iso: string): boolean {
  const day = toDate(iso).getUTCDay();
  return day !== 0 && day !== 6 && !publicHolidays(Number(iso.slice(0, 4))).has(iso);
}

/** Moves a date off weekends and public holidays, as banks do with debit orders. */
export function adjustForWorkingDay(iso: string, rule: WeekendRule): string {
  if (rule === 'none') return iso;
  let date = iso;
  const step = rule === 'before' ? -1 : 1;
  while (!isWorkingDay(date)) date = addDays(date, step);
  return date;
}

/**
 * The first occurrence on or after `date`, counted from the start date. A new schedule that
 * started in the past begins here, so it doesn't add months of old transactions at once.
 */
export function firstOccurrenceFrom(
  schedule: Pick<Schedule, 'frequency' | 'interval' | 'start_date' | 'month_end'>,
  date: string
): string | null {
  let current: string | null = schedule.start_date;
  for (let i = 0; i < 5000 && current && current < date; i++) {
    current = nextOccurrence(schedule, current);
  }
  return current;
}

export interface Occurrence {
  /** The scheduled date before any weekend adjustment; identifies the occurrence. */
  scheduleDate: string;
  /** The date it actually happens. */
  date: string;
}

/** Occurrences from next_date onwards whose actual date is on or before `until`. */
export function upcomingOccurrences(schedule: Schedule, until: string, limit = 60): Occurrence[] {
  const result: Occurrence[] = [];
  let current = schedule.next_date;
  while (current && result.length < limit) {
    if (schedule.end_date && current > schedule.end_date) break;
    const date = adjustForWorkingDay(current, schedule.weekend);
    if (date > until) break;
    result.push({ scheduleDate: current, date });
    current = nextOccurrence(schedule, current);
  }
  return result;
}

export function describeFrequency(schedule: Pick<Schedule, 'frequency' | 'interval' | 'month_end' | 'start_date'>): string {
  const n = Math.max(1, schedule.interval || 1);
  const day = Number(schedule.start_date.slice(8, 10));
  const ordinal = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;
  switch (schedule.frequency) {
    case 'once':
      return 'Once';
    case 'daily':
      return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'weekly': {
      const weekday = toDate(schedule.start_date).toLocaleDateString('en-ZA', { weekday: 'long', timeZone: 'UTC' });
      return n === 1 ? `Every ${weekday}` : n === 2 ? `Every second ${weekday}` : `Every ${n} weeks on ${weekday}`;
    }
    case 'monthly': {
      const on = schedule.month_end ? 'the last day' : `the ${ordinal(day)}`;
      return n === 1 ? `Monthly on ${on}` : n === 3 ? `Quarterly on ${on}` : `Every ${n} months on ${on}`;
    }
    case 'yearly':
      return n === 1 ? 'Yearly' : `Every ${n} years`;
  }
}

/** Monthly cost in cents, for comparing subscriptions with different frequencies. */
export function monthlyCost(schedule: Pick<Schedule, 'frequency' | 'interval' | 'amount'>): number {
  const n = Math.max(1, schedule.interval || 1);
  const perYear = { once: 0, daily: 365 / n, weekly: 52 / n, monthly: 12 / n, yearly: 1 / n }[schedule.frequency];
  return Math.round((schedule.amount * perYear) / 12);
}
