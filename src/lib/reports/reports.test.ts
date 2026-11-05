import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/lib/db/schema';
import type { Schedule } from '@/lib/schedules/types';
import { calendarMonth, moneyFlow, monthsUntil } from './reports';

const tx = (p: Partial<Transaction>) =>
  ({ id: Math.random().toString(), account_id: 'a', type: 'expense', amount: 0, category_id: 'food', date: '2026-11-02', is_deleted: false, ...p }) as Transaction;

const schedule = {
  id: 's', user_id: 'u', name: 'Rent', payee: null, account_id: 'a', type: 'expense', transfer_account_id: null, category_id: null,
  subcategory_id: null, amount: 800_000, amount_type: 'exact', amount_min: null, amount_max: null, frequency: 'monthly', interval: 1,
  start_date: '2026-10-01', month_end: false, next_date: '2026-11-01', end_date: null, weekend: 'after', auto_add: false,
  is_subscription: false, debt_id: null, notes: null, is_active: true, created_at: '', updated_at: '',
} satisfies Schedule;

describe('calendar', () => {
  it('adds up each day and shows schedules still to come', () => {
    const days = calendarMonth('2026-11-15', [tx({ amount: 5_000 }), tx({ amount: 2_000 }), tx({ type: 'income', amount: 9_000 }), tx({ amount: 1, is_deleted: true })], [schedule], '2026-11-01');
    expect(days).toHaveLength(30);
    expect(days[1]).toMatchObject({ date: '2026-11-02', spent: 7_000, income: 9_000 });
    // 1 Nov 2026 is a Sunday, so rent moves to Monday the 2nd.
    expect(days[1].scheduled).toEqual([{ name: 'Rent', amount: 800_000, type: 'expense' }]);
    expect(calendarMonth('2026-11-15', [], [schedule], '2026-11-05')[1].scheduled).toEqual([]);
  });
});

describe('money flow', () => {
  const names = (id: string) => ({ food: 'Food', home: 'Home', salary: 'Salary' })[id] ?? id;

  it('shows income going to categories and the rest saved', () => {
    const list = [
      tx({ type: 'income', amount: 100_000, category_id: 'salary' }),
      tx({ amount: 30_000, category_id: '', splits: [{ category_id: 'food', amount: 20_000 }, { category_id: 'home', amount: 10_000 }] }),
      tx({ amount: 15_000, category_id: 'food' }),
      tx({ type: 'transfer', amount: 50_000 }),
      tx({ amount: 99_000, date: '2026-12-01' }),
    ];
    expect(moneyFlow(list, '2026-11-01', '2026-11-30', names)).toEqual([
      { from: 'Salary', to: 'Income', amount: 100_000 },
      { from: 'Income', to: 'Food', amount: 35_000 },
      { from: 'Income', to: 'Home', amount: 10_000 },
      { from: 'Income', to: 'Saved', amount: 55_000 },
    ]);
  });

  it('shows spending beyond income as coming from savings', () => {
    const links = moneyFlow([tx({ type: 'income', amount: 10_000, category_id: 'salary' }), tx({ amount: 15_000 })], '2026-11-01', '2026-11-30', names);
    expect(links).toContainEqual({ from: 'From savings', to: 'Income', amount: 5_000 });
    expect(links.some((l) => l.to === 'Saved')).toBe(false);
  });

  it('counts whole months between dates', () => {
    expect(monthsUntil(new Date(2026, 10, 6), new Date(2028, 1, 1))).toBe(15);
  });
});
