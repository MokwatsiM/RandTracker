// Credit card and interest calculations

/**
 * Calculate credit card interest and payoff timeline
 * @param balance - Current balance in cents
 * @param annualRate - Annual interest rate as percentage
 * @param paymentAmount - Monthly payment in cents
 * @param months - Maximum months to project (default 120 = 10 years)
 * @returns Payoff details
 */
export function calculateCreditCardInterest(
  balance: number,
  annualRate: number,
  paymentAmount: number,
  months: number = 120
): {
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  willPayOff: boolean;
} {
  const monthlyRate = annualRate / 100 / 12;
  let remaining = balance;
  let totalInterest = 0;
  let monthCount = 0;

  while (remaining > 0 && monthCount < months) {
    const interest = Math.ceil(remaining * monthlyRate);

    // Check if payment even covers the interest
    if (paymentAmount <= interest) {
      return {
        monthsToPayoff: -1,
        totalInterest: -1,
        totalPaid: -1,
        willPayOff: false,
      };
    }

    totalInterest += interest;
    remaining = remaining + interest - paymentAmount;
    monthCount++;

    if (remaining <= 0) {
      break;
    }
  }

  return {
    monthsToPayoff: monthCount,
    totalInterest,
    totalPaid: balance + totalInterest,
    willPayOff: remaining <= 0,
  };
}

/**
 * Calculate payment needed to pay off credit card by specific date
 * @param balance - Current balance in cents
 * @param annualRate - Annual interest rate as percentage
 * @param targetMonths - Number of months to pay off
 * @returns Required monthly payment
 */
export function calculatePaymentForTarget(
  balance: number,
  annualRate: number,
  targetMonths: number
): {
  requiredPayment: number;
  totalInterest: number;
  totalPaid: number;
} {
  const monthlyRate = annualRate / 100 / 12;

  // Use credit card payment formula (similar to loan amortisation)
  const requiredPayment = Math.ceil(
    (balance * (monthlyRate * Math.pow(1 + monthlyRate, targetMonths))) /
      (Math.pow(1 + monthlyRate, targetMonths) - 1)
  );

  const result = calculateCreditCardInterest(balance, annualRate, requiredPayment, targetMonths);

  return {
    requiredPayment,
    totalInterest: result.totalInterest,
    totalPaid: result.totalPaid,
  };
}

/**
 * Calculate minimum payment for credit card
 * @param balance - Current balance in cents
 * @param minimumPercentage - Minimum payment percentage (e.g., 5 for 5%)
 * @param minimumFloor - Absolute minimum payment in cents (e.g., 20000 for R200)
 * @returns Minimum payment amount
 */
export function calculateMinimumPayment(
  balance: number,
  minimumPercentage: number = 5,
  minimumFloor: number = 20000
): number {
  const percentageAmount = Math.ceil(balance * (minimumPercentage / 100));
  return Math.max(percentageAmount, minimumFloor);
}

/**
 * Calculate credit utilisation percentage
 * @param balance - Current balance in cents
 * @param creditLimit - Credit limit in cents
 * @returns Utilisation percentage (0-100)
 */
export function calculateCreditUtilisation(balance: number, creditLimit: number): number {
  if (creditLimit === 0) return 0;
  return Math.min(Math.round((balance / creditLimit) * 100), 100);
}

/**
 * Calculate interest charged on carried balance
 * @param balance - Balance in cents
 * @param annualRate - Annual interest rate as percentage
 * @returns Monthly interest charge in cents
 */
export function calculateMonthlyInterest(balance: number, annualRate: number): number {
  const monthlyRate = annualRate / 100 / 12;
  return Math.ceil(balance * monthlyRate);
}

/**
 * Calculate debt-to-income ratio
 * @param totalDebtPayments - Total monthly debt payments in cents
 * @param monthlyIncome - Monthly income in cents
 * @returns DTI percentage
 */
export function calculateDebtToIncomeRatio(
  totalDebtPayments: number,
  monthlyIncome: number
): number {
  if (monthlyIncome === 0) return 0;
  return Math.round((totalDebtPayments / monthlyIncome) * 100);
}
