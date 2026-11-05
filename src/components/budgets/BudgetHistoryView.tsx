'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatZAR } from '@/lib/currency';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, ReceiptText, Edit2, MoreVertical } from 'lucide-react';
import type { PeriodSummary, BudgetPerformance } from '@/lib/calculations/budget-history';

interface BudgetHistoryViewProps {
  periodSummary: PeriodSummary;
  previousPeriodSummary?: PeriodSummary;
  onBudgetClick?: (budgetId: string) => void;
  onViewTransactions?: (budgetId: string) => void;
}

export function BudgetHistoryView({
  periodSummary,
  previousPeriodSummary,
  onBudgetClick,
  onViewTransactions,
}: BudgetHistoryViewProps) {
  const comparison = useMemo(() => {
    if (!previousPeriodSummary) return null;

    const spendingChange = periodSummary.totalSpent - previousPeriodSummary.totalSpent;
    const spendingChangePercent =
      previousPeriodSummary.totalSpent > 0
        ? ((spendingChange / previousPeriodSummary.totalSpent) * 100)
        : 0;

    const adherenceChange = periodSummary.percentageUsed - previousPeriodSummary.percentageUsed;

    return {
      spendingChange,
      spendingChangePercent: Math.round(spendingChangePercent * 10) / 10,
      adherenceChange: Math.round(adherenceChange),
      improved: adherenceChange < 0,
    };
  }, [periodSummary, previousPeriodSummary]);

  return (
    <div className="space-y-6">
      {/* Period Info */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
          {periodSummary.period.label}
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {periodSummary.period.start.toLocaleDateString()} - {periodSummary.period.end.toLocaleDateString()}
          {periodSummary.period.isCurrent && ' (Current Period)'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZAR(periodSummary.totalBudgeted)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {periodSummary.budgetPerformances.length} budget(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${periodSummary.totalSpent > periodSummary.totalBudgeted ? 'text-red-600' : 'text-green-600'}`}>
              {formatZAR(periodSummary.totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodSummary.transactionCount} transaction(s)
            </p>
            {comparison && (
              <div className="flex items-center gap-1 mt-2">
                {comparison.spendingChange > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : comparison.spendingChange < 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                ) : (
                  <Minus className="h-3 w-3 text-gray-500" />
                )}
                <span className={`text-xs ${comparison.spendingChange > 0 ? 'text-red-500' : comparison.spendingChange < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                  {comparison.spendingChange > 0 ? '+' : ''}{formatZAR(Math.abs(comparison.spendingChange))} vs last period
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${periodSummary.totalRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatZAR(periodSummary.totalRemaining)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {periodSummary.percentageUsed}% of budget used
            </p>
            {comparison && (
              <div className="flex items-center gap-1 mt-2">
                {comparison.improved ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs ${comparison.improved ? 'text-green-500' : 'text-red-500'}`}>
                  {comparison.improved ? 'Improved' : 'Declined'} by {Math.abs(comparison.adherenceChange)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Individual Budget Performance */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Budget Breakdown</h3>
        <div className="space-y-3">
          {periodSummary.budgetPerformances.map((performance) => (
            <BudgetPerformanceCard
              key={performance.budgetId}
              performance={performance}
              onEdit={() => onBudgetClick?.(performance.budgetId)}
              onViewTransactions={() => onViewTransactions?.(performance.budgetId)}
            />
          ))}

          {periodSummary.budgetPerformances.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No budgets for this period</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BudgetPerformanceCard({
  performance,
  onEdit,
  onViewTransactions,
}: {
  performance: BudgetPerformance;
  onEdit?: () => void;
  onViewTransactions?: () => void;
}) {
  return (
    <Card
      className={`transition-colors ${performance.isOverBudget ? 'border-red-300 dark:border-red-800' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-semibold">{performance.budgetName}</h4>
            <p className="text-sm text-muted-foreground">
              {performance.transactionCount} transaction(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={`text-lg font-bold ${performance.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                {formatZAR(performance.spent)}
              </p>
              <p className="text-sm text-muted-foreground">
                of {formatZAR(performance.budgetedAmount)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onViewTransactions}
                className="h-8 px-2"
                title="View Transactions"
              >
                <ReceiptText className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                className="h-8 px-2"
                title="Edit Budget"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all ${
              performance.isOverBudget
                ? 'bg-red-500'
                : performance.percentageUsed > 90
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(performance.percentageUsed, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {performance.percentageUsed}% used
          </span>
          <span className={`text-xs font-medium ${performance.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {performance.remaining >= 0 ? 'Remaining: ' : 'Over by: '}
            {formatZAR(Math.abs(performance.remaining))}
          </span>
        </div>

        {performance.isOverBudget && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3 w-3" />
            <span>Over budget!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
