import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/lib/db/schema';
import {
  EMPTY_FILTER,
  activeFilterCount,
  amountInCategory,
  categoryLines,
  clearedBalance,
  matchesFilter,
  mergeTags,
  runningBalances,
  splitProblem,
  tagsInText,
} from './ledger';

let n = 0;
function tx(partial: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: `t${n}`, user_id: 'u', account_id: 'acc', type: 'expense', amount: 1000, category_id: 'food', title: 'Shop',
    date: '2026-11-01', is_recurring: false, is_subscription: false, is_debt_payment: false, is_paid: true,
    exclude_from_budget: false, created_at: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`, updated_at: '', is_deleted: false,
    ...partial,
  } as Transaction;
}

const split = tx({ amount: 30_000, category_id: '', splits: [{ category_id: 'food', amount: 20_000 }, { category_id: 'home', amount: 10_000 }] });

describe('splits', () => {
  it('gives one line per part, or the transaction itself', () => {
    expect(categoryLines(split).map((l) => [l.category_id, l.amount])).toEqual([['food', 20_000], ['home', 10_000]]);
    expect(categoryLines(tx({ amount: 500 }))).toEqual([{ category_id: 'food', subcategory_id: null, amount: 500 }]);
    expect(amountInCategory(split, 'home')).toBe(10_000);
    expect(amountInCategory(split, 'fuel')).toBe(0);
  });

  it('explains what is wrong with a split', () => {
    expect(splitProblem(30_000, [{ category_id: 'food', amount: 30_000 }])).toMatch(/two parts/);
    expect(splitProblem(30_000, [{ category_id: 'food', amount: 20_000 }, { category_id: '', amount: 10_000 }])).toMatch(/category/);
    expect(splitProblem(30_000, [{ category_id: 'food', amount: 20_000 }, { category_id: 'home', amount: 5_000 }])).toBe('R50.00 still to assign to a part.');
    expect(splitProblem(30_000, [{ category_id: 'food', amount: 20_000 }, { category_id: 'home', amount: 15_000 }])).toBe('The parts are R50.00 more than the total.');
    expect(splitProblem(30_000, [{ category_id: 'food', amount: 20_000 }, { category_id: 'home', amount: 10_000 }])).toBeNull();
  });
});

describe('tags', () => {
  it('reads #tags from notes and merges without duplicates', () => {
    expect(tagsInText('Lunch with #Work team, #school-fees and an email@ad#dress')).toEqual(['work', 'school-fees']);
    expect(mergeTags(['Work'], ['work', 'holiday trip'], null)).toEqual(['work', 'holiday-trip']);
  });
});

describe('balances', () => {
  const account = { id: 'acc', initial_balance: 100_000 };
  const list = [
    tx({ id: 'b', date: '2026-11-02', amount: 5_000, cleared: true }),
    tx({ id: 'a', date: '2026-11-01', type: 'income', amount: 20_000 }),
    tx({ id: 'c', date: '2026-11-02', type: 'transfer', amount: 7_000, account_id: 'other', transfer_account_id: 'acc', cleared: true }),
    tx({ id: 'd', date: '2026-11-03', amount: 9_999, is_deleted: true, cleared: true }),
    tx({ id: 'e', date: '2026-11-03', amount: 1, account_id: 'elsewhere' }),
  ];

  it('runs the balance forward oldest first, skipping deleted and other accounts', () => {
    expect(Object.fromEntries(runningBalances(account, list))).toEqual({ a: 120_000, b: 115_000, c: 122_000 });
  });

  it('counts only cleared transactions in the cleared balance', () => {
    expect(clearedBalance(account, list)).toBe(100_000 - 5_000 + 7_000);
  });
});

describe('filters', () => {
  const names = { category: (id: string) => ({ food: 'Groceries', home: 'Home' })[id], account: () => 'Cheque' };
  const f = (patch: Partial<typeof EMPTY_FILTER>) => ({ ...EMPTY_FILTER, ...patch });

  it('matches split parts by category and search', () => {
    expect(matchesFilter(split, f({ categoryId: 'home' }), names)).toBe(true);
    expect(matchesFilter(split, f({ search: 'home' }), names)).toBe(true);
    expect(matchesFilter(split, f({ search: 'fuel' }), names)).toBe(false);
  });

  it('filters by amount range, cleared state and uncategorised', () => {
    expect(matchesFilter(tx({ amount: 5_000 }), f({ amountMin: '40', amountMax: '50' }), names)).toBe(true);
    expect(matchesFilter(tx({ amount: 5_001 }), f({ amountMax: '50' }), names)).toBe(false);
    expect(matchesFilter(tx({ cleared: true }), f({ cleared: 'uncleared' }), names)).toBe(false);
    expect(matchesFilter(tx({ category_id: '' }), f({ uncategorised: true }), names)).toBe(true);
    expect(matchesFilter(split, f({ uncategorised: true }), names)).toBe(false);
  });

  it('filters by any or all tags', () => {
    const tagged = tx({ tags: ['work', 'travel'] });
    expect(matchesFilter(tagged, f({ tagsAny: ['holiday', 'Work'] }), names)).toBe(true);
    expect(matchesFilter(tagged, f({ tagsAll: ['work', 'holiday'] }), names)).toBe(false);
    expect(matchesFilter(tagged, f({ search: '#travel' }), names)).toBe(true);
  });

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(activeFilterCount(f({ tagsAny: ['x'], cleared: 'cleared' }))).toBe(2);
  });
});
