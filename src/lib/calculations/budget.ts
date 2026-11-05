// Budget calculation utilities

import { addWeeks, addMonths, addYears, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import type { Budget } from '../db/schema';
import { amountInCategory, categoryLines, hasCategory, type SplitPart } from '../ledger/ledger';

/**
 * Calculate the current budget period dates
 * @param budget - Budget configuration
 * @returns Start and end dates for the current period
 */
export function getCurrentBudgetPeriod(budget: Budget): {
  start: Date;
  end: Date;
  daysRemaining: number;
  totalDays: number;
} {
  const now = new Date();
  const budgetStart = new Date(budget.start_date);
  let periodStart: Date;
  let periodEnd: Date;

  if (budget.period === 'custom') {
    periodStart = budgetStart;
    periodEnd = budget.end_date ? new Date(budget.end_date) : addMonths(budgetStart, 1);
  } else {
    // Calculate current period based on budget start date
    periodStart = new Date(budgetStart);

    while (periodStart <= now) {
      const nextPeriodStart = getNextPeriodStart(periodStart, budget.period);
      if (nextPeriodStart > now) {
        break;
      }
      periodStart = nextPeriodStart;
    }

    periodEnd = getNextPeriodStart(periodStart, budget.period);
  }

  const start = startOfDay(periodStart);
  const end = endOfDay(periodEnd);
  const totalDays = differenceInDays(end, start);
  const daysRemaining = Math.max(0, differenceInDays(end, now));

  return {
    start,
    end,
    daysRemaining,
    totalDays,
  };
}

/**
 * Get the start date of the next budget period
 * @param currentStart - Current period start date
 * @param period - Budget period type
 * @returns Next period start date
 */
export function getNextPeriodStart(
  currentStart: Date,
  period: 'weekly' | 'monthly' | 'yearly' | 'custom'
): Date {
  switch (period) {
    case 'weekly':
      return addWeeks(currentStart, 1);
    case 'monthly':
      return addMonths(currentStart, 1);
    case 'yearly':
      return addYears(currentStart, 1);
    default:
      return addMonths(currentStart, 1);
  }
}

/**
 * Calculate daily allowance (remaining budget / remaining days)
 * @param remainingBudget - Remaining budget in cents
 * @param daysRemaining - Days remaining in period
 * @returns Daily allowance in cents
 */
export function calculateDailyAllowance(remainingBudget: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return Math.floor(remainingBudget / daysRemaining);
}

/**
 * Calculate budget progress percentage
 * @param spent - Amount spent in cents
 * @param budgeted - Total budget in cents
 * @returns Percentage (0-100+)
 */
export function calculateBudgetProgress(spent: number, budgeted: number): number {
  if (budgeted === 0) return 0;
  return Math.round((spent / budgeted) * 100);
}

/**
 * Get budget status color based on progress
 * @param progress - Progress percentage
 * @returns Status color class
 */
export function getBudgetStatusColor(progress: number): {
  color: string;
  status: 'good' | 'warning' | 'danger' | 'exceeded';
} {
  if (progress < 50) {
    return { color: 'green', status: 'good' };
  } else if (progress < 75) {
    return { color: 'yellow', status: 'warning' };
  } else if (progress < 100) {
    return { color: 'orange', status: 'danger' };
  } else {
    return { color: 'red', status: 'exceeded' };
  }
}

/**
 * Calculate spending by category for a budget period
 * @param transactions - Transactions in the period
 * @returns Map of category_id to total spent
 */
export function calculateCategorySpending(
  transactions: Array<{ category_id: string; amount: number; type: string; splits?: SplitPart[] | null }>
): Map<string, number> {
  const spending = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    // A split transaction counts each part in its own category.
    for (const line of categoryLines(transaction)) {
      if (!line.category_id) continue;
      spending.set(line.category_id, (spending.get(line.category_id) || 0) + line.amount);
    }
  }

  return spending;
}

/**
 * Calculate projected spending for the budget period
 * @param currentSpent - Amount spent so far in cents
 * @param daysElapsed - Days elapsed in period
 * @param totalDays - Total days in period
 * @returns Projected total spending
 */
export function calculateProjectedSpending(
  currentSpent: number,
  daysElapsed: number,
  totalDays: number
): number {
  if (daysElapsed === 0) return 0;
  const dailyAverage = currentSpent / daysElapsed;
  return Math.round(dailyAverage * totalDays);
}

/**
 * Check if transaction should be included in budget
 * @param transaction - Transaction to check
 * @param budget - Budget configuration
 * @returns Whether transaction counts toward budget
 */
export function shouldIncludeInBudget(
  transaction: {
    type: string;
    category_id: string;
    amount: number;
    exclude_from_budget: boolean;
    splits?: SplitPart[] | null;
  },
  budget: Budget
): boolean {
  // Exclude if transaction is marked as excluded
  if (transaction.exclude_from_budget) return false;

  // Budgets track spend only in the current implementation
  if (transaction.type === 'income') return false;
  if (transaction.type === 'transfer') return false;

  if (budget.category_id) {
    if (!hasCategory(transaction, budget.category_id)) return false;
  }

  return true;
}

/** How much of the transaction counts towards the budget: only its part in the category, if split. */
export function budgetAmount(
  transaction: { category_id: string; amount: number; subcategory_id?: string; splits?: SplitPart[] | null },
  budget: Budget
): number {
  return budget.category_id ? amountInCategory(transaction, budget.category_id) : transaction.amount;
}
