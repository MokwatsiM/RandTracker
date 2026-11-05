import { describe, expect, it } from 'vitest';
import { cycleEnd, cycleLabel, cycleStart, cyclesUntil, nextCycleStart, previousCycleStart } from './cycles';
import { averageSpending, fillBudget, perCycle, scheduledSpending, templateAmount, type Automation, type FillContext } from './automations';
import type { Schedule } from '@/lib/schedules/types';

describe('payday cycles', () => {
  it('runs from payday to the day before the next', () => {
    // 25 Oct 2026 is a Sunday, so October's pay arrives on Friday the 23rd.
    expect(cycleStart(25, '2026-11-05')).toBe('2026-10-23');
    expect(cycleEnd(25, '2026-10-23')).toBe('2026-11-24');
    expect(nextCycleStart(25, '2026-10-23')).toBe('2026-11-25');
    expect(cycleStart(25, '2026-11-25')).toBe('2026-11-25');
    expect(cycleStart(25, '2026-11-24')).toBe('2026-10-23');
    expect(previousCycleStart(25, '2026-11-25')).toBe('2026-10-23');
  });

  it('moves payday off public holidays and handles short months', () => {
    // 25 Dec is Christmas and the 24th a Thursday.
    expect(cycleStart(25, '2026-12-28')).toBe('2026-12-24');
    // Payday on the 31st is the last day in shorter months: 28 Feb 2027 is a Sunday.
    expect(cycleStart(31, '2027-03-01')).toBe('2027-02-26');
    expect(nextCycleStart(31, '2027-02-26')).toBe('2027-03-31');
  });

  it('works for payday on the 1st, which may start in the month before', () => {
    // 1 Nov 2026 is a Sunday, so the cycle starts on Friday 30 Oct.
    expect(cycleStart(1, '2026-10-31')).toBe('2026-10-30');
    expect(cycleStart(1, '2026-11-15')).toBe('2026-10-30');
    expect(cycleEnd(1, '2026-10-30')).toBe('2026-11-30');
  });

  it('counts cycles and labels them', () => {
    expect(cyclesUntil(25, '2026-11-25', '2026-12-01')).toBe(1);
    expect(cyclesUntil(25, '2026-11-25', '2027-03-30')).toBe(5);
    expect(cycleLabel(25, '2026-11-25')).toBe('25 Nov 2026 – 23 Dec 2026');
  });
});

describe('budget automations', () => {
  const ctx = (patch: Partial<FillContext> = {}): FillContext => ({
    payday: 25,
    cycleStart: '2026-11-25',
    toBudget: 1_000_000,
    income: 2_000_000,
    assigned: new Map(),
    carried: new Map(),
    average: () => new Map([['food', 450_000]]),
    scheduled: new Map([['phone', 49_900]]),
    goals: [{ id: 'car', target_amount: 5_000_000, current_amount: 1_000_000, target_date: '2027-03-30' }],
    ...patch,
  });
  const auto = (category_id: string, template: Automation['template'], amount = 0, period: Automation['period'] = 'monthly'): Automation => ({ category_id, template, amount, period });

  it('works out each kind of template', () => {
    expect(perCycle(100_00, 'weekly')).toBe(43_333);
    expect(perCycle(1_200_00, 'yearly')).toBe(10_000);
    expect(templateAmount(auto('rent', { kind: 'fixed' }, 800_000), ctx())).toBe(800_000);
    expect(templateAmount(auto('food', { kind: 'average', cycles: 3 }), ctx())).toBe(450_000);
    expect(templateAmount(auto('phone', { kind: 'schedules' }), ctx())).toBe(49_900);
    expect(templateAmount(auto('save', { kind: 'percent', percent: 10 }), ctx())).toBe(200_000);
    // R40 000 left over 5 cycles.
    expect(templateAmount(auto('car', { kind: 'goal', goal_id: 'car' }), ctx())).toBe(800_000);
    expect(templateAmount(auto('car', { kind: 'goal', goal_id: 'missing' }), ctx())).toBeNull();
    expect(templateAmount(auto('gifts', { kind: 'manual' }, 50_000), ctx())).toBeNull();
  });

  it('fills in priority order without going over the money to budget', () => {
    const automations = [
      auto('fun', { kind: 'fixed', priority: 3 }, 300_000),
      auto('rent', { kind: 'fixed', priority: 1 }, 800_000),
      auto('food', { kind: 'average', priority: 2 }),
    ];
    const { allocations, shortfall } = fillBudget(automations, ctx(), 'empty');
    // Fun gets nothing, which is no change from nothing, so it isn't listed.
    expect(Object.fromEntries(allocations)).toEqual({ rent: 800_000, food: 200_000 });
    expect(shortfall).toBe(250_000 + 300_000);
  });

  it('leaves categories that already have an amount, unless overwriting', () => {
    const automations = [auto('rent', { kind: 'fixed' }, 800_000), auto('food', { kind: 'average' })];
    const assigned = new Map([['rent', 750_000]]);
    expect(Object.fromEntries(fillBudget(automations, ctx({ assigned, toBudget: 500_000 }), 'empty').allocations)).toEqual({ food: 450_000 });
    // Overwriting hands back the R7 500 first, so R12 500 is available.
    expect(Object.fromEntries(fillBudget(automations, ctx({ assigned, toBudget: 500_000 }), 'overwrite').allocations)).toEqual({ rent: 800_000, food: 450_000 });
  });

  it('caps a category with "up to"', () => {
    const automations = [auto('clothes', { kind: 'fixed', up_to: 300_000 }, 200_000)];
    const result = fillBudget(automations, ctx({ carried: new Map([['clothes', 250_000]]) }), 'empty');
    expect(result.allocations.get('clothes')).toBe(50_000);
  });
});

describe('history for automations', () => {
  it('averages spending over full past cycles only', () => {
    const tx = [
      { category_id: 'food', type: 'expense' as const, amount: 300_000, date: '2026-09-30' },
      { category_id: 'food', type: 'expense' as const, amount: 600_000, date: '2026-11-01' },
      { category_id: 'food', type: 'expense' as const, amount: 999_999, date: '2026-11-25' }, // this cycle
      { category_id: 'food', type: 'expense' as const, amount: 999_999, date: '2026-08-01' }, // too old
      { category_id: 'food', type: 'income' as const, amount: 999_999, date: '2026-11-01' },
      { category_id: 'food', type: 'expense' as const, amount: 999_999, date: '2026-11-01', is_deleted: true },
    ];
    // Two cycles before 25 Nov: from 25 Sep to 24 Nov.
    expect(averageSpending(tx, 25, '2026-11-25', 2).get('food')).toBe(450_000);
  });

  it('adds up scheduled payments dated inside the cycle', () => {
    const s = {
      id: 's', user_id: 'u', name: 'Phone', payee: null, account_id: 'a', type: 'expense', transfer_account_id: null,
      category_id: 'phone', subcategory_id: null, amount: 49_900, amount_type: 'exact', amount_min: null, amount_max: null,
      frequency: 'weekly', interval: 2, start_date: '2026-11-02', month_end: false, next_date: '2026-11-30', end_date: null,
      weekend: 'none', auto_add: true, is_subscription: false, debt_id: null, notes: null, is_active: true, created_at: '', updated_at: '',
    } satisfies Schedule;
    // Cycle 25 Nov to 23 Dec: 30 Nov, 14 Dec.
    expect(scheduledSpending([s], 25, '2026-11-25').get('phone')).toBe(99_800);
  });
});
