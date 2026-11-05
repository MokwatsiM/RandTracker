'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, X, Wand2 } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { matchSchedule } from '@/lib/schedules/match';
import { useUserStore } from '@/stores/userStore';
import { matchCategory } from '@/lib/statement-parser';
import { formatZAR } from '@/lib/currency';
import { applyRules } from '@/lib/rules/engine';
import type { RuleSubject } from '@/lib/rules/types';
import {
  assignImportIds,
  detectKind,
  findPossibleDuplicates,
  fromPdfResult,
  parseCsv,
  parseTextStatement,
  readCsvFile,
  type CsvMapping,
  type FileKind,
  type StatementFile,
} from '@/lib/import';
import { fetchExistingImportIds, fetchScheduleOccurrences } from '@/lib/supabase/data';
import type { Account } from '@/lib/db/schema';

interface StatementUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RowStatus = 'new' | 'imported' | 'possible';
type CategorySource = 'rule' | 'statement' | 'fallback' | 'you';

interface PreviewRow {
  key: number;
  include: boolean;
  status: RowStatus;
  duplicateOf?: string;
  importedId: string;
  date: string;
  /** Cents, positive in, negative out. */
  amount: number;
  type: 'income' | 'expense';
  importedPayee: string;
  title: string;
  notes?: string;
  categoryId: string;
  subcategoryId: string | null;
  categorySource: CategorySource;
  tags?: string[];
  excludeFromBudget: boolean;
  debtId: string | null;
  /** The schedule occurrence this row is, so the schedule moves on instead of adding it again. */
  schedule?: { id: string; date: string; name: string };
}

const LIABILITY_TYPES: Account['type'][] = ['credit_card', 'loan', 'store_card'];
const ACCEPT = '.pdf,.csv,.txt,.ofx,.qfx,.qif,application/pdf,text/csv';

