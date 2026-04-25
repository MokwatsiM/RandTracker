'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Edit, Trash2, Star, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatZAR, calculatePercentage } from '@/lib/currency';
import type { Account } from '@/lib/db/schema';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onSetPrimary: (account: Account) => void;
}

export function AccountCard({ account, onEdit, onDelete, onSetPrimary }: AccountCardProps) {
  const router = useRouter();
  const isCreditCard = account.type === 'credit_card' || account.type === 'store_card';
  const isLoan = account.type === 'loan';
  const isDebt = isCreditCard || isLoan;

  // Calculate credit utilization for credit cards
  const creditUtilization = isCreditCard && account.credit_limit
    ? calculatePercentage(account.current_balance, account.credit_limit)
    : 0;

  const availableCredit = isCreditCard && account.credit_limit
    ? account.credit_limit - account.current_balance
    : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    router.push(`/dashboard/accounts/${account.id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <div
            className="text-2xl w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: account.color + '20' }}
          >
            {account.icon}
          </div>
          <div>
            <h3 className="font-semibold">{account.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {account.type.replace('_', ' ')}
              {account.is_primary && ' • Primary'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {account.is_primary && (
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          )}
          <button className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {/* Main Balance */}
          <div>
            <p className="text-sm text-muted-foreground">
              {isCreditCard ? 'Current Balance' : isLoan ? 'Outstanding' : 'Balance'}
            </p>
            <p className={`text-2xl font-bold ${isDebt ? 'text-red-600' : ''}`}>
              {formatZAR(account.current_balance)}
            </p>
          </div>

          {/* Credit Card Specific */}
          {isCreditCard && account.credit_limit && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available</span>
                <span className="font-medium text-green-600">
                  {formatZAR(availableCredit)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limit</span>
                <span>{formatZAR(account.credit_limit)}</span>
              </div>

              {/* Utilization Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Utilisation</span>
                  <span className={creditUtilization > 70 ? 'text-red-600' : ''}>
                    {creditUtilization}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      creditUtilization > 70
                        ? 'bg-red-500'
                        : creditUtilization > 50
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                  />
                </div>
              </div>

              {/* Payment Due */}
              {account.payment_due_day && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Due</span>
                  <span>Day {account.payment_due_day}</span>
                </div>
              )}
            </div>
          )}

          {/* Loan Specific */}
          {isLoan && (
            <div className="space-y-2">
              {account.loan_principal && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Amount</span>
                  <span>{formatZAR(account.loan_principal)}</span>
                </div>
              )}

              {account.monthly_instalment && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Payment</span>
                  <span className="font-medium">{formatZAR(account.monthly_instalment)}</span>
                </div>
              )}

              {account.loan_interest_rate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span>{account.loan_interest_rate}%</span>
                </div>
              )}

              {account.loan_term_months && account.loan_principal && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span>
                      {calculatePercentage(
                        account.loan_principal - account.current_balance,
                        account.loan_principal
                      )}
                      % paid
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${calculatePercentage(
                          account.loan_principal - account.current_balance,
                          account.loan_principal
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 mt-2 border-t">
            <button
              onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm hover:bg-accent rounded-md"
            >
              <Eye className="h-4 w-4" />
              Details
            </button>
            <button
              onClick={() => onEdit(account)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm hover:bg-accent rounded-md"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            {!account.is_primary && (
              <button
                onClick={() => onSetPrimary(account)}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm hover:bg-accent rounded-md"
              >
                <Star className="h-4 w-4" />
                Primary
              </button>
            )}
            <button
              onClick={() => onDelete(account)}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-md"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
