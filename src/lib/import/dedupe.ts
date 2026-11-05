import type { ImportRow } from './types';

// Quotes and backslashes are dropped because the IDs are looked up in a URL filter,
// where they'd need escaping.
function normalisePayee(payee: string): string {
  return payee.toLowerCase().replace(/["\\]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * A stable ID for each row: the bank's own when it has one, otherwise date, amount and
 * description, plus a counter so two identical rows on one statement (two R35 coffees on
 * the same day) stay distinct. Importing the same file again gives the same IDs.
 */
export function assignImportIds(rows: ImportRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    if (row.bankId) return `ofx:${row.bankId}`;
    const base = `${row.date}|${row.amount}|${normalisePayee(row.payee)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return `${base}|${count}`;
  });
}

export interface ExistingTransaction {
  id: string;
  account_id: string;
  transfer_account_id?: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  title?: string;
}

/** The transaction's effect on this account in cents: positive in, negative out, or null. */
export function signedAmountFor(t: ExistingTransaction, accountId: string): number | null {
  if (t.account_id === accountId) return t.type === 'income' ? t.amount : -t.amount;
  if (t.type === 'transfer' && t.transfer_account_id === accountId) return t.amount;
  return null;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * Rows that probably already exist: same account, same amount and direction, within
 * `maxDays` days. Each existing transaction can only match one row, and the closest date
 * wins. Returns row index to existing transaction id.
 */
export function findPossibleDuplicates(
  rows: ImportRow[],
  existing: ExistingTransaction[],
  accountId: string,
  maxDays = 3,
  skip: Set<number> = new Set()
): Map<number, string> {
  const candidates: { row: number; id: string; distance: number }[] = [];
  const onAccount = existing
    .map((t) => ({ t, signed: signedAmountFor(t, accountId) }))
    .filter((x): x is { t: ExistingTransaction; signed: number } => x.signed !== null);

  rows.forEach((row, index) => {
    if (skip.has(index)) return;
    for (const { t, signed } of onAccount) {
      if (signed !== row.amount) continue;
      const distance = daysBetween(row.date, t.date);
      if (distance <= maxDays) candidates.push({ row: index, id: t.id, distance });
    }
  });

  candidates.sort((a, b) => a.distance - b.distance || a.row - b.row);
  const matches = new Map<number, string>();
  const used = new Set<string>();
  for (const c of candidates) {
    if (matches.has(c.row) || used.has(c.id)) continue;
    matches.set(c.row, c.id);
    used.add(c.id);
  }
  return matches;
}
