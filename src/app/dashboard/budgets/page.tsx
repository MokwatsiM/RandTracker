'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useUserStore } from '@/stores/userStore';
import { shouldIncludeInBudget, getCurrentBudgetPeriod } from '@/lib/calculations/budget';
import { formatZAR } from '@/lib/currency';
import type { Budget } from '@/lib/db/schema';
import { BudgetDialog } from '@/components/budgets/BudgetDialog';
import { BudgetCard } from '@/components/budgets/BudgetCard';

export default function BudgetsPage() {
  const user = useUserStore((state) => state.user);
  const { budgets, loadBudgets, deleteBudget } = useBudgetStore();
  const { categories, loadCategories, initializeDefaultCategories } = useCategoryStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>();

  useEffect(() => {
    if (user) {
      loadBudgets(user.id);
      loadCategories(user.id);
      initializeDefaultCategories(user.id);
      loadTransactions(user.id);
    }
  }, [initializeDefaultCategories, loadBudgets, loadCategories, loadTransactions, user]);

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
        <Button onClick={handleCreateBudget}>
          <Plus className="mr-2 h-4 w-4" />
          Create Budget
        </Button>
      </div>

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

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={selectedBudget}
      />
    </div>
  );
}
