'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/userStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  Edit,
  Plus,
  Star,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { formatZAR, calculatePercentage } from '@/lib/currency';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { Transaction } from '@/lib/db/schema';

export default function AccountDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params?.id as string;

  const user = useUserStore((state) => state.user);
  const { accounts, loadAccounts } = useAccountStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { categories, loadCategories } = useCategoryStore();

  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | 'all'>('3m');

  useEffect(() => {
    if (user) {
      loadAccounts(user.id);
      loadTransactions(user.id);
      loadCategories(user.id);
    }
  }, [user, loadAccounts, loadTransactions, loadCategories]);

  // Find the account
  const account = useMemo(() => {
    return accounts.find((acc) => acc.id === accountId);
  }, [accounts, accountId]);

  // Filter transactions for this account
  const accountTransactions = useMemo(() => {
    const filtered = transactions.filter(
      (t) => t.account_id === accountId || t.transfer_account_id === accountId
    );

    // Apply time range filter
    if (timeRange !== 'all') {
      const months = timeRange === '1m' ? 1 : timeRange === '3m' ? 3 : 6;
      const startDate = startOfMonth(subMonths(new Date(), months - 1));
      return filtered.filter((t) => new Date(t.date) >= startDate);
    }

    return filtered;
  }, [transactions, accountId, timeRange]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const income = accountTransactions
      .filter((t) => t.type === 'income' || (t.type === 'transfer' && t.account_id === accountId))
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = accountTransactions
      .filter((t) => t.type === 'expense' || (t.type === 'transfer' && t.transfer_account_id === accountId))
      .reduce((sum, t) => sum + t.amount, 0);

    const netChange = income - expenses;

    return {
      income,
      expenses,
      netChange,
      transactionCount: accountTransactions.length,
      avgTransaction: accountTransactions.length > 0
        ? Math.round((income + expenses) / accountTransactions.length)
        : 0,
    };
  }, [accountTransactions, accountId]);

  // Sort transactions by date (newest first)
  const sortedTransactions = useMemo(() => {
    return [...accountTransactions].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [accountTransactions]);

  if (!user) return null;

  if (!account) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Account not found</p>
            <Button onClick={() => router.push('/dashboard/accounts')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isCreditCard = account.type === 'credit_card' || account.type === 'store_card';
  const isLoan = account.type === 'loan';
  const isDebt = isCreditCard || isLoan;

  const creditUtilization = isCreditCard && account.credit_limit
    ? calculatePercentage(account.current_balance, account.credit_limit)
    : 0;

  const availableCredit = isCreditCard && account.credit_limit
    ? account.credit_limit - account.current_balance
    : 0;

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/accounts')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="text-3xl w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: account.color + '20' }}
            >
              {account.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                {account.name}
                {account.is_primary && (
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                )}
              </h1>
              <p className="text-muted-foreground capitalize">
                {account.type.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/transactions?account=${accountId}`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Button>
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit Account
          </Button>
        </div>
      </div>

      {/* Account Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Current Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {isCreditCard ? 'Current Balance' : isLoan ? 'Outstanding' : 'Current Balance'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isDebt ? 'text-red-600' : ''}`}>
              {formatZAR(account.current_balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Initial: {formatZAR(account.initial_balance)}
            </p>
          </CardContent>
        </Card>

        {/* Income/Inflow */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {timeRange === 'all' ? 'Total Inflow' : 'Period Inflow'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatZAR(statistics.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountTransactions.filter(t => t.type === 'income' || (t.type === 'transfer' && t.account_id === accountId)).length} transactions
            </p>
          </CardContent>
        </Card>

        {/* Expenses/Outflow */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {timeRange === 'all' ? 'Total Outflow' : 'Period Outflow'}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatZAR(statistics.expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountTransactions.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.transfer_account_id === accountId)).length} transactions
            </p>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.transactionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {formatZAR(statistics.avgTransaction)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account-Specific Details */}
      {(isCreditCard || isLoan) && (
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              {isCreditCard ? 'Credit card information and limits' : 'Loan details and repayment info'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Credit Card Details */}
              {isCreditCard && account.credit_limit && (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Credit Limit</span>
                      <span className="font-medium">{formatZAR(account.credit_limit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Available Credit</span>
                      <span className="font-medium text-green-600">{formatZAR(availableCredit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Credit Utilization</span>
                      <span className={`font-medium ${creditUtilization > 70 ? 'text-red-600' : ''}`}>
                        {creditUtilization}%
                      </span>
                    </div>
                    {/* Utilization Progress Bar */}
                    <div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
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
                  </div>
                  <div className="space-y-4">
                    {account.statement_day && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Statement Day</span>
                        <span className="font-medium">Day {account.statement_day}</span>
                      </div>
                    )}
                    {account.payment_due_day && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Payment Due Day</span>
                        <span className="font-medium">Day {account.payment_due_day}</span>
                      </div>
                    )}
                    {account.interest_rate && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Interest Rate</span>
                        <span className="font-medium">{account.interest_rate}% p.a.</span>
                      </div>
                    )}
                    {account.minimum_payment_percentage && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Minimum Payment</span>
                        <span className="font-medium">{account.minimum_payment_percentage}%</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Loan Details */}
              {isLoan && (
                <>
                  <div className="space-y-4">
                    {account.loan_principal && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Original Amount</span>
                        <span className="font-medium">{formatZAR(account.loan_principal)}</span>
                      </div>
                    )}
                    {account.current_balance && account.loan_principal && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Amount Paid</span>
                        <span className="font-medium text-green-600">
                          {formatZAR(account.loan_principal - account.current_balance)}
                        </span>
                      </div>
                    )}
                    {account.loan_principal && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {calculatePercentage(
                            account.loan_principal - account.current_balance,
                            account.loan_principal
                          )}% paid
                        </span>
                      </div>
                    )}
                    {/* Loan Progress Bar */}
                    {account.loan_principal && (
                      <div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
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
                  <div className="space-y-4">
                    {account.monthly_instalment && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Monthly Payment</span>
                        <span className="font-medium">{formatZAR(account.monthly_instalment)}</span>
                      </div>
                    )}
                    {account.loan_interest_rate && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Interest Rate</span>
                        <span className="font-medium">{account.loan_interest_rate}% p.a.</span>
                      </div>
                    )}
                    {account.loan_term_months && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Loan Term</span>
                        <span className="font-medium">{account.loan_term_months} months</span>
                      </div>
                    )}
                    {account.loan_start_date && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Start Date</span>
                        <span className="font-medium">
                          {format(new Date(account.loan_start_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Recent activity for this account</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
              >
                <option value="1m">Last Month</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="all">All Time</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length > 0 ? (
            <div className="space-y-2">
              {sortedTransactions.map((transaction) => {
                const category = categories.find((c) => c.id === transaction.category_id);
                const isTransferOut = transaction.type === 'transfer' && transaction.account_id === accountId;
                const isTransferIn = transaction.type === 'transfer' && transaction.transfer_account_id === accountId;

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{category?.emoji || '💰'}</div>
                      <div>
                        <p className="font-medium">{transaction.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(transaction.date), 'dd MMM yyyy')}
                          {transaction.notes && ` • ${transaction.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.type === 'income' || isTransferIn
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {transaction.type === 'income' || isTransferIn ? '+' : '-'}
                        {formatZAR(transaction.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {transaction.type === 'transfer'
                          ? (isTransferOut ? 'Transfer Out' : 'Transfer In')
                          : transaction.type
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No transactions found for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
