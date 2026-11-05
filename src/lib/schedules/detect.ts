import { normaliseText } from '@/lib/rules/engine';
import { adjustForWorkingDay, nextOccurrence, toDate } from './dates';
import type { Schedule, ScheduleDraft, ScheduleFrequency } from './types';

interface HistoryTransaction {
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  title: string;
  imported_payee?: string;
  category_id?: string;
  subcategory_id?: string;
  schedule_id?: string | null;
  is_deleted?: boolean;
}

interface DebtLike {
  id: string;
  name: string;
  minimum_payment?: number;
  payment_day?: number;
  is_active: boolean;
  account_id?: string;
}

export interface ScheduleSuggestion {
  key: string;
  reason: string;
  /** How many past transactions it's based on, or 0 for one from a debt. */
  seen: number;
  draft: ScheduleDraft;
}

const PATTERNS: { frequency: ScheduleFrequency; interval: number; days: number; slack: number }[] = [
  { frequency: 'weekly', interval: 1, days: 7, slack: 1 },
  { frequency: 'weekly', interval: 2, days: 14, slack: 2 },
  { frequency: 'monthly', interval: 1, days: 30.4, slack: 4 },
  { frequency: 'monthly', interval: 3, days: 91.3, slack: 8 },
  { frequency: 'yearly', interval: 1, days: 365.25, slack: 12 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Looks for payees paid regularly from the same account: at least three times, at a weekly,
 * fortnightly, monthly, quarterly or yearly rhythm, with similar amounts. Payees already
 * covered by a schedule are skipped.
 */
export function suggestSchedules(
  transactions: HistoryTransaction[],
  existing: Pick<Schedule, 'payee' | 'name' | 'account_id' | 'is_active'>[],
  asOf: string = today()
): ScheduleSuggestion[] {
  const covered = new Set(existing.filter((s) => s.is_active).map((s) => `${s.account_id}|${normaliseText(s.payee || s.name)}`));
  const groups = new Map<string, HistoryTransaction[]>();

  for (const t of transactions) {
    if (t.is_deleted || t.schedule_id || t.type === 'transfer') continue;
    const payee = normaliseText(t.imported_payee || t.title);
    if (payee.trim() === '') continue;
    const key = `${t.account_id}|${payee}`;
    if (covered.has(key)) continue;
    groups.set(`${key}|${t.type}`, [...(groups.get(`${key}|${t.type}`) ?? []), t]);
  }

  const suggestions: ScheduleSuggestion[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((t, i) => (toDate(t.date).getTime() - toDate(sorted[i].date).getTime()) / 86_400_000);
    const gap = median(gaps);
    const pattern = PATTERNS.find((p) => Math.abs(gap - p.days) <= p.slack);
    if (!pattern) continue;
    // Most gaps must fit, so one irregular month doesn't hide a real debit order.
    if (gaps.filter((g) => Math.abs(g - pattern.days) <= pattern.slack * 2).length < gaps.length * 0.7) continue;

    const amounts = sorted.map((t) => t.amount);
    const typical = median(amounts);
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.25)) continue;
    const exact = amounts.every((a) => a === amounts[0]);

    const last = sorted[sorted.length - 1];
    // Stale patterns (nothing for over two periods) aren't worth suggesting.
    if ((toDate(asOf).getTime() - toDate(last.date).getTime()) / 86_400_000 > pattern.days * 2 + pattern.slack) continue;

    const draft: ScheduleDraft = {
      name: last.title,
      payee: last.imported_payee || last.title,
      account_id: last.account_id,
      type: last.type,
      transfer_account_id: null,
      category_id: last.category_id || null,
      subcategory_id: last.subcategory_id || null,
      amount: Math.round(typical),
      amount_type: exact ? 'exact' : 'approx',
      amount_min: null,
      amount_max: null,
      frequency: pattern.frequency,
      interval: pattern.interval,
      start_date: last.date,
      month_end: false,
      next_date: null,
      end_date: null,
      weekend: last.type === 'income' ? 'before' : 'after',
      auto_add: false,
      is_subscription: false,
      debt_id: null,
      notes: null,
      is_active: true,
    };
    draft.next_date = nextOccurrence(draft, last.date);
    suggestions.push({ key, reason: `Seen ${list.length} times`, seen: list.length, draft });
  }

  return suggestions.sort((a, b) => b.seen - a.seen);
}

/** A monthly schedule for each active debt with a minimum payment and payment day. */
export function suggestDebtSchedules(
  debts: DebtLike[],
  existing: Pick<Schedule, 'debt_id' | 'is_active'>[],
  defaultAccountId: string | undefined,
  asOf: string = today()
): ScheduleSuggestion[] {
  const covered = new Set(existing.filter((s) => s.is_active && s.debt_id).map((s) => s.debt_id));
  return debts.flatMap((debt) => {
    const accountId = debt.account_id || defaultAccountId;
    if (!debt.is_active || covered.has(debt.id) || !debt.minimum_payment || !debt.payment_day || !accountId) return [];
    const [year, month] = asOf.split('-').map(Number);
    const day = Math.min(debt.payment_day, new Date(Date.UTC(year, month, 0)).getUTCDate());
    const thisMonth = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const draft: ScheduleDraft = {
      name: `${debt.name} payment`,
      payee: null,
      account_id: accountId,
      type: 'expense',
      transfer_account_id: null,
      category_id: null,
      subcategory_id: null,
      amount: debt.minimum_payment,
      amount_type: 'exact',
      amount_min: null,
      amount_max: null,
      frequency: 'monthly',
      interval: 1,
      start_date: thisMonth,
      month_end: false,
      next_date: thisMonth,
      end_date: null,
      weekend: 'after',
      auto_add: false,
      is_subscription: false,
      debt_id: debt.id,
      notes: null,
      is_active: true,
    };
    // If this month's payment date has passed, start from next month.
    if (adjustForWorkingDay(thisMonth, 'after') < asOf) draft.next_date = nextOccurrence(draft, thisMonth);
    return [{ key: `debt|${debt.id}`, reason: 'Minimum payment on a debt', seen: 0, draft }];
  });
}
