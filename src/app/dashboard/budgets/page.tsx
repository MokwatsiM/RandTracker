'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Plus, History, Calendar } from 'lucide-react';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useUserStore } from '@/stores/userStore';
import { shouldIncludeInBudget, getCurrentBudgetPeriod } from '@/lib/calculations/budget';
import {
  getAvailableBudgetPeriods,
  calculatePeriodSummary,
  type BudgetPeriodSelection,
} from '@/lib/calculations/budget-history';
import { formatZAR } from '@/lib/currency';
import type { Budget } from '@/lib/db/schema';
import { BudgetDialog } from '@/components/budgets/BudgetDialog';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetHistoryView } from '@/components/budgets/BudgetHistoryView';
import { BudgetTransactionsDialog } from '@/components/budgets/BudgetTransactionsDialog';
import { useAccountStore } from '@/stores/accountStore';

export default function BudgetsPage() {
  const user = useUserStore((state) => state.user);
  const { budgets, loadBudgets, deleteBudget } = useBudgetStore();
  const { categories, loadCategories, initializeDefaultCategories } = useCategoryStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { accounts, loadAccounts } = useAccountStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>();
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [selectedBudgetForTransactions, setSelectedBudgetForTransactions] = useState<Budget | null>(null);

  // Get available periods
  const availablePeriods = useMemo(() => getAvailableBudgetPeriods(), []);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

  useEffect(() => {
    if (user) {
      loadBudgets(user.id);
      loadCategories(user.id);
      initializeDefaultCategories(user.id);
      loadTransactions(user.id);
      loadAccounts(user.id);
    }
  }, [initializeDefaultCategories, loadBudgets, loadCategories, loadTransactions, loadAccounts, user]);

  const budgetSpending = useMemo(() => {
    return new Map(
      budgets.map((budget) => {
        const period = getCurrentBudgetPeriod(budget);
        const spent = transactions
          .filter((transaction) => {
            const date = new Date(transaction.date);
            return (
              date >= period.start &&
              date <= period.end &&
              shouldIncludeInBudget(transaction, budget)
            );
          })
          .reduce((sum, transaction) => sum + transaction.amount, 0);

        return [budget.id, spent];
      })
    );
  }, [budgets, transactions]);

  const totals = useMemo(() => {
    const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + (budgetSpending.get(budget.id) ?? 0), 0);
    return {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
    };
  }, [budgetSpending, budgets]);

  // Calculate period summaries for historical view
  const selectedPeriodSummary = useMemo(() => {
    if (viewMode !== 'history' || !availablePeriods[selectedPeriodIndex]) return null;
    return calculatePeriodSummary(budgets, transactions, availablePeriods[selectedPeriodIndex]);
  }, [viewMode, selectedPeriodIndex, budgets, transactions, availablePeriods]);

  const previousPeriodSummary = useMemo(() => {
    if (viewMode !== 'history' || !availablePeriods[selectedPeriodIndex + 1]) return null;
    return calculatePeriodSummary(budgets, transactions, availablePeriods[selectedPeriodIndex + 1]);
  }, [viewMode, selectedPeriodIndex, budgets, transactions, availablePeriods]);

  const handleCreateBudget = () => {
    setSelectedBudget(undefined);
    setDialogOpen(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setSelectedBudget(budget);
    setDialogOpen(true);
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (confirm(`Are you sure you want to delete "${budget.name}"?`)) {
      await deleteBudget(budget.id);
    }
  };

  const handleViewTransactions = (budgetId: string) => {
    const budget = budgets.find((b) => b.id === budgetId);
    if (budget) {
      setSelectedBudgetForTransactions(budget);
      setTransactionsDialogOpen(true);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Manage your spending limits and track progress</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'history' ? 'default' : 'outline'}
            onClick={() => setViewMode(viewMode === 'current' ? 'history' : 'current')}
          >
            {viewMode === 'current' ? (
              <>
                <History className="mr-2 h-4 w-4" />
                View History
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Current Period
              </>
            )}
          </Button>
          <Button onClick={handleCreateBudget}>
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </div>
      </div>

      {/* Period Selector for History View */}
      {viewMode === 'history' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Select Period</label>
                <Select
                  value={selectedPeriodIndex.toString()}
                  onChange={(e) => setSelectedPeriodIndex(parseInt(e.target.value))}
                  className="w-full max-w-xs"
                >
                  {availablePeriods.map((period, index) => (
                    <option key={index} value={index}>
                      {period.label} {period.isCurrent && '(Current)'}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content based on view mode */}
      {viewMode === 'history' && selectedPeriodSummary ? (
        <BudgetHistoryView
          periodSummary={selectedPeriodSummary}
          previousPeriodSummary={previousPeriodSummary || undefined}
          onBudgetClick={(budgetId) => {
            const budget = budgets.find((b) => b.id === budgetId);
            if (budget) handleEditBudget(budget);
          }}
          onViewTransactions={handleViewTransactions}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatZAR(totals.totalBudgeted)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Spent This Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatZAR(totals.totalSpent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totals.totalRemaining < 0 ? 'text-red-600' : ''}`}>
                  {formatZAR(totals.totalRemaining)}
                </div>
              </CardContent>
            </Card>
          </div>

          {budgets.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Get Started with Budgeting</CardTitle>
                <CardDescription>
                  Create your first budget to track spending and stay on target
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Budgets help you control spending by setting limits for categories and tracking how much room you still have left in the current period.
                  </p>
                  <Button onClick={handleCreateBudget}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Budget
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  category={categories.find((category) => category.id === budget.category_id)}
                  spent={budgetSpending.get(budget.id) ?? 0}
                  onEdit={handleEditBudget}
                  onDelete={handleDeleteBudget}
                />
              ))}
            </div>
          )}
        </>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={selectedBudget}
      />

      <BudgetTransactionsDialog
        open={transactionsDialogOpen}
        onOpenChange={setTransactionsDialogOpen}
        budget={selectedBudgetForTransactions}
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        periodStart={viewMode === 'history' && availablePeriods[selectedPeriodIndex]
          ? availablePeriods[selectedPeriodIndex].start
          : getCurrentBudgetPeriod(selectedBudgetForTransactions || budgets[0] || { period: 'monthly', start_date: new Date().toISOString() } as Budget).start}
        periodEnd={viewMode === 'history' && availablePeriods[selectedPeriodIndex]
          ? availablePeriods[selectedPeriodIndex].end
          : getCurrentBudgetPeriod(selectedBudgetForTransactions || budgets[0] || { period: 'monthly', start_date: new Date().toISOString() } as Budget).end}
        periodLabel={viewMode === 'history' && availablePeriods[selectedPeriodIndex]
          ? availablePeriods[selectedPeriodIndex].label
          : 'Current Period'}
      />
    </div>
  );
}
