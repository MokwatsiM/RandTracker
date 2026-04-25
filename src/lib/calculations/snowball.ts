// Debt payoff strategy calculations (Snowball & Avalanche)

import type { Debt } from '../db/schema';

export interface DebtAllocationRow {
  debt_id: string;
  name: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface PortfolioPayoffRow {
  month: number;
  date: Date;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  remainingBalance: number;
  remainingDebts: number;
  allocations: DebtAllocationRow[];
}

export interface DebtPayoffPlan {
  debt_id: string;
  name: string;
  type: string;
  original_balance: number;
  payoff_month: number;
  payoff_date: Date;
  total_interest: number;
  total_paid: number;
  monthly_payments: number[];
}

export interface PayoffStrategy {
  strategy: 'snowball' | 'avalanche' | 'custom';
  debts: DebtPayoffPlan[];
  schedule: PortfolioPayoffRow[];
  total_months: number;
  total_interest: number;
  total_paid: number;
  debt_free_date: Date;
}

type WorkingDebt = Debt & {
  remaining_balance: number;
  interest_paid: number;
  months_to_payoff: number;
  monthly_payments: number[];
};

function sortDebts(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche' | 'custom'
) {
  const sortedDebts = [...debts];

  if (strategy === 'snowball') {
    sortedDebts.sort((a, b) => a.current_balance - b.current_balance);
  } else if (strategy === 'avalanche') {
    sortedDebts.sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0));
  } else {
    sortedDebts.sort((a, b) => (a.priority_order ?? 999) - (b.priority_order ?? 999));
  }

  return sortedDebts;
}

function simulatePayoffStrategy(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche' | 'custom',
  extraBudget: number = 0
): PayoffStrategy {
  const activeDebts = debts.filter((debt) => debt.is_active && debt.current_balance > 0);

  if (activeDebts.length === 0) {
    return {
      strategy,
      debts: [],
      schedule: [],
      total_months: 0,
      total_interest: 0,
      total_paid: 0,
      debt_free_date: new Date(),
    };
  }

  const workingDebts: WorkingDebt[] = sortDebts(activeDebts, strategy).map((debt) => ({
    ...debt,
    remaining_balance: debt.current_balance,
    interest_paid: 0,
    months_to_payoff: 0,
    monthly_payments: [],
  }));

  const schedule: PortfolioPayoffRow[] = [];
  let currentMonth = 0;
  let totalInterestPaid = 0;
  let totalPaid = 0;

  while (workingDebts.some((debt) => debt.remaining_balance > 0)) {
    currentMonth++;

    if (currentMonth > 600) {
      break;
    }

    const targetIndex = workingDebts.findIndex((debt) => debt.remaining_balance > 0);
    if (targetIndex === -1) {
      break;
    }

    const snowballPool =
      extraBudget +
      workingDebts.reduce((sum, debt, index) => {
        if (index === targetIndex || debt.remaining_balance > 0) {
          return sum;
        }

        return sum + (debt.minimum_payment ?? 0);
      }, 0);

    const allocations: DebtAllocationRow[] = [];
    let monthPayment = 0;
    let monthInterest = 0;
    let monthPrincipal = 0;
    let stalled = true;

    for (let index = 0; index < workingDebts.length; index++) {
      const debt = workingDebts[index];

      if (debt.remaining_balance <= 0) {
        debt.monthly_payments.push(0);
        allocations.push({
          debt_id: debt.id,
          name: debt.name,
          payment: 0,
          principal: 0,
          interest: 0,
          balance: 0,
        });
        continue;
      }

      const monthlyRate = (debt.interest_rate ?? 0) / 100 / 12;
      const interest = Math.ceil(debt.remaining_balance * monthlyRate);
      const baselinePayment = debt.minimum_payment ?? 0;
      const plannedPayment =
        index === targetIndex ? baselinePayment + snowballPool : baselinePayment;
      const payment = Math.min(plannedPayment, debt.remaining_balance + interest);

      if (payment > interest) {
        stalled = false;
      }

      const principalPaid = Math.max(0, payment - interest);
      debt.remaining_balance = Math.max(0, debt.remaining_balance - principalPaid);
      debt.interest_paid += interest;
      debt.monthly_payments.push(payment);

      if (debt.remaining_balance === 0 && debt.months_to_payoff === 0) {
        debt.months_to_payoff = currentMonth;
      }

      monthPayment += payment;
      monthInterest += interest;
      monthPrincipal += principalPaid;
      totalPaid += payment;
      totalInterestPaid += interest;

      allocations.push({
        debt_id: debt.id,
        name: debt.name,
        payment,
        principal: principalPaid,
        interest,
        balance: debt.remaining_balance,
      });
    }

    schedule.push({
      month: currentMonth,
      date: new Date(new Date().setMonth(new Date().getMonth() + currentMonth)),
      totalPayment: monthPayment,
      totalPrincipal: monthPrincipal,
      totalInterest: monthInterest,
      remainingBalance: workingDebts.reduce((sum, debt) => sum + debt.remaining_balance, 0),
      remainingDebts: workingDebts.filter((debt) => debt.remaining_balance > 0).length,
      allocations,
    });

    if (stalled) {
      break;
    }
  }

  const debtPlans: DebtPayoffPlan[] = workingDebts.map((debt) => {
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + debt.months_to_payoff);

    return {
      debt_id: debt.id,
      name: debt.name,
      type: 'debt',
      original_balance: debt.current_balance,
      payoff_month: debt.months_to_payoff,
      payoff_date: payoffDate,
      total_interest: debt.interest_paid,
      total_paid: debt.monthly_payments.reduce((sum, payment) => sum + payment, 0),
      monthly_payments: debt.monthly_payments,
    };
  });

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + currentMonth);

  return {
    strategy,
    debts: debtPlans,
    schedule,
    total_months: currentMonth,
    total_interest: totalInterestPaid,
    total_paid: totalPaid,
    debt_free_date: debtFreeDate,
  };
}

