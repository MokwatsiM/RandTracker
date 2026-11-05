/**
 * Budget History Calculations
 * Calculate budget performance for historical periods
 */

import { startOfMonth, endOfMonth, subMonths, format, parseISO, isWithinInterval } from 'date-fns';
import type { Budget, Transaction } from '@/lib/db/schema';
import { shouldIncludeInBudget, budgetAmount } from './budget';

export interface BudgetPeriodSelection {
  start: Date;
  end: Date;
  label: string;
  isCurrent: boolean;
}

export interface BudgetPerformance {
  budgetId: string;
  budgetName: string;
  budgetedAmount: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isOverBudget: boolean;
  transactionCount: number;
}

export interface PeriodSummary {
  period: BudgetPeriodSelection;
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  percentageUsed: number;
  budgetPerformances: BudgetPerformance[];
  transactionCount: number;
}

/**
 * Get available budget periods (last 12 months + current)
 */
export function getAvailableBudgetPeriods(): BudgetPeriodSelection[] {
  const periods: BudgetPeriodSelection[] = [];
  const today = new Date();

  // Add current month
  periods.push({
    start: startOfMonth(today),
    end: endOfMonth(today),
    label: 'Current Month',
    isCurrent: true,
  });

  // Add last 11 months
  for (let i = 1; i <= 11; i++) {
    const monthDate = subMonths(today, i);
    periods.push({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
      label: format(monthDate, 'MMMM yyyy'),
      isCurrent: false,
    });
  }

  return periods;
}

/**
 * Calculate budget performance for a specific period
 */
export function calculateBudgetPerformance(
  budget: Budget,
  transactions: Transaction[],
  periodStart: Date,
  periodEnd: Date
): BudgetPerformance {
  // Filter transactions within the period that match this budget
  const relevantTransactions = transactions.filter((transaction) => {
    const transactionDate = parseISO(transaction.date);
    const isInPeriod = isWithinInterval(transactionDate, { start: periodStart, end: periodEnd });
    return isInPeriod && shouldIncludeInBudget(transaction, budget);
  });

  const spent = relevantTransactions.reduce((sum, transaction) => sum + budgetAmount(transaction, budget), 0);
  const remaining = budget.amount - spent;
  const percentageUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

  return {
    budgetId: budget.id,
    budgetName: budget.name,
    budgetedAmount: budget.amount,
    spent,
    remaining,
    percentageUsed: Math.round(percentageUsed),
    isOverBudget: spent > budget.amount,
    transactionCount: relevantTransactions.length,
  };
}

/**
 * Calculate overall period summary
 */
export function calculatePeriodSummary(
  budgets: Budget[],
  transactions: Transaction[],
  period: BudgetPeriodSelection
): PeriodSummary {
  const budgetPerformances = budgets.map((budget) =>
    calculateBudgetPerformance(budget, transactions, period.start, period.end)
  );

  const totalBudgeted = budgetPerformances.reduce((sum, perf) => sum + perf.budgetedAmount, 0);
  const totalSpent = budgetPerformances.reduce((sum, perf) => sum + perf.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const percentageUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const transactionCount = budgetPerformances.reduce((sum, perf) => sum + perf.transactionCount, 0);

  return {
    period,
    totalBudgeted,
    totalSpent,
    totalRemaining,
    percentageUsed: Math.round(percentageUsed),
    budgetPerformances,
    transactionCount,
  };
}

/**
 * Compare two budget periods
 */
export function compareBudgetPeriods(
  currentSummary: PeriodSummary,
  previousSummary: PeriodSummary
): {
  spendingChange: number;
  spendingChangePercent: number;
  budgetAdherence: 'improved' | 'declined' | 'same';
  summary: string;
} {
  const spendingChange = currentSummary.totalSpent - previousSummary.totalSpent;
  const spendingChangePercent =
    previousSummary.totalSpent > 0
      ? ((spendingChange / previousSummary.totalSpent) * 100)
      : 0;

  let budgetAdherence: 'improved' | 'declined' | 'same' = 'same';

  if (currentSummary.percentageUsed < previousSummary.percentageUsed) {
    budgetAdherence = 'improved';
  } else if (currentSummary.percentageUsed > previousSummary.percentageUsed) {
    budgetAdherence = 'declined';
  }

  const summary =
    budgetAdherence === 'improved'
      ? `Your budget adherence improved by ${Math.abs(currentSummary.percentageUsed - previousSummary.percentageUsed)}%`
      : budgetAdherence === 'declined'
      ? `Your budget adherence declined by ${Math.abs(currentSummary.percentageUsed - previousSummary.percentageUsed)}%`
      : 'Your budget adherence remained the same';

  return {
    spendingChange,
    spendingChangePercent: Math.round(spendingChangePercent),
    budgetAdherence,
    summary,
  };
}

/**
 * Get budget trend over last N months
 */
export function getBudgetTrend(
  budgets: Budget[],
  transactions: Transaction[],
  monthsBack: number = 6
): {
  months: string[];
  budgeted: number[];
  spent: number[];
  percentages: number[];
} {
  const months: string[] = [];
  const budgeted: number[] = [];
  const spent: number[] = [];
  const percentages: number[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const period: BudgetPeriodSelection = {
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
      label: format(monthDate, 'MMM yy'),
      isCurrent: i === 0,
    };

    const summary = calculatePeriodSummary(budgets, transactions, period);

    months.push(period.label);
    budgeted.push(summary.totalBudgeted);
    spent.push(summary.totalSpent);
    percentages.push(summary.percentageUsed);
  }

  return {
    months,
    budgeted,
    spent,
    percentages,
  };
}
