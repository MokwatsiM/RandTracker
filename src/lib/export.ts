import type { Transaction, Account, Category, Budget, Debt, Goal } from './db/schema';
import { formatZAR } from './currency';
import { format } from 'date-fns';

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      // Handle values that might contain commas or quotes
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Download a string as a file
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export transactions to CSV
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
) {
  const headers = [
    'date',
    'title',
    'type',
    'amount',
    'amount_formatted',
    'category',
    'account',
    'notes',
    'is_recurring',
    'is_subscription',
  ];

  const data = transactions.map((t) => {
    const account = accounts.find((a) => a.id === t.account_id);
    const category = categories.find((c) => c.id === t.category_id);

    return {
      date: t.date,
      title: t.title,
      type: t.type,
      amount: t.amount,
      amount_formatted: formatZAR(t.amount),
      category: category?.name || '',
      account: account?.name || '',
      notes: t.notes || '',
      is_recurring: t.is_recurring,
      is_subscription: t.is_subscription,
    };
  });

  const csv = arrayToCSV(data, headers);
  const filename = `randtracker_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export accounts to CSV
 */
export function exportAccountsToCSV(accounts: Account[]) {
  const headers = [
    'name',
    'type',
    'current_balance',
    'current_balance_formatted',
    'initial_balance',
    'initial_balance_formatted',
    'currency',
    'is_primary',
    'is_archived',
  ];

  const data = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    current_balance: a.current_balance,
    current_balance_formatted: formatZAR(a.current_balance),
    initial_balance: a.initial_balance,
    initial_balance_formatted: formatZAR(a.initial_balance),
    currency: a.currency,
    is_primary: a.is_primary,
    is_archived: a.is_archived,
  }));

  const csv = arrayToCSV(data, headers);
  const filename = `randtracker_accounts_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export budgets to CSV
 */
export function exportBudgetsToCSV(budgets: Budget[], categories: Category[]) {
  const headers = [
    'name',
    'category',
    'amount',
    'amount_formatted',
    'period',
    'start_date',
    'end_date',
    'is_active',
  ];

  const data = budgets.map((b) => {
    const category = categories.find((c) => c.id === b.category_id);

    return {
      name: b.name,
      category: category?.name || '',
      amount: b.amount,
      amount_formatted: formatZAR(b.amount),
      period: b.period,
      start_date: b.start_date,
      end_date: b.end_date || '',
      is_active: b.is_active,
    };
  });

  const csv = arrayToCSV(data, headers);
  const filename = `randtracker_budgets_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export all data as JSON backup
 */
export function exportBackupJSON(data: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  debts: Debt[];
  goals: Goal[];
}) {
  const backup = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    data,
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `randtracker_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
  downloadFile(json, filename, 'application/json');
}

/**
 * Export comprehensive CSV report
 */
export function exportComprehensiveCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
) {
  // Create a comprehensive report with transactions and their details
  const headers = [
    'date',
    'time',
    'title',
    'type',
    'amount',
    'amount_formatted',
    'category_name',
    'category_type',
    'account_name',
    'account_type',
    'notes',
    'is_recurring',
    'is_subscription',
    'is_paid',
    'tags',
  ];

  const data = transactions.map((t) => {
    const account = accounts.find((a) => a.id === t.account_id);
    const category = categories.find((c) => c.id === t.category_id);

    return {
      date: t.date,
      time: t.time || '',
      title: t.title,
      type: t.type,
      amount: t.amount,
      amount_formatted: formatZAR(t.amount),
      category_name: category?.name || '',
      category_type: category?.type || '',
      account_name: account?.name || '',
      account_type: account?.type || '',
      notes: t.notes || '',
      is_recurring: t.is_recurring,
      is_subscription: t.is_subscription,
      is_paid: t.is_paid,
      tags: t.tags?.join('; ') || '',
    };
  });

  const csv = arrayToCSV(data, headers);
  const filename = `randtracker_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  downloadFile(csv, filename, 'text/csv');
}
