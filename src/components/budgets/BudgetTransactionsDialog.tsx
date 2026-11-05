'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatZAR } from '@/lib/currency';
import { format, parseISO } from 'date-fns';
import type { Budget, Transaction, Category, Account } from '@/lib/db/schema';
import { shouldIncludeInBudget, budgetAmount } from '@/lib/calculations/budget';
import { ReceiptText, TrendingDown, Calendar, Tag } from 'lucide-react';

interface BudgetTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  periodStart: Date;
  periodEnd: Date;
  periodLabel?: string;
}

export function BudgetTransactionsDialog({
  open,
  onOpenChange,
  budget,
  transactions,
  categories,
  accounts,
  periodStart,
  periodEnd,
  periodLabel,
}: BudgetTransactionsDialogProps) {
  const budgetTransactions = useMemo(() => {
    if (!budget) return [];

    return transactions
      .filter((transaction) => {
        const transactionDate = parseISO(transaction.date);
        const isInPeriod =
          transactionDate >= periodStart && transactionDate <= periodEnd;
        return isInPeriod && shouldIncludeInBudget(transaction, budget);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [budget, transactions, periodStart, periodEnd]);

  const totalSpent = useMemo(() => {
    if (!budget) return 0;
    return budgetTransactions.reduce((sum, txn) => sum + budgetAmount(txn, budget), 0);
  }, [budgetTransactions, budget]);

  if (!budget) return null;

  const budgetCategory = categories.find((c) => c.id === budget.category_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            {budget.name} Transactions
          </DialogTitle>
          <DialogDescription>
            {periodLabel || 'Period'}: {format(periodStart, 'MMM d, yyyy')} - {format(periodEnd, 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">Budget Amount</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {formatZAR(budget.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">Total Spent</p>
                <p className={`text-lg font-bold ${totalSpent > budget.amount ? 'text-red-600' : 'text-green-600'}`}>
                  {formatZAR(totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">Transactions</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {budgetTransactions.length}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-700 dark:text-blue-300">Budget Usage</span>
                <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                  {budget.amount > 0 ? Math.round((totalSpent / budget.amount) * 100) : 0}%
                </span>
              </div>
              <div className="relative w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full transition-all ${
                    totalSpent > budget.amount
                      ? 'bg-red-500'
                      : totalSpent > budget.amount * 0.9
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((totalSpent / budget.amount) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-2">
            {budgetTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ReceiptText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No transactions found</p>
                <p className="text-sm">
                  No transactions match this budget for the selected period
                </p>
              </div>
            ) : (
              budgetTransactions.map((transaction) => {
                const category = categories.find((c) => c.id === transaction.category_id);
                const account = accounts.find((a) => a.id === transaction.account_id);

                return (
                  <div
                    key={transaction.id}
                    className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Title and Category */}
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {transaction.title || 'Untitled Transaction'}
                            </h4>
                            {category && (
                              <div className="flex items-center gap-1 mt-1">
                                <Tag className="h-3 w-3 text-gray-500" />
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {category.icon} {category.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Date and Account */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(parseISO(transaction.date), 'MMM d, yyyy')}</span>
                          </div>
                          {account && (
                            <div className="flex items-center gap-1">
                              <span>{account.icon}</span>
                              <span>{account.name}</span>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {transaction.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {transaction.notes}
                          </p>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="ml-4 text-right flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <span className="text-lg font-bold text-red-600">
                            {formatZAR(transaction.amount)}
                          </span>
                        </div>
                        {transaction.is_paid && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            ✓ Paid
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