/**
 * Calculate debt payoff plan using Snowball, Avalanche, or Custom strategy
 * @param debts - Array of debts to pay off
 * @param strategy - Payoff strategy to use
 * @param extraBudget - Additional monthly amount beyond minimum payments (in cents)
 * @returns Complete payoff plan
 */
export function calculatePayoffPlan(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche' | 'custom',
  extraBudget: number = 0
): PayoffStrategy {
  return simulatePayoffStrategy(debts, strategy, extraBudget);
}

/**
 * Compare Snowball vs Avalanche strategies
 * @param debts - Array of debts
 * @param extraBudget - Extra monthly budget in cents
 * @returns Comparison of both strategies
 */
export function compareStrategies(
  debts: Debt[],
  extraBudget: number = 0
): {
  snowball: PayoffStrategy;
  avalanche: PayoffStrategy;
  interestDifference: number;
  monthsDifference: number;
  recommendation: 'snowball' | 'avalanche';
} {
  const snowball = calculatePayoffPlan(debts, 'snowball', extraBudget);
  const avalanche = calculatePayoffPlan(debts, 'avalanche', extraBudget);

  const interestDifference = snowball.total_interest - avalanche.total_interest;
  const monthsDifference = snowball.total_months - avalanche.total_months;

  // Avalanche is almost always mathematically optimal
  // Recommend snowball only if the difference is negligible (< 5% or < 3 months)
  const recommendation =
    Math.abs(interestDifference) < snowball.total_interest * 0.05 ||
    Math.abs(monthsDifference) <= 3
      ? 'snowball'
      : 'avalanche';

  return {
    snowball,
    avalanche,
    interestDifference,
    monthsDifference,
    recommendation,
  };
}

/**
 * Calculate minimum extra payment needed to be debt-free by target date
 * @param debts - Array of debts
 * @param targetMonths - Desired number of months to be debt-free
 * @param strategy - Strategy to use
 * @returns Required extra monthly payment
 */
export function calculateRequiredExtraPayment(
  debts: Debt[],
  targetMonths: number,
  strategy: 'snowball' | 'avalanche' = 'avalanche'
): {
  required_extra_payment: number;
  achievable: boolean;
  plan: PayoffStrategy;
} {
  // Binary search for the required extra payment
  let low = 0;
  let high = 1000000000; // R10,000,000 in cents (unrealistic high bound)
  let result = 0;
  let finalPlan: PayoffStrategy | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const plan = calculatePayoffPlan(debts, strategy, mid);

    if (plan.total_months <= targetMonths) {
      result = mid;
      finalPlan = plan;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return {
    required_extra_payment: result,
    achievable: finalPlan !== null && finalPlan.total_months <= targetMonths,
    plan: finalPlan || calculatePayoffPlan(debts, strategy, 0),
  };
}
