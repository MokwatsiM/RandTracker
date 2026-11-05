'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, Search, Filter, X, ArrowUpDown, Upload, Bookmark } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useToastStore } from '@/stores/toastStore';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { TransactionDialog } from '@/components/transactions/TransactionDialog';
import { StatementUploadDialog } from '@/components/statements/StatementUploadDialog';
import { formatZAR } from '@/lib/currency';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import {
  EMPTY_FILTER,
  activeFilterCount,
  categoryLines,
  matchesFilter,
  mergeTags,
  type TransactionFilter,
} from '@/lib/ledger/ledger';
import type { Transaction } from '@/lib/db/schema';

type SortField = 'date' | 'amount' | 'category';
type SortDirection = 'asc' | 'desc';

/** Rows drawn at a time; long histories stay quick to scroll. */
const PAGE_SIZE = 100;

const defaultFilter = (): TransactionFilter => ({
  ...EMPTY_FILTER,
  dateFrom: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
  dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
});

export default function TransactionsPage() {
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const { transactions, loadTransactions, updateTransactions, deleteTransactions, restoreTransactions } = useTransactionStore();
  const accounts = useAccountStore((state) => state.accounts);
  const loadAccounts = useAccountStore((state) => state.loadAccounts);
  const { categories, subcategories, loadCategories, initializeDefaultCategories } = useCategoryStore();
  const learnCategories = useRuleStore((state) => state.learnCategories);
  const loadRules = useRuleStore((state) => state.loadRules);
  const showToast = useToastStore((state) => state.show);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filter, setFilter] = useState<TransactionFilter>(defaultFilter);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      loadTransactions(user.id);
      loadAccounts(user.id);
      loadCategories(user.id);
      initializeDefaultCategories(user.id);
      loadRules(user.id);
    }
  }, [user, loadTransactions, loadAccounts, loadCategories, initializeDefaultCategories, loadRules]);

  const categoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name : undefined);
  const names = useMemo(
    () => ({
      category: (id: string) => categories.find((c) => c.id === id)?.name,
      account: (id: string) => accounts.find((a) => a.id === id)?.name,
    }),
    [categories, accounts]
  );

  const filtered = useMemo(() => {
    const list = transactions.filter((t) => matchesFilter(t, filter, names));
    const direction = sortDirection === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (sortField === 'amount') return direction * (a.amount - b.amount);
      if (sortField === 'category') {
        const nameA = names.category(categoryLines(a)[0]?.category_id ?? '') ?? '';
        const nameB = names.category(categoryLines(b)[0]?.category_id ?? '') ?? '';
        return direction * nameA.localeCompare(nameB);
      }
      return direction * a.date.localeCompare(b.date);
    });
  }, [transactions, filter, sortField, sortDirection, names]);

  // A new filter starts from the top again.
  useEffect(() => {
    setVisible(PAGE_SIZE);
    setSelected(new Set());
  }, [filter]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filtered]);

  const set = (patch: Partial<TransactionFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const filterCount = activeFilterCount({ ...filter, dateFrom: '', dateTo: '' });
  const savedFilters = user?.saved_filters ?? [];
  const allTags = useMemo(() => mergeTags(...transactions.map((t) => t.tags)).sort(), [transactions]);
  const selectedRows = filtered.filter((t) => selected.has(t.id));

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const removeWithUndo = async (rows: Transaction[]) => {
    if (rows.length === 0) return;
    if (rows.some((t) => t.reconciled) && !window.confirm('Some of these were reconciled against a statement. Delete them anyway?')) return;
    setBusy(true);
    try {
      await deleteTransactions(rows);
      setSelected(new Set());
      showToast(`Deleted ${rows.length === 1 ? `"${rows[0].title}"` : `${rows.length} transactions`}.`, {
        label: 'Undo',
        run: () => restoreTransactions(rows),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  /** Saves a change to every selected transaction in one request, with undo. */
  const bulkChange = async (describe: string, change: (t: Transaction) => Transaction | null) => {
    const before = selectedRows;
    const after = before.map(change).filter((t): t is Transaction => t !== null);
    if (after.length === 0) return;
    setBusy(true);
    try {
      await updateTransactions(after);
      const originals = before.filter((t) => after.some((a) => a.id === t.id));
      showToast(`${describe} on ${after.length} transaction${after.length === 1 ? '' : 's'}.`, {
        label: 'Undo',
        run: () => updateTransactions(originals),
      });
      return after;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const setCategoryForSelected = async () => {
    if (!bulkCategory || !user) return;
    const category = categories.find((c) => c.id === bulkCategory);
    // Split transactions keep their parts, and transfers have no category.
    const changed = await bulkChange(`Category set to ${category?.name}`, (t) =>
      t.splits?.length || t.type === 'transfer' || category?.type !== t.type ? null : { ...t, category_id: bulkCategory, subcategory_id: undefined }
    );
    setBulkCategory('');
    if (changed?.length && user.rule_learning !== false) {
      const all = useTransactionStore.getState().transactions;
      await learnCategories(user.id, changed.map((t) => ({ ...t, category_id: bulkCategory })), all).catch(() => undefined);
    }
  };

  const addTagToSelected = async () => {
    const tags = mergeTags(bulkTag.split(','));
    if (tags.length === 0) return;
    await bulkChange(`Tagged ${tags.map((t) => `#${t}`).join(' ')}`, (t) => ({ ...t, tags: mergeTags(t.tags, tags) }));
    setBulkTag('');
  };

  const saveFilter = () => {
    const name = window.prompt('Name this filter');
    if (!name?.trim()) return;
    updateProfile({ saved_filters: [...savedFilters.filter((s) => s.name !== name.trim()), { name: name.trim(), filter }] });
  };

  if (!user) return null;

  const shown = filtered.slice(0, visible);
  const allShownSelected = shown.length > 0 && shown.every((t) => selected.has(t.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Track all your income and expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Statement
          </Button>
          <Button onClick={() => { setSelectedTransaction(undefined); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Income</p><p className="text-2xl font-bold text-green-600">{formatZAR(totals.income)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Expenses</p><p className="text-2xl font-bold text-red-600">{formatZAR(totals.expenses)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net</p><p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatZAR(totals.net)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[12rem] relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search title, notes, category, #tag..." className="pl-9" value={filter.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
            <Button variant={showFilters ? 'default' : 'outline'} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
            {savedFilters.length > 0 && (
              <Select
                className="w-auto"
                value=""
                onChange={(e) => {
                  const saved = savedFilters.find((s) => s.name === e.target.value);
                  if (saved) setFilter({ ...EMPTY_FILTER, ...saved.filter });
                }}
                aria-label="Saved filters"
              >
                <option value="">Saved filters...</option>
                {savedFilters.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
            )}
            <Button variant="ghost" onClick={saveFilter} title="Save this filter">
              <Bookmark className="h-4 w-4" />
              <span className="sr-only">Save this filter</span>
            </Button>
            {(filterCount > 0 || filter.search) && (
              <Button variant="ghost" onClick={() => setFilter(defaultFilter())}>
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid gap-4 border-t pt-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium">From<Input type="date" value={filter.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} /></label>
              <label className="text-sm font-medium">To<Input type="date" value={filter.dateTo} onChange={(e) => set({ dateTo: e.target.value })} /></label>
              <label className="text-sm font-medium">Type
                <Select value={filter.type} onChange={(e) => set({ type: e.target.value as TransactionFilter['type'] })}>
                  <option value="all">All types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </label>
              <label className="text-sm font-medium">Account
                <Select value={filter.accountId} onChange={(e) => set({ accountId: e.target.value })}>
                  <option value="all">All accounts</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </Select>
              </label>
              <label className="text-sm font-medium">Category
                <Select value={filter.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm font-medium">
                <label>Min (R)<Input type="number" step="0.01" min="0" value={filter.amountMin} onChange={(e) => set({ amountMin: e.target.value })} /></label>
                <label>Max (R)<Input type="number" step="0.01" min="0" value={filter.amountMax} onChange={(e) => set({ amountMax: e.target.value })} /></label>
              </div>
              <label className="text-sm font-medium">Cleared
                <Select value={filter.cleared} onChange={(e) => set({ cleared: e.target.value as TransactionFilter['cleared'] })}>
                  <option value="all">All</option>
                  <option value="cleared">Cleared</option>
                  <option value="uncleared">Not cleared</option>
                </Select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
                <input type="checkbox" checked={filter.uncategorised} onChange={(e) => set({ uncategorised: e.target.checked })} />
                Only uncategorised
              </label>
              {allTags.length > 0 && (
                <div className="text-sm font-medium md:col-span-2 lg:col-span-4">
                  Tags
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {allTags.map((tag) => {
                      const on = filter.tagsAny.includes(tag) || filter.tagsAll.includes(tag);
                      return (
                        <button
                          key={tag}
                          className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          onClick={() => {
                            const key = filter.tagsAll.length ? 'tagsAll' : 'tagsAny';
                            const list = filter[key];
                            set({ [key]: on ? list.filter((t) => t !== tag) : [...list, tag] });
                          }}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                    <Select
                      className="ml-2 h-7 w-auto text-xs"
                      value={filter.tagsAll.length ? 'all' : 'any'}
                      onChange={(e) => {
                        const tags = [...filter.tagsAny, ...filter.tagsAll];
                        set(e.target.value === 'all' ? { tagsAll: tags, tagsAny: [] } : { tagsAny: tags, tagsAll: [] });
                      }}
                      aria-label="Match tags"
                    >
                      <option value="any">has any of these</option>
                      <option value="all">has all of these</option>
                    </Select>
                  </div>
                </div>
              )}
              {savedFilters.length > 0 && (
                <div className="text-xs text-muted-foreground md:col-span-2 lg:col-span-4">
                  Saved:{' '}
                  {savedFilters.map((s) => (
                    <button
                      key={s.name}
                      className="mr-2 underline"
                      onClick={() => window.confirm(`Delete the saved filter "${s.name}"?`) && updateProfile({ saved_filters: savedFilters.filter((x) => x.name !== s.name) })}
                    >
                      delete &ldquo;{s.name}&rdquo;
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="sticky top-2 z-10 border-primary">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select className="h-8 w-auto" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} aria-label="Category for selected">
              <option value="">Set category...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.type})</option>)}
            </Select>
            <Button size="sm" variant="outline" disabled={!bulkCategory || busy} onClick={() => void setCategoryForSelected()}>Apply</Button>
            <Input className="h-8 w-36" placeholder="Add tag" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} aria-label="Tag for selected" />
            <Button size="sm" variant="outline" disabled={!bulkTag.trim() || busy} onClick={() => void addTagToSelected()}>Tag</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulkChange('Marked cleared', (t) => (t.cleared ? null : { ...t, cleared: true }))}>Mark cleared</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulkChange('Marked not cleared', (t) => (!t.cleared || t.reconciled ? null : { ...t, cleared: false }))}>Not cleared</Button>
            <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={() => void removeWithUndo(selectedRows)}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((t) => t.id)) : new Set())}
                  aria-label="Select all shown"
                />
                Select
              </label>
              <span className="text-muted-foreground">Sort by:</span>
              {(['date', 'amount', 'category'] as const).map((field) => (
                <button key={field} onClick={() => handleSort(field)} className={`flex items-center gap-1 capitalize ${sortField === field ? 'text-primary font-medium' : ''}`}>
                  {field}
                  {sortField === field && <ArrowUpDown className="h-3 w-3" />}
                </button>
              ))}
              <span className="ml-auto text-muted-foreground">{filtered.length} transactions</span>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="space-y-1">
              {shown.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={categories.find((c) => c.id === transaction.category_id)}
                  subcategoryName={subcategories.find((s) => s.id === transaction.subcategory_id)?.name}
                  splitNames={transaction.splits?.map((s) => categoryName(s.category_id) ?? '?')}
                  account={accounts.find((a) => a.id === transaction.account_id)}
                  toAccount={accounts.find((a) => a.id === transaction.transfer_account_id)}
                  onEdit={(t) => { setSelectedTransaction(t); setDialogOpen(true); }}
                  onDelete={(t) => void removeWithUndo([t])}
                  selected={selected.has(transaction.id)}
                  onSelect={(on) => {
                    const next = new Set(selected);
                    if (on) next.add(transaction.id);
                    else next.delete(transaction.id);
                    setSelected(next);
                  }}
                />
              ))}
              {filtered.length > visible && (
                <div className="pt-4 text-center">
                  <Button variant="outline" onClick={() => setVisible(visible + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, filtered.length - visible)} more of {filtered.length - visible}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">{filterCount > 0 || filter.search ? 'No transactions match your filters' : 'No transactions in these dates'}</p>
              <p className="text-sm mb-4">{filterCount > 0 || filter.search ? 'Try changing the filters or search' : 'Change the dates or add a transaction'}</p>
              {transactions.length === 0 && (
                <Button onClick={() => { setSelectedTransaction(undefined); setDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} transaction={selectedTransaction} />
      <StatementUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />
    </div>
  );
}
