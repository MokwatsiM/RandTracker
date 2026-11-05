import { normaliseText } from '@/lib/rules/engine';
import { adjustForWorkingDay, nextOccurrence } from './dates';
import type { Schedule } from './types';

/** Approximate amounts match within 7.5% either way, as in Actual. */
export const APPROX_TOLERANCE = 0.075;

export function amountFits(schedule: Pick<Schedule, 'amount' | 'amount_type' | 'amount_min' | 'amount_max'>, cents: number): boolean {
  const amount = Math.abs(cents);
  switch (schedule.amount_type) {
    case 'exact':
      return amount === schedule.amount;
    case 'approx':
      return Math.abs(amount - schedule.amount) <= schedule.amount * APPROX_TOLERANCE;
    case 'range':
      return amount >= (schedule.amount_min ?? 0) && amount <= (schedule.amount_max ?? Number.MAX_SAFE_INTEGER);
  }
}

function payeeFits(schedule: Pick<Schedule, 'payee' | 'name'>, description: string): boolean {
  const wanted = normaliseText(schedule.payee || schedule.name);
  const text = normaliseText(description);
  return wanted.trim() !== '' && (text.includes(wanted.trim()) || wanted.includes(text.trim()));
}

export interface ScheduleMatch {
  scheduleId: string;
  /** The occurrence's unadjusted date, which links the transaction to it. */
  scheduleDate: string;
}

interface Candidate {
  date: string;
  /** Cents, positive in, negative out. */
  amount: number;
  payee: string;
}

/**
 * Finds the schedule occurrence a transaction is, if any: same account and direction, an
 * amount that fits, a matching description, and within 2 days of the occurrence's actual
 * date. Checks the current occurrence and the one before it, since a bank may run a debit
 * order a day late after the app has already moved on.
 */
export function matchSchedule(row: Candidate, accountId: string, schedules: Schedule[], maxDays = 2): ScheduleMatch | null {
  const direction = row.amount >= 0 ? 'income' : 'expense';
  let best: (ScheduleMatch & { distance: number }) | null = null;

  for (const s of schedules) {
    if (!s.is_active || s.account_id !== accountId || !s.next_date) continue;
    if (s.type !== direction && !(s.type === 'transfer' && direction === 'expense')) continue;
    if (!amountFits(s, row.amount) || !payeeFits(s, row.payee)) continue;

    const previous = previousOccurrence(s);
    for (const scheduleDate of [s.next_date, previous].filter((d): d is string => !!d)) {
      const actual = adjustForWorkingDay(scheduleDate, s.weekend);
      const distance = Math.abs((Date.parse(row.date) - Date.parse(actual)) / 86_400_000);
      if (distance <= maxDays && (!best || distance < best.distance)) {
        best = { scheduleId: s.id, scheduleDate, distance };
      }
    }
  }

  return best ? { scheduleId: best.scheduleId, scheduleDate: best.scheduleDate } : null;
}

/** The occurrence before next_date, found by stepping from the start date. */
export function previousOccurrence(schedule: Schedule): string | null {
  if (!schedule.next_date || schedule.next_date <= schedule.start_date) return null;
  let current = schedule.start_date;
  let previous: string | null = null;
  // Bounded so a malformed schedule can't loop forever.
  for (let i = 0; i < 2000 && current < schedule.next_date; i++) {
    previous = current;
    const next = nextOccurrence(schedule, current);
    if (!next) break;
    current = next;
  }
  return previous;
}
