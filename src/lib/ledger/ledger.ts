import type { Account, Transaction } from '@/lib/db/schema';

// Helpers for the transaction ledger. Split parts and the balance rules match migration
// 018 (transaction_lines, cleared_balance) and 010 (account_balance).

export interface SplitPart {
  category_id: string;
  subcategory_id?: string | null;
  /** Cents, positive. */
  amount: number;
  notes?: string | null;
}

export interface CategoryLine {
  category_id: string | null;
  subcategory_id: string | null;
  amount: number;
}

type LineSource = Pick<Transaction, 'category_id' | 'subcategory_id' | 'amount'> & { splits?: SplitPart[] | null };

/** One line per category: each part of a split transaction, or the transaction itself. */
export function categoryLines(t: LineSource): CategoryLine[] {
  if (t.splits && t.splits.length > 0) {
    return t.splits.map((s) => ({ category_id: s.category_id, subcategory_id: s.subcategory_id ?? null, amount: s.amount }));
  }
  return [{ category_id: t.category_id || null, subcategory_id: t.subcategory_id ?? null, amount: t.amount }];
}

/** The transaction's amount in this category: a split part's share, or all of it. */
export function amountInCategory(t: LineSource, categoryId: string): number {
  return categoryLines(t)
    .filter((line) => line.category_id === categoryId)
    .reduce((sum, line) => sum + line.amount, 0);
}

export function hasCategory(t: LineSource, categoryId: string): boolean {
  return categoryLines(t).some((line) => line.category_id === categoryId);
}

/** Why a split can't be saved, or null if it can. The database checks the same. */
export function splitProblem(total: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return 'A split needs at least two parts.';
  if (parts.some((p) => !p.category_id)) return 'Choose a category for every part.';
  if (parts.some((p) => !(p.amount > 0))) return 'Every part needs an amount.';
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  if (sum !== total) {
    const diff = (Math.abs(total - sum) / 100).toFixed(2);
    return sum < total ? `R${diff} still to assign to a part.` : `The parts are R${diff} more than the total.`;
  }
  return null;
}

/** "#Groceries and #school-fees" -> ["groceries", "school-fees"]. */
export function tagsInText(text: string | null | undefined): string[] {
  return [...(text ?? '').matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((m) => normaliseTag(m[1]));
}

export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
}

/** Combines tags without duplicates, keeping the order they were first seen. */
export function mergeTags(...lists: (string[] | null | undefined)[]): string[] {
  return [...new Set(lists.flatMap((l) => l ?? []).map(normaliseTag).filter(Boolean))];
}

/** The transaction's effect on this account in cents: positive in, negative out, or null. */
export function signedAmount(t: Pick<Transaction, 'account_id' | 'transfer_account_id' | 'type' | 'amount'>, accountId: string): number | null {
  if (t.account_id === accountId) return t.type === 'income' ? t.amount : -t.amount;
  if (t.type === 'transfer' && t.transfer_account_id === accountId) return t.amount;
  return null;
}

/**
 * The account's balance after each transaction, oldest first, starting from the opening
 * balance. Same-day transactions are ordered by when they were added.
 */
export function runningBalances(account: Pick<Account, 'id' | 'initial_balance'>, transactions: Transaction[]): Map<string, number> {
  const ordered = transactions
    .filter((t) => !t.is_deleted && signedAmount(t, account.id) !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
  const balances = new Map<string, number>();
  let balance = account.initial_balance;
  for (const t of ordered) {
    balance += signedAmount(t, account.id)!;
    balances.set(t.id, balance);
  }
  return balances;
}

/** The opening balance plus cleared transactions only. */
export function clearedBalance(account: Pick<Account, 'id' | 'initial_balance'>, transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => {
    if (t.is_deleted || !t.cleared) return sum;
    return sum + (signedAmount(t, account.id) ?? 0);
  }, account.initial_balance);
}

export type ClearedFilter = 'all' | 'cleared' | 'uncleared';

export interface TransactionFilter {
  search: string;
  type: 'all' | Transaction['type'];
  accountId: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  /** Rand, as typed; empty means no limit. */
  amountMin: string;
  amountMax: string;
  uncategorised: boolean;
  cleared: ClearedFilter;
  tagsAny: string[];
  tagsAll: string[];
}

export const EMPTY_FILTER: TransactionFilter = {
  search: '',
  type: 'all',
  accountId: 'all',
  categoryId: 'all',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  uncategorised: false,
  cleared: 'all',
  tagsAny: [],
  tagsAll: [],
};

export interface FilterNames {
  category: (id: string) => string | undefined;
  account: (id: string) => string | undefined;
}

export function matchesFilter(t: Transaction, f: TransactionFilter, names: FilterNames): boolean {
  if (f.dateFrom && t.date < f.dateFrom) return false;
  if (f.dateTo && t.date > f.dateTo) return false;
  if (f.type !== 'all' && t.type !== f.type) return false;
  if (f.accountId !== 'all' && t.account_id !== f.accountId && t.transfer_account_id !== f.accountId) return false;
  if (f.categoryId !== 'all' && !hasCategory(t, f.categoryId)) return false;
  if (f.uncategorised && (t.type === 'transfer' || categoryLines(t).some((l) => l.category_id))) return false;
  if (f.cleared === 'cleared' && !t.cleared) return false;
  if (f.cleared === 'uncleared' && t.cleared) return false;
  const min = f.amountMin ? Math.round(parseFloat(f.amountMin) * 100) : null;
  const max = f.amountMax ? Math.round(parseFloat(f.amountMax) * 100) : null;
  if (min !== null && Number.isFinite(min) && t.amount < min) return false;
  if (max !== null && Number.isFinite(max) && t.amount > max) return false;
  const tags = new Set((t.tags ?? []).map(normaliseTag));
  if (f.tagsAny.length && !f.tagsAny.some((tag) => tags.has(normaliseTag(tag)))) return false;
  if (f.tagsAll.length && !f.tagsAll.every((tag) => tags.has(normaliseTag(tag)))) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const haystack = [
      t.title,
      t.notes,
      t.imported_payee,
      ...categoryLines(t).map((l) => (l.category_id ? names.category(l.category_id) : '')),
      names.account(t.account_id),
      ...(t.tags ?? []).map((tag) => `#${tag}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function activeFilterCount(f: TransactionFilter): number {
  return (Object.keys(EMPTY_FILTER) as (keyof TransactionFilter)[]).filter(
    (k) => JSON.stringify(f[k]) !== JSON.stringify(EMPTY_FILTER[k])
  ).length;
}
