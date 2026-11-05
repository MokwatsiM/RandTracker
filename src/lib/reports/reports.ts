import { arrayToCSV, downloadFile } from '@/lib/export';
import { categoryLines } from '@/lib/ledger/ledger';
import { addDays, upcomingOccurrences } from '@/lib/schedules/dates';
import type { Schedule } from '@/lib/schedules/types';
import type { Transaction } from '@/lib/db/schema';

/** Saves report rows as a CSV file. Amounts in cents become rand. */
export function downloadReport(name: string, rows: Record<string, unknown>[], centsColumns: string[] = []) {
  if (rows.length === 0) return;
  const converted = rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const column of centsColumns) {
      if (typeof copy[column] === 'number') copy[column] = ((copy[column] as number) / 100).toFixed(2);
    }
    return copy;
  });
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(arrayToCSV(converted, Object.keys(rows[0])), `randtracker-${name}-${date}.csv`, 'text/csv');
}

export interface CalendarDay {
  date: string;
  /** Spent that day, in cents. */
  spent: number;
  income: number;
  /** Scheduled payments still to come that day. */
  scheduled: { name: string; amount: number; type: Schedule['type'] }[];
}

/** One entry per day of the month containing `month` (yyyy-MM-dd). */
export function calendarMonth(month: string, transactions: Transaction[], schedules: Schedule[], today: string): CalendarDay[] {
  const first = `${month.slice(0, 7)}-01`;
  const days: CalendarDay[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) {
    days.push({ date: d, spent: 0, income: 0, scheduled: [] });
  }
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const t of transactions) {
    const day = byDate.get(t.date);
    if (!day || t.is_deleted) continue;
    if (t.type === 'expense') day.spent += t.amount;
    if (t.type === 'income') day.income += t.amount;
  }
  // Only what hasn't happened yet: past occurrences are already transactions.
  const last = days[days.length - 1].date;
  for (const s of schedules) {
    if (!s.is_active) continue;
    for (const o of upcomingOccurrences(s, last)) {
      const day = byDate.get(o.date);
      if (day && o.date >= today) day.scheduled.push({ name: s.name, amount: s.amount, type: s.type });
    }
  }
  return days;
}

export interface FlowLink {
  from: string;
  to: string;
  amount: number;
}

/**
 * Where income went over a period: income categories into "Income", then out to each
 * expense category, with what's left as "Saved" (or "From savings" when spending was more).
 * Split transactions count each part. Transfers are left out.
 */
export function moneyFlow(transactions: Transaction[], from: string, to: string, categoryName: (id: string) => string): FlowLink[] {
  const income = new Map<string, number>();
  const spending = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_deleted || t.date < from || t.date > to || t.type === 'transfer') continue;
    for (const line of categoryLines(t)) {
      const name = line.category_id ? categoryName(line.category_id) : 'Uncategorised';
      const map = t.type === 'income' ? income : spending;
      map.set(name, (map.get(name) ?? 0) + line.amount);
    }
  }
  const links: FlowLink[] = [];
  for (const [name, amount] of income) links.push({ from: name, to: 'Income', amount });
  const totalIn = [...income.values()].reduce((a, b) => a + b, 0);
  const totalOut = [...spending.values()].reduce((a, b) => a + b, 0);
  if (totalOut > totalIn) links.push({ from: 'From savings', to: 'Income', amount: totalOut - totalIn });
  for (const [name, amount] of [...spending].sort((a, b) => b[1] - a[1])) links.push({ from: 'Income', to: name, amount });
  if (totalIn > totalOut) links.push({ from: 'Income', to: 'Saved', amount: totalIn - totalOut });
  return links;
}

/** Months between two dates, for "debt free in N months" style labels. */
export function monthsUntil(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth());
}

export { addDays };
