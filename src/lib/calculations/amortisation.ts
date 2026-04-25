// Loan amortisation calculations

export interface AmortisationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  totalInterest: number;
}

export interface AmortisationSummary {
  schedule: AmortisationRow[];
  totalPayments: number;
  totalInterest: number;
  totalPrincipal: number;
  monthsToPayoff: number;
}

export function generatePaydownSchedule(
  currentBalance: number,
  annualRate: number,
  monthlyPayment: number,
  extraMonthly: number = 0,
  maxMonths: number = 600
): AmortisationSummary {
  const monthlyRate = annualRate / 100 / 12;
  const schedule: AmortisationRow[] = [];
  let balance = currentBalance;
  let totalInterest = 0;
  let month = 0;

  if (currentBalance <= 0 || monthlyPayment <= 0) {
    return {
      schedule: [],
      totalPayments: 0,
      totalInterest: 0,
      totalPrincipal: currentBalance,
      monthsToPayoff: 0,
    };
  }

  while (balance > 0 && month < maxMonths) {
    month++;
    const interest = monthlyRate > 0 ? Math.ceil(balance * monthlyRate) : 0;
    const payment = Math.min(monthlyPayment + extraMonthly, balance + interest);

    if (payment <= interest && balance > 0) {
      break;
    }

    const principalPaid = payment - interest;
    balance -= principalPaid;
    totalInterest += interest;

    schedule.push({
      month,
      payment,
      principal: principalPaid,
      interest,
      balance: Math.max(0, balance),
      totalInterest,
    });
  }

  return {
    schedule,
    totalPayments: schedule.reduce((sum, row) => sum + row.payment, 0),
    totalInterest,
    totalPrincipal: currentBalance,
    monthsToPayoff: schedule.length,
  };
}

/**
 * Generate full amortisation schedule for a loan
 * @param principal - Loan amount in cents
 * @param annualRate - Annual interest rate as percentage (e.g., 11.5)
 * @param termMonths - Loan term in months
 * @param extraMonthly - Extra payment per month in cents (optional)
 * @returns Full amortisation schedule
 */
export function generateAmortisation(
  principal: number,
  annualRate: number,
  termMonths: number,
  extraMonthly: number = 0
): AmortisationSummary {
  const monthlyRate = annualRate / 100 / 12;

  // Calculate base monthly payment using amortisation formula
  const basePayment = Math.ceil(
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
  );

  const schedule: AmortisationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  // Generate payment schedule
  while (balance > 0 && month < termMonths * 2) {
    // Safety cap at double the term
    month++;

    const interest = Math.ceil(balance * monthlyRate);
    const payment = Math.min(basePayment + extraMonthly, balance + interest);
    const principalPaid = payment - interest;

    balance -= principalPaid;
    totalInterest += interest;

    schedule.push({
      month,
      payment,
      principal: principalPaid,
      interest,
      balance: Math.max(0, balance),
      totalInterest,
    });

    if (balance <= 0) break;
  }

  return {
    schedule,
    totalPayments: schedule.reduce((sum, row) => sum + row.payment, 0),
    totalInterest,
    totalPrincipal: principal,
    monthsToPayoff: month,
  };
}

/**
 * Calculate savings from extra payments
 * @param principal - Loan amount in cents
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Original loan term in months
 * @param extraMonthly - Extra payment per month in cents
 * @returns Comparison of standard vs. accelerated payoff
 */
export function calculateExtraPaymentSavings(
  principal: number,
  annualRate: number,
  termMonths: number,
  extraMonthly: number
): {
  standardPayoff: AmortisationSummary;
  acceleratedPayoff: AmortisationSummary;
  interestSaved: number;
  monthsSaved: number;
} {
  const standardPayoff = generateAmortisation(principal, annualRate, termMonths, 0);
  const acceleratedPayoff = generateAmortisation(principal, annualRate, termMonths, extraMonthly);

  return {
    standardPayoff,
    acceleratedPayoff,
    interestSaved: standardPayoff.totalInterest - acceleratedPayoff.totalInterest,
    monthsSaved: standardPayoff.monthsToPayoff - acceleratedPayoff.monthsToPayoff,
  };
}

/**
 * Calculate remaining term and total interest for an existing loan
 * @param currentBalance - Current outstanding balance in cents
 * @param annualRate - Annual interest rate as percentage
 * @param monthlyPayment - Current monthly payment in cents
 * @returns Projected payoff details
 */
export function calculateRemainingTerm(
  currentBalance: number,
  annualRate: number,
  monthlyPayment: number
): {
  monthsRemaining: number;
  totalInterestRemaining: number;
  estimatedPayoffDate: Date;
} {
  const monthlyRate = annualRate / 100 / 12;
  let balance = currentBalance;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600; // 50 years safety cap

  while (balance > 0 && months < maxMonths) {
    const interest = Math.ceil(balance * monthlyRate);

    // Check if payment covers interest
    if (monthlyPayment <= interest) {
      // Loan will never be paid off with current payment
      return {
        monthsRemaining: -1,
        totalInterestRemaining: -1,
        estimatedPayoffDate: new Date('9999-12-31'),
      };
    }

    totalInterest += interest;
    balance = balance + interest - monthlyPayment;
    months++;

    if (balance <= 0) break;
  }

  const estimatedPayoffDate = new Date();
  estimatedPayoffDate.setMonth(estimatedPayoffDate.getMonth() + months);

  return {
    monthsRemaining: months,
    totalInterestRemaining: totalInterest,
    estimatedPayoffDate,
  };
}
