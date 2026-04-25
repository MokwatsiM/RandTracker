'use client';

import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, calculatePercentage } from '@/lib/currency';
import { calculateRemainingTerm } from '@/lib/calculations/amortisation';
import { calculateCreditCardInterest } from '@/lib/calculations/interest';
import type { Account, Debt } from '@/lib/db/schema';

interface DebtCardProps {
  debt: Debt;
  account?: Account;
  onEdit: (debt: Debt) => void;
  onDelete: (debt: Debt) => void;
}

export function DebtCard({ debt, account, onEdit, onDelete }: DebtCardProps) {
  const progress =
    debt.total_amount > 0
      ? calculatePercentage(debt.total_amount - debt.current_balance, debt.total_amount)
      : 0;

  const remainingTerm =
    debt.interest_rate !== undefined && debt.minimum_payment
      ? calculateRemainingTerm(debt.current_balance, debt.interest_rate, debt.minimum_payment)
      : null;

  const cardProjection =
    debt.interest_rate !== undefined && debt.minimum_payment
      ? calculateCreditCardInterest(debt.current_balance, debt.interest_rate, debt.minimum_payment)
      : null;

  const payoffDate =
    remainingTerm && remainingTerm.monthsRemaining > 0
      ? format(remainingTerm.estimatedPayoffDate, 'MMM yyyy')
      : cardProjection && cardProjection.willPayOff
        ? `${cardProjection.monthsToPayoff} months`
        : 'Not projected';

  // Calculate term progress if term_months is available
  const termProgress = debt.term_months && debt.term_months > 0 && remainingTerm
    ? Math.round(((debt.term_months - remainingTerm.monthsRemaining) / debt.term_months) * 100)
    : null;

  const monthsRemaining = remainingTerm?.monthsRemaining ||
    (cardProjection?.willPayOff ? cardProjection.monthsToPayoff : null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">{debt.name}</CardTitle>
          <CardDescription>
            {account ? `${account.icon} ${account.name}` : 'Standalone debt'}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(debt)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(debt)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Balance</p>
            <p className="text-xl font-semibold text-red-600">{formatZAR(debt.current_balance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Original Amount</p>
            <p className="text-xl font-semibold">{formatZAR(debt.total_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Minimum Payment</p>
            <p className="text-xl font-semibold">{formatZAR(debt.minimum_payment ?? 0)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Payoff progress</span>
            <span>{progress}% paid</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-green-500" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Interest Rate</p>
            <p>{debt.interest_rate !== undefined ? `${debt.interest_rate}%` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment Day</p>
            <p>{debt.payment_day ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Strategy</p>
            <p className="capitalize">{debt.payoff_strategy ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projected Payoff</p>
            <p>{payoffDate}</p>
          </div>
        </div>

        {/* Term Timeline (if term_months is available) */}
        {debt.term_months && monthsRemaining !== null && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Loan Term Progress</span>
              <span className="font-medium">
                {monthsRemaining} of {debt.term_months} months remaining
              </span>
            </div>
            {termProgress !== null && (
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${Math.min(termProgress, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
