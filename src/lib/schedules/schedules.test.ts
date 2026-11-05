import { describe, expect, it } from 'vitest';
import {
  addMonths,
  adjustForWorkingDay,
  firstOccurrenceFrom,
  describeFrequency,
  isWorkingDay,
  monthlyCost,
  nextOccurrence,
  publicHolidays,
  upcomingOccurrences,
} from './dates';
import { suggestDebtSchedules, suggestSchedules } from './detect';
import { amountFits, matchSchedule, previousOccurrence } from './match';
import type { Schedule } from './types';

function schedule(partial: Partial<Schedule>): Schedule {
  return {
    id: 's1',
    user_id: 'u',
    name: 'Netflix',
    payee: 'NETFLIX.COM',
    account_id: 'acc',
    type: 'expense',
    transfer_account_id: null,
    category_id: null,
    subcategory_id: null,
    amount: 19_900,
    amount_type: 'exact',
    amount_min: null,
    amount_max: null,
    frequency: 'monthly',
    interval: 1,
    start_date: '2026-01-31',
    month_end: false,
    next_date: '2026-01-31',
    end_date: null,
    weekend: 'none',
    auto_add: true,
    is_subscription: false,
    debt_id: null,
    notes: null,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('dates', () => {
  it('adds months without running past the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-02-10', 0, true)).toBe('2026-02-28');
  });

  it('keeps a monthly schedule on the 31st after a short month', () => {
    const s = schedule({});
    const dates = [s.start_date];
    for (let i = 0; i < 4; i++) dates.push(nextOccurrence(s, dates[dates.length - 1])!);
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('handles quarterly, month-end, weekly, daily, yearly and one-off schedules', () => {
    expect(nextOccurrence(schedule({ interval: 3 }), '2026-04-30')).toBe('2026-07-31');
    expect(nextOccurrence(schedule({ start_date: '2026-01-15', month_end: true }), '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(schedule({ frequency: 'weekly', interval: 2 }), '2026-11-06')).toBe('2026-11-20');
    expect(nextOccurrence(schedule({ frequency: 'daily' }), '2026-12-31')).toBe('2027-01-01');
    expect(nextOccurrence(schedule({ frequency: 'yearly', start_date: '2028-02-29' }), '2029-02-28')).toBe('2030-02-28');
    expect(nextOccurrence(schedule({ frequency: 'once' }), '2026-01-31')).toBeNull();
  });

  it('starts a schedule that began in the past at the next occurrence', () => {
    expect(firstOccurrenceFrom(schedule({}), '2026-03-15')).toBe('2026-03-31');
    expect(firstOccurrenceFrom(schedule({}), '2026-03-31')).toBe('2026-03-31');
    expect(firstOccurrenceFrom(schedule({}), '2025-12-01')).toBe('2026-01-31');
    expect(firstOccurrenceFrom(schedule({ frequency: 'once' }), '2026-03-15')).toBeNull();
  });

  it('knows South African public holidays, including Easter and the Sunday rule', () => {
    const h2026 = publicHolidays(2026);
    expect(h2026.has('2026-04-03')).toBe(true); // Good Friday
    expect(h2026.has('2026-04-06')).toBe(true); // Family Day
    expect(h2026.has('2026-08-09')).toBe(true); // Women's Day, a Sunday
    expect(h2026.has('2026-08-10')).toBe(true); // so Monday is a holiday
    const h2027 = publicHolidays(2027);
    expect(h2027.has('2027-03-26')).toBe(true); // Good Friday
    expect(h2027.has('2027-12-27')).toBe(true); // Day of Goodwill falls on a Sunday
    expect(publicHolidays(2025).has('2025-04-18')).toBe(true);
    expect(isWorkingDay('2026-11-05')).toBe(true);
  });

  it('moves dates off weekends and holidays', () => {
    expect(adjustForWorkingDay('2026-11-07', 'after')).toBe('2026-11-09'); // Saturday
    expect(adjustForWorkingDay('2026-11-07', 'before')).toBe('2026-11-06');
    expect(adjustForWorkingDay('2026-12-25', 'after')).toBe('2026-12-28'); // Fri holiday, then weekend
    expect(adjustForWorkingDay('2026-04-03', 'before')).toBe('2026-04-02'); // Good Friday
    expect(adjustForWorkingDay('2026-11-07', 'none')).toBe('2026-11-07');
  });

  it('lists upcoming occurrences up to a date and stops at the end date', () => {
    const s = schedule({ start_date: '2026-11-25', next_date: '2026-11-25', weekend: 'before', end_date: '2027-01-31' });
    expect(upcomingOccurrences(s, '2027-06-30')).toEqual([
      { scheduleDate: '2026-11-25', date: '2026-11-25' },
      { scheduleDate: '2026-12-25', date: '2026-12-24' },
      { scheduleDate: '2027-01-25', date: '2027-01-25' },
    ]);
  });

  it('describes frequencies and monthly cost', () => {
    expect(describeFrequency(schedule({ start_date: '2026-11-01' }))).toBe('Monthly on the 1st');
    expect(describeFrequency(schedule({ month_end: true }))).toBe('Monthly on the last day');
    expect(describeFrequency(schedule({ frequency: 'weekly', interval: 2, start_date: '2026-11-06' }))).toBe('Every second Friday');
    expect(monthlyCost(schedule({ frequency: 'yearly', amount: 120_000 }))).toBe(10_000);
  });
});

describe('matching', () => {
  it('checks amounts by type', () => {
    expect(amountFits(schedule({}), -19_900)).toBe(true);
    expect(amountFits(schedule({}), -19_901)).toBe(false);
    expect(amountFits(schedule({ amount_type: 'approx', amount: 100_000 }), -107_500)).toBe(true);
    expect(amountFits(schedule({ amount_type: 'approx', amount: 100_000 }), -107_600)).toBe(false);
    expect(amountFits(schedule({ amount_type: 'range', amount_min: 50_000, amount_max: 70_000 }), 60_000)).toBe(true);
  });

  it('matches an imported row to the nearest occurrence within two days', () => {
    const s = schedule({ start_date: '2026-10-31', next_date: '2026-11-30', weekend: 'after' });
    expect(matchSchedule({ date: '2026-12-01', amount: -19_900, payee: 'NETFLIX.COM 866-579' }, 'acc', [s])).toEqual({
      scheduleId: 's1',
      scheduleDate: '2026-11-30',
    });
    // A debit order the bank ran late, after the schedule already moved on.
    expect(matchSchedule({ date: '2026-11-01', amount: -19_900, payee: 'netflix.com' }, 'acc', [s])?.scheduleDate).toBe('2026-10-31');
    expect(matchSchedule({ date: '2026-12-05', amount: -19_900, payee: 'NETFLIX.COM' }, 'acc', [s])).toBeNull();
    expect(matchSchedule({ date: '2026-11-30', amount: -19_900, payee: 'SPOTIFY' }, 'acc', [s])).toBeNull();
    expect(matchSchedule({ date: '2026-11-30', amount: 19_900, payee: 'NETFLIX.COM' }, 'acc', [s])).toBeNull();
    expect(matchSchedule({ date: '2026-11-30', amount: -19_900, payee: 'NETFLIX.COM' }, 'other', [s])).toBeNull();
  });

  it('finds the occurrence before next_date', () => {
    expect(previousOccurrence(schedule({ next_date: '2026-03-31' }))).toBe('2026-02-28');
    expect(previousOccurrence(schedule({ next_date: '2026-01-31' }))).toBeNull();
  });
});

describe('finding schedules', () => {
  const tx = (date: string, amount: number, payee = 'VODACOM DEBIT ORDER') => ({
    account_id: 'acc', type: 'expense' as const, amount, date, title: 'Vodacom', imported_payee: payee, category_id: 'airtime',
  });

  it('suggests a monthly debit order with approximate amounts', () => {
    const history = [tx('2026-07-01', 49_900), tx('2026-08-01', 49_900), tx('2026-09-02', 52_000), tx('2026-10-01', 49_900), tx('2026-11-02', 49_900)];
    const [s] = suggestSchedules(history, [], '2026-11-05');
    expect(s.draft).toMatchObject({ frequency: 'monthly', interval: 1, amount_type: 'approx', amount: 49_900, next_date: '2026-12-02', category_id: 'airtime' });
  });

  it('ignores irregular, stale, covered or too-few payments', () => {
    expect(suggestSchedules([tx('2026-09-01', 100), tx('2026-10-01', 100)], [], '2026-10-05')).toEqual([]);
    expect(suggestSchedules([tx('2026-01-01', 100), tx('2026-01-19', 100), tx('2026-03-30', 100), tx('2026-04-02', 100)], [], '2026-04-05')).toEqual([]);
    expect(suggestSchedules([tx('2026-01-01', 100), tx('2026-02-01', 100), tx('2026-03-01', 100)], [], '2026-11-05')).toEqual([]);
    const history = [tx('2026-08-01', 100), tx('2026-09-01', 100), tx('2026-10-01', 100)];
    expect(suggestSchedules(history, [{ payee: 'vodacom debit order', name: 'x', account_id: 'acc', is_active: true }], '2026-10-05')).toEqual([]);
    expect(suggestSchedules(history, [], '2026-10-05')[0].draft.amount_type).toBe('exact');
  });

  it('suggests minimum payments for debts without a schedule', () => {
    const debts = [
      { id: 'car', name: 'Car loan', minimum_payment: 450_000, payment_day: 3, is_active: true },
      { id: 'card', name: 'Card', minimum_payment: 50_000, payment_day: 25, is_active: true },
      { id: 'old', name: 'Old', minimum_payment: 100, payment_day: 1, is_active: false },
    ];
    const result = suggestDebtSchedules(debts, [{ debt_id: 'card', is_active: true }], 'acc', '2026-11-05');
    expect(result).toHaveLength(1);
    expect(result[0].draft).toMatchObject({ debt_id: 'car', amount: 450_000, next_date: '2026-12-03' });
  });
});