export function StatementUploadDialog({ open, onOpenChange }: StatementUploadDialogProps) {
  const user = useUserStore((state) => state.user);
  const accounts = useAccountStore((state) => state.accounts);
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const { categories, subcategories } = useCategoryStore();
  const transactions = useTransactionStore((state) => state.transactions);
  const loadTransactions = useTransactionStore((state) => state.loadTransactions);
  const createTransactions = useTransactionStore((state) => state.createTransactions);
  const loadRules = useRuleStore((state) => state.loadRules);
  const learnCategories = useRuleStore((state) => state.learnCategories);
  const loadSchedules = useScheduleStore((state) => state.loadSchedules);

  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // CSV files stop at a mapping step before review.
  const [csv, setCsv] = useState<{ table: string[][]; mapping: CsvMapping } | null>(null);
  const [statement, setStatement] = useState<StatementFile | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);

  const account = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (open && user) {
      void loadTransactions(user.id);
      void loadRules(user.id);
      void loadSchedules(user.id);
    }
  }, [open, user, loadTransactions, loadRules, loadSchedules]);

  const reset = () => {
    setFile(null);
    setCsv(null);
    setStatement(null);
    setRows([]);
    setError(null);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const categoryTypes = useMemo(() => new Map(categories.map((c) => [c.id, c.type])), [categories]);

  const fallbackCategory = (type: 'income' | 'expense') =>
    categories.find((c) => c.type === type && /^other (expenses|income)$/i.test(c.name))?.id ??
    categories.find((c) => c.type === type)?.id ??
    '';

  /** Rules, duplicate checks and categories for every row of a parsed statement. */
  const buildPreview = async (file: StatementFile) => {
    if (!user || !account) return;
    const rules = await loadRules(user.id);
    const importIds = assignImportIds(file.rows);
    const alreadyImported = await fetchExistingImportIds(account.id, importIds);
    const importedIndexes = new Set(importIds.flatMap((id, i) => (alreadyImported.has(id) ? [i] : [])));
    const possible = findPossibleDuplicates(file.rows, transactions, account.id, 3, importedIndexes);
    const titles = new Map(transactions.map((t) => [t.id, `${t.title} on ${t.date}`]));
    const schedules = await loadSchedules(user.id, { force: true });
    const accountSchedules = schedules.filter((s) => s.account_id === account.id);
    const occurrences = await fetchScheduleOccurrences(accountSchedules.map((s) => s.id));
    const claimed = new Set<string>();

    const preview = file.rows.map((row, key): PreviewRow => {
      const type = row.amount >= 0 ? 'income' : 'expense';
      const subject: RuleSubject = {
        imported_payee: row.payee,
        title: row.title || row.payee,
        notes: row.notes ?? null,
        account_id: account.id,
        type,
        amount: Math.abs(row.amount),
        date: row.date,
        category_id: null,
      };
      const { subject: result, applied } = applyRules(subject, rules, { categoryTypes });

      let categoryId = result.category_id ?? '';
      let categorySource: CategorySource = 'rule';
      if (!categoryId || applied.length === 0) {
        const hinted = matchCategory(row.categoryHint, categories.filter((c) => c.type === type));
        categoryId = categoryId || hinted || fallbackCategory(type);
        categorySource = result.category_id ? 'rule' : hinted ? 'statement' : 'fallback';
      }

      let status: RowStatus = importedIndexes.has(key) ? 'imported' : possible.has(key) ? 'possible' : 'new';
      let duplicateOf = possible.has(key) ? titles.get(possible.get(key)!) : undefined;

      // A row that is a schedule's occurrence: if the schedule already added it, it's a
      // likely duplicate; otherwise it's linked so the schedule moves on.
      let schedule: PreviewRow['schedule'];
      const match = status === 'new' ? matchSchedule(row, account.id, accountSchedules) : null;
      if (match) {
        const occurrenceKey = `${match.scheduleId}|${match.scheduleDate}`;
        const existing = occurrences.get(occurrenceKey);
        const name = accountSchedules.find((s) => s.id === match.scheduleId)?.name ?? 'a schedule';
        if (existing && !existing.is_deleted) {
          status = 'possible';
          duplicateOf = `${existing.title} on ${existing.date}`;
        } else if (!existing && !claimed.has(occurrenceKey)) {
          claimed.add(occurrenceKey);
          schedule = { id: match.scheduleId, date: match.scheduleDate, name };
          const scheduled = accountSchedules.find((s) => s.id === match.scheduleId);
          if (categorySource === 'fallback' && scheduled?.category_id) {
            categoryId = scheduled.category_id;
            categorySource = 'rule';
          }
        }
      }

      return {
        key,
        include: status === 'new',
        status,
        duplicateOf,
        schedule,
        importedId: importIds[key],
        date: row.date,
        amount: row.amount,
        type,
        importedPayee: row.payee,
        title: result.title,
        notes: result.notes ?? undefined,
        categoryId,
        subcategoryId: result.subcategory_id ?? null,
        categorySource,
        tags: result.tags ?? undefined,
        excludeFromBudget: result.exclude_from_budget ?? false,
        debtId: result.debt_id ?? null,
      };
    });

    setStatement(file);
    setRows(preview);
  };

  const handleRead = async () => {
    if (!file || !account) return;
    setBusy('reading');
    setError(null);
    try {
      const head = await file.slice(0, 2048).text();
      const kind: FileKind | null = detectKind(file.name, head);
      if (!kind) throw new Error('Choose a PDF, CSV, OFX, QFX or QIF file.');

      if (kind === 'pdf') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('accountId', account.id);
        const response = await fetch('/api/statements/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to read the statement');
        await buildPreview(fromPdfResult(result));
      } else if (kind === 'csv') {
        const { table, mapping } = readCsvFile(await file.text(), account.import_settings?.csv);
        if (table.length === 0) throw new Error('This file is empty.');
        setCsv({
          table,
          mapping: mapping ?? { headerRow: 0, dateColumn: 0, payeeColumn: 1, amountColumn: 2, dateOrder: 'DMY' },
        });
        // A remembered mapping that still fits goes straight to review.
        if (mapping && account.import_settings?.csv === mapping) {
          await buildPreview(parseCsv(table, mapping));
        }
      } else {
        await buildPreview(parseTextStatement(kind, await file.text()));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read the statement');
    } finally {
      setBusy(null);
    }
  };

  const handleMapped = async () => {
    if (!csv) return;
    setBusy('reading');
    try {
      await buildPreview(parseCsv(csv.table, csv.mapping));
    } finally {
      setBusy(null);
    }
  };

  const updateRow = (key: number, patch: Partial<PreviewRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const included = rows.filter((r) => r.include);
  const counts = {
    new: rows.filter((r) => r.status === 'new').length,
    imported: rows.filter((r) => r.status === 'imported').length,
    possible: rows.filter((r) => r.status === 'possible').length,
  };

  // Compares the statement's closing balance with the account after this import.
  const balanceCheck = useMemo(() => {
    if (!statement?.closingBalance || !account) return null;
    const today = new Date().toISOString().slice(0, 10);
    const after = account.current_balance + included.filter((r) => r.date <= today).reduce((sum, r) => sum + r.amount, 0);
    const closing = LIABILITY_TYPES.includes(account.type) ? -Math.abs(statement.closingBalance) : statement.closingBalance;
    return { closing, after, difference: closing - after };
  }, [statement, account, included]);

  const handleImport = async () => {
    if (!user || !account || included.length === 0) return;
    setBusy('importing');
    setError(null);
    try {
      const created = await createTransactions(
        included.map((r) => ({
          user_id: user.id,
          account_id: account.id,
          type: r.type,
          amount: Math.abs(r.amount),
          category_id: r.categoryId,
          subcategory_id: r.subcategoryId ?? undefined,
          title: r.title,
          notes: r.notes,
          date: r.date,
          tags: r.tags,
          imported_payee: r.importedPayee,
          imported_id: r.importedId,
          // It came from the bank, so the bank has shown it.
          cleared: true,
          schedule_id: r.schedule?.id,
          schedule_date: r.schedule?.date,
          is_paid: true,
          is_recurring: false,
          is_subscription: false,
          is_debt_payment: Boolean(r.debtId),
          debt_id: r.debtId ?? undefined,
          exclude_from_budget: r.excludeFromBudget,
        })),
        { skipImported: true }
      );

      // Linked rows moved their schedules on in the database.
      if (included.some((r) => r.schedule)) {
        await loadSchedules(user.id, { force: true });
      }

      if (csv && JSON.stringify(account.import_settings?.csv) !== JSON.stringify(csv.mapping)) {
        await updateAccount(account.id, { import_settings: { ...account.import_settings, csv: csv.mapping } });
      }

      let learned = 0;
      const chosenByYou = included.filter((r) => r.categorySource === 'you');
      if (user.rule_learning !== false && chosenByYou.length > 0) {
        const all = useTransactionStore.getState().transactions;
        learned = await learnCategories(
          user.id,
          chosenByYou.map((r) => ({
            imported_payee: r.importedPayee,
            title: r.title,
            account_id: account.id,
            type: r.type,
            amount: Math.abs(r.amount),
            date: r.date,
            category_id: r.categoryId,
          })),
          all
        );
      }

      const skipped = included.length - created.length;
      alert(
        [
          `Imported ${created.length} transaction${created.length === 1 ? '' : 's'}.`,
          skipped > 0 ? `${skipped} were already imported and were skipped.` : '',
          learned > 0 ? `Learned categories for ${learned} payee${learned === 1 ? '' : 's'} from your changes.` : '',
        ].filter(Boolean).join('\n')
      );
      close(false);
    } catch (e) {
      console.error('Import error:', e);
      setError('Failed to import transactions. Nothing was saved, so you can try again.');
    } finally {
      setBusy(null);
    }
  };

  const header = csv ? csv.table[csv.mapping.headerRow] ?? [] : [];
  const columnOptions = header.map((name, i) => (
    <option key={i} value={i}>
      {name ? `${name} (column ${i + 1})` : `Column ${i + 1}`}
    </option>
  ));
  const setMapping = (patch: Partial<CsvMapping>) => csv && setCsv({ ...csv, mapping: { ...csv.mapping, ...patch } });
  const mappingPreview = csv && !statement ? parseCsv(csv.table, csv.mapping) : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            PDF (FNB credit card), CSV, OFX, QFX or QIF. Rules categorise each row, and rows already in RandTracker are
            left out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Account</label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={!!csv || !!statement}>
              <option value="">Choose an account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name} ({a.type})
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {!csv && !statement && (
            <div>
              <label className="text-sm font-medium mb-2 block">Statement file</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  className="hidden"
                  id="statement-upload"
                  disabled={busy !== null}
                />
                <label htmlFor="statement-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{file ? file.name : 'Click to choose a file'}</p>
                  <p className="text-xs text-gray-500">PDF, CSV, OFX, QFX or QIF</p>
                </label>
              </div>
              {file && (
                <div className="mt-4">
                  <Button onClick={handleRead} disabled={busy !== null || !accountId}>
                    {busy === 'reading' ? 'Reading...' : 'Read statement'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {csv && !statement && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Check which columns hold what. This is remembered for {account?.name}.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">
                  Header row
                  <Select value={csv.mapping.headerRow} onChange={(e) => setMapping({ headerRow: Number(e.target.value) })}>
                    {csv.table.slice(0, 30).map((r, i) => (
                      <option key={i} value={i}>
                        Line {i + 1}: {r.join(', ').slice(0, 50)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm">
                  Date
                  <Select value={csv.mapping.dateColumn} onChange={(e) => setMapping({ dateColumn: Number(e.target.value) })}>
                    {columnOptions}
                  </Select>
                </label>
                <label className="text-sm">
                  Dates are written
                  <Select value={csv.mapping.dateOrder} onChange={(e) => setMapping({ dateOrder: e.target.value as CsvMapping['dateOrder'] })}>
                    <option value="DMY">Day first (05/11/2026)</option>
                    <option value="MDY">Month first (11/05/2026)</option>
                    <option value="YMD">Year first (2026/11/05)</option>
                  </Select>
                </label>
                <label className="text-sm">
                  Description
                  <Select value={csv.mapping.payeeColumn} onChange={(e) => setMapping({ payeeColumn: Number(e.target.value) })}>
                    {columnOptions}
                  </Select>
                </label>
                <label className="text-sm">
                  Amounts are in
                  <Select
                    value={csv.mapping.amountColumn !== undefined ? 'one' : 'two'}
                    onChange={(e) =>
                      e.target.value === 'one'
                        ? setMapping({ amountColumn: csv.mapping.debitColumn ?? 0, debitColumn: undefined, creditColumn: undefined })
                        : setMapping({ amountColumn: undefined, debitColumn: 0, creditColumn: Math.min(1, header.length - 1) })
                    }
                  >
                    <option value="one">One column (money out is negative)</option>
                    <option value="two">Separate money out and money in columns</option>
                  </Select>
                </label>
                {csv.mapping.amountColumn !== undefined ? (
                  <label className="text-sm">
                    Amount
                    <Select value={csv.mapping.amountColumn} onChange={(e) => setMapping({ amountColumn: Number(e.target.value) })}>
                      {columnOptions}
                    </Select>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!csv.mapping.invertAmounts}
                        onChange={(e) => setMapping({ invertAmounts: e.target.checked })}
                      />
                      Money out is shown as positive
                    </span>
                  </label>
                ) : (
                  <>
                    <label className="text-sm">
                      Money out
                      <Select value={csv.mapping.debitColumn} onChange={(e) => setMapping({ debitColumn: Number(e.target.value) })}>
                        {columnOptions}
                      </Select>
                    </label>
                    <label className="text-sm">
                      Money in
                      <Select value={csv.mapping.creditColumn} onChange={(e) => setMapping({ creditColumn: Number(e.target.value) })}>
                        {columnOptions}
                      </Select>
                    </label>
                  </>
                )}
                <label className="text-sm">
                  Balance (optional)
                  <Select
                    value={csv.mapping.balanceColumn ?? ''}
                    onChange={(e) => setMapping({ balanceColumn: e.target.value === '' ? undefined : Number(e.target.value) })}
                  >
                    <option value="">None</option>
                    {columnOptions}
                  </Select>
                </label>
              </div>

              {mappingPreview && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium mb-2">
                    {mappingPreview.rows.length} transactions read
                    {mappingPreview.unparsedLines?.length ? `, ${mappingPreview.unparsedLines.length} lines skipped` : ''}
                  </p>
                  {mappingPreview.rows.slice(0, 4).map((r, i) => (
                    <div key={i} className="flex justify-between gap-4 text-muted-foreground">
                      <span className="truncate">
                        {r.date} · {r.payee}
                      </span>
                      <span className={r.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {r.amount >= 0 ? '+' : '-'}
                        {formatZAR(Math.abs(r.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={reset}>
                  <X className="h-4 w-4 mr-2" />
                  Start again
                </Button>
                <Button onClick={handleMapped} disabled={busy !== null || !mappingPreview?.rows.length}>
                  {busy === 'reading' ? 'Checking...' : 'Review transactions'}
                </Button>
              </div>
            </div>
          )}

          {statement && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="grid flex-1 gap-1 text-sm sm:grid-cols-2">
                    <span>
                      <strong>{counts.new}</strong> new
                    </span>
                    <span>
                      <strong>{counts.imported}</strong> already imported (left out)
                    </span>
                    <span>
                      <strong>{counts.possible}</strong> possible duplicates (unticked, please check)
                    </span>
                    <span>
                      <strong>{included.length}</strong> selected to import
                    </span>
                    {balanceCheck && (
                      <span className="sm:col-span-2">
                        Statement closing balance {formatZAR(balanceCheck.closing)} · {account?.name} after import{' '}
                        {formatZAR(balanceCheck.after)}
                        {balanceCheck.difference === 0 ? (
                          <span className="text-green-700 dark:text-green-400"> · they match</span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            {' '}
                            · differ by {formatZAR(Math.abs(balanceCheck.difference))}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {statement.unparsedLines && statement.unparsedLines.length > 0 && (
                <details className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-800 dark:bg-orange-950/20">
                  <summary className="cursor-pointer font-medium">
                    {statement.unparsedLines.length} line{statement.unparsedLines.length === 1 ? '' : 's'} couldn't be read. Add
                    these by hand if they're transactions.
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-xs">
                    {statement.unparsedLines.slice(0, 50).map((u, i) => (
                      <li key={i}>
                        {u.line} <span className="text-orange-700 dark:text-orange-400">({u.reason})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Transactions</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = rows.filter((r) => r.status !== 'imported').every((r) => r.include);
                    setRows(rows.map((r) => ({ ...r, include: r.status !== 'imported' && !all })));
                  }}
                >
                  Select all / none
                </Button>
              </div>

              <div className="max-h-[28rem] overflow-y-auto rounded-lg border divide-y">
                {rows.map((r) => (
                  <div
                    key={r.key}
                    className={`grid grid-cols-[auto_1fr] gap-3 p-3 sm:grid-cols-[auto_1fr_14rem_7rem] sm:items-center ${
                      r.status === 'imported' ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.include}
                      disabled={r.status === 'imported'}
                      onChange={(e) => updateRow(r.key, { include: e.target.checked })}
                      aria-label={`Import ${r.title}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.date}
                        {r.title !== r.importedPayee ? ` · ${r.importedPayee}` : ''}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.status === 'imported' && <Badge variant="secondary">Already imported</Badge>}
                        {r.status === 'possible' && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                            Possible duplicate{r.duplicateOf ? ` of ${r.duplicateOf}` : ''}
                          </Badge>
                        )}
                        {r.schedule && (
                          <Badge variant="outline" className="border-blue-400 text-blue-700 dark:text-blue-400">
                            Schedule: {r.schedule.name}
                          </Badge>
                        )}
                        {r.categorySource === 'rule' && (
                          <Badge variant="outline">
                            <Wand2 className="mr-1 h-3 w-3" />
                            Rule
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Select
                      className="col-start-2 sm:col-start-auto"
                      value={r.categoryId}
                      disabled={r.status === 'imported'}
                      onChange={(e) =>
                        updateRow(r.key, { categoryId: e.target.value, subcategoryId: null, categorySource: 'you' })
                      }
                      aria-label={`Category for ${r.title}`}
                    >
                      {categories
                        .filter((c) => c.type === r.type)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                    </Select>
                    <p
                      className={`col-start-2 text-sm font-medium sm:col-start-auto sm:text-right ${
                        r.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {r.amount >= 0 ? '+' : '-'}
                      {formatZAR(Math.abs(r.amount))}
                    </p>
                  </div>
                ))}
              </div>

              {user?.rule_learning !== false && (
                <p className="text-xs text-muted-foreground">
                  Categories you change here teach a rule for that payee, so next time they&apos;re set for you.
                </p>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <Button variant="outline" onClick={reset} disabled={busy !== null}>
                  <X className="h-4 w-4 mr-2" />
                  Start again
                </Button>
                <Button onClick={handleImport} disabled={busy !== null || included.length === 0}>
                  {busy === 'importing'
                    ? 'Importing...'
                    : `Import ${included.length} transaction${included.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
