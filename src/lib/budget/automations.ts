import { adjustForWorkingDay, nextOccurrence } from '@/lib/schedules/dates';
import type { Schedule } from '@/lib/schedules/types';
import { cycleEnd, cyclesUntil, previousCycleStart } from './cycles';

/** How a category's amount is worked out each cycle. Stored in budgets.template. */
/** 'manual' means the category is set by hand and left out of filling. */
export type TemplateKind = 'fixed' | 'average' | 'schedules' | 'goal' | 'percent' | 'manual';

export interface BudgetTemplate {
  kind: TemplateKind;
  /** average: how many past cycles to average. */
  cycles?: number;
  /** goal: the goal to save towards by its target date. */
  goal_id?: string;
  /** percent: share of this cycle's income. */
  percent?: number;
  /** Lower runs first when there isn't enough to go round. */
  priority?: number;
  /** Never let the category's available amount go above this, in cents. */
  up_to?: number | null;
}

export interface Automation {
  category_id: string;
  template: BudgetTemplate;
  /** The budget's amount and period, used by the fixed template. */
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom';
}

/** A budget amount as an amount per monthly cycle. */
export function perCycle(amount: number, period: Automation['period']): number {
  switch (period) {
    case 'weekly': return Math.round((amount * 52) / 12);
    case 'yearly': return Math.round(amount / 12);
    default: return amount;
  }
}

interface SpendingTransaction {
  category_id?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  exclude_from_budget?: boolean;
  is_deleted?: boolean;
}

/** Average spending per category over the `cycles` full cycles before `start`. */
export function averageSpending(
  transactions: SpendingTransaction[],
  payday: number,
  start: string,
  cycles: number
): Map<string, number> {
  let from = start;
  for (let i = 0; i < cycles; i++) from = previousCycleStart(payday, from);
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || t.is_deleted || t.exclude_from_budget || !t.category_id) continue;
    if (t.date < from || t.date >= start) continue;
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
  }
  return new Map([...totals].map(([id, total]) => [id, Math.round(total / cycles)]));
}

/** Expected schedule payments per category with an actual date inside the cycle. */
export function scheduledSpending(schedules: Schedule[], payday: number, start: string): Map<string, number> {
  const end = cycleEnd(payday, start);
  const totals = new Map<string, number>();
  for (const s of schedules) {
    if (!s.is_active || s.type !== 'expense' || !s.category_id) continue;
    let current: string | null = s.start_date;
    for (let i = 0; i < 2000 && current; i++) {
      if (s.end_date && current > s.end_date) break;
      const date = adjustForWorkingDay(current, s.weekend);
      if (date > end) break;
      if (date >= start) totals.set(s.category_id, (totals.get(s.category_id) ?? 0) + s.amount);
      current = nextOccurrence(s, current);
    }
  }
  return totals;
}

export interface GoalLike {
  id: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
}

export interface FillContext {
  payday: number;
  cycleStart: string;
  /** Money to budget right now, before this fill. */
  toBudget: number;
  income: number;
  /** What's already assigned and carried over, per category. */
  assigned: Map<string, number>;
  carried: Map<string, number>;
  average: (cycles: number) => Map<string, number>;
  scheduled: Map<string, number>;
  goals: GoalLike[];
}

/** What a template asks for this cycle, before priorities and the "up to" cap. Null if it can't tell. */
export function templateAmount(a: Automation, ctx: FillContext): number | null {
  const t = a.template;
  switch (t.kind) {
    case 'manual':
      return null;
    case 'fixed':
      return perCycle(a.amount, a.period);
    case 'average':
      return ctx.average(Math.max(1, t.cycles ?? 3)).get(a.category_id) ?? 0;
    case 'schedules':
      return ctx.scheduled.get(a.category_id) ?? 0;
    case 'percent':
      return Math.max(0, Math.round((ctx.income * (t.percent ?? 0)) / 100));
    case 'goal': {
      const goal = ctx.goals.find((g) => g.id === t.goal_id);
      if (!goal) return null;
      const remaining = Math.max(0, goal.target_amount - goal.current_amount);
      if (!goal.target_date) return null;
      if (goal.target_date < ctx.cycleStart) return remaining;
      return Math.ceil(remaining / cyclesUntil(ctx.payday, ctx.cycleStart, goal.target_date));
    }
  }
}

export interface FillResult {
  /** New assigned amount per category; only categories that change are included. */
  allocations: Map<string, number>;
  /** How much the automations wanted but couldn't get. */
  shortfall: number;
}

/**
 * Fills the cycle from each category's automation, in priority order, never assigning more
 * than there is to budget. "empty" only fills categories with nothing assigned yet;
 * "overwrite" replaces what automated categories have.
 */
export function fillBudget(automations: Automation[], ctx: FillContext, mode: 'empty' | 'overwrite'): FillResult {
  const targets = automations.filter((a) => mode === 'overwrite' || (ctx.assigned.get(a.category_id) ?? 0) === 0);
  // Overwriting gives back what those categories had, so it can be handed out again.
  let funds = ctx.toBudget + (mode === 'overwrite' ? targets.reduce((sum, a) => sum + (ctx.assigned.get(a.category_id) ?? 0), 0) : 0);
  const allocations = new Map<string, number>();
  let shortfall = 0;

  const ordered = [...targets].sort((a, b) => (a.template.priority ?? 0) - (b.template.priority ?? 0));
  for (const a of ordered) {
    let wanted = templateAmount(a, ctx);
    if (wanted === null) continue;
    if (a.template.up_to !== undefined && a.template.up_to !== null) {
      wanted = Math.min(wanted, Math.max(0, a.template.up_to - (ctx.carried.get(a.category_id) ?? 0)));
    }
    const given = Math.max(0, Math.min(wanted, funds));
    shortfall += wanted - given;
    funds -= given;
    if (given !== (ctx.assigned.get(a.category_id) ?? 0)) allocations.set(a.category_id, given);
  }

  return { allocations, shortfall };
}

export function describeTemplate(t: BudgetTemplate, amount: number, period: Automation['period'], goalName?: string): string {
  const cap = t.up_to ? `, up to R${(t.up_to / 100).toFixed(0)}` : '';
  switch (t.kind) {
    case 'manual': return 'Set by hand';
    case 'fixed': return `R${(perCycle(amount, period) / 100).toFixed(2)} each cycle${cap}`;
    case 'average': return `Average of the last ${t.cycles ?? 3} cycles${cap}`;
    case 'schedules': return `Scheduled payments${cap}`;
    case 'percent': return `${t.percent ?? 0}% of income${cap}`;
    case 'goal': return `Towards ${goalName ?? 'a goal'} by its date${cap}`;
  }
}
