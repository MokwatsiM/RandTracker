'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, Search, Filter, X, ArrowUpDown } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { TransactionDialog } from '@/components/transactions/TransactionDialog';
import { formatZAR } from '@/lib/currency';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import type { Transaction } from '@/lib/db/schema';

type SortField = 'date' | 'amount' | 'category';
type SortDirection = 'asc' | 'desc';

export default function TransactionsPage() {
  const user = useUserStore(state => state.user);
  const transactions = useTransactionStore(state => state.transactions);
  const loadTransactions = useTransactionStore(state => state.loadTransactions);
  const deleteTransaction = useTransactionStore(state => state.deleteTransaction);
  const accounts = useAccountStore(state => state.accounts);
  const loadAccounts = useAccountStore(state => state.loadAccounts);
  const categories = useCategoryStore(state => state.categories);
  const loadCategories = useCategoryStore(state => state.loadCategories);
  const initializeDefaultCategories = useCategoryStore(state => state.initializeDefaultCategories);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Sort states
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (user) {
      loadTransactions(user.id);
      loadAccounts(user.id);
      loadCategories(user.id);
      initializeDefaultCategories(user.id);
    }
  }, [user, loadTransactions, loadAccounts, loadCategories, initializeDefaultCategories]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Date range filter
    filtered = filtered.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= new Date(dateFrom) && txDate <= new Date(dateTo);
    });

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Account filter
    if (filterAccount !== 'all') {
      filtered = filtered.filter(
        (t) => t.account_id === filterAccount || t.transfer_account_id === filterAccount
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category_id === filterCategory);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const category = categories.find(c => c.id === t.category_id);
        const account = accounts.find(a => a.id === t.account_id);
        return (
          category?.name.toLowerCase().includes(query) ||
          account?.name.toLowerCase().includes(query) ||
          t.title?.toLowerCase().includes(query) ||
          t.notes?.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          const catA = categories.find(c => c.id === a.category_id)?.name || '';
          const catB = categories.find(c => c.id === b.category_id)?.name || '';
          comparison = catA.localeCompare(catB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filterType, filterAccount, filterCategory, searchQuery, dateFrom, dateTo, sortField, sortDirection, categories, accounts]);

  // Calculate totals for filtered transactions
  const totals = useMemo(() => {
    const income = filteredAndSortedTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = filteredAndSortedTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expenses, net: income - expenses };
  }, [filteredAndSortedTransactions]);

  // Handler functions
  const handleAddTransaction = () => {
    setSelectedTransaction(undefined);
    setDialogOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(transaction.id);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterAccount('all');
    setFilterCategory('all');
    setSearchQuery('');
    setDateFrom(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
    setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  const hasActiveFilters = filterType !== 'all' || filterAccount !== 'all' || filterCategory !== 'all' || searchQuery !== '';

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Track all your income and expenses</p>
        </div>
        <Button onClick={handleAddTransaction}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-2xl font-bold text-green-600">{formatZAR(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatZAR(totals.expenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Net</p>
            <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatZAR(totals.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters && <span className="ml-1 bg-primary-foreground text-primary rounded-full w-2 h-2"></span>}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 pt-4 border-t">
                {/* Date Range */}
                <div>
                  <label className="text-sm font-medium mb-1 block">From Date</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">To Date</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                {/* Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                    <option value="all">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="transfer">Transfer</option>
                  </Select>
                </div>

                {/* Account Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Account</label>
                  <Select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
                    <option value="all">All Accounts</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.icon} {account.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent className="pt-6">
          {/* Sort Controls */}
          {filteredAndSortedTransactions.length > 0 && (
            <div className="flex gap-2 mb-4 pb-4 border-b">
              <span className="text-sm text-muted-foreground mr-2">Sort by:</span>
              <button
                onClick={() => handleSort('date')}
                className={`text-sm flex items-center gap-1 ${sortField === 'date' ? 'text-primary font-medium' : ''}`}
              >
                Date
                {sortField === 'date' && <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('amount')}
                className={`text-sm flex items-center gap-1 ${sortField === 'amount' ? 'text-primary font-medium' : ''}`}
              >
                Amount
                {sortField === 'amount' && <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('category')}
                className={`text-sm flex items-center gap-1 ${sortField === 'category' ? 'text-primary font-medium' : ''}`}
              >
                Category
                {sortField === 'category' && <ArrowUpDown className="h-3 w-3" />}
              </button>
            </div>
          )}

          {/* Transaction Rows */}
          {filteredAndSortedTransactions.length > 0 ? (
            <div className="space-y-1">
              {filteredAndSortedTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={categories.find(c => c.id === transaction.category_id)}
                  account={accounts.find(a => a.id === transaction.account_id)}
                  toAccount={accounts.find(a => a.id === transaction.transfer_account_id)}
                  onEdit={handleEditTransaction}
                  onDelete={handleDeleteTransaction}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">
                {hasActiveFilters || searchQuery
                  ? 'No transactions match your filters'
                  : 'No transactions yet'
                }
              </p>
              <p className="text-sm mb-4">
                {hasActiveFilters || searchQuery
                  ? 'Try adjusting your filters or search query'
                  : 'Start tracking your income and expenses'
                }
              </p>
              {!hasActiveFilters && !searchQuery && (
                <Button onClick={handleAddTransaction}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedTransaction}
      />
    </div>
  );
}
