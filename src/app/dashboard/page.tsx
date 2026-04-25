'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingDown } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';
import { formatZAR, formatTransactionAmount } from '@/lib/currency';
import { format } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const user = useUserStore(state => state.user);
  const { accounts, loadAccounts, getTotalBalance } = useAccountStore();
  const { transactions, loadTransactions, getMonthlyIncome, getMonthlyExpenses } = useTransactionStore();
  const { categories, loadCategories } = useCategoryStore();

  useEffect(() => {
    if (user) {
      loadAccounts(user.id);
      loadTransactions(user.id);
      loadCategories(user.id);
    }
  }, [user, loadAccounts, loadTransactions, loadCategories]);

  if (!user) {
    return null;
  }

  const totalBalance = getTotalBalance();
  const monthlyIncome = getMonthlyIncome(new Date());
  const monthlyExpenses = getMonthlyExpenses(new Date());
  const recentTransactions = transactions.slice(0, 5);

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const totalDebt = accounts
    .filter(acc => acc.type === 'credit_card' || acc.type === 'loan' || acc.type === 'store_card')
    .reduce((sum, acc) => sum + acc.current_balance, 0);

  const activeDebts = accounts.filter(
    acc => (acc.type === 'credit_card' || acc.type === 'loan' || acc.type === 'store_card') && acc.current_balance > 0
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{user?.display_name ? `, ${user.display_name}` : ''}!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600' : ''}`}>
              {formatZAR(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income (Month)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatZAR(monthlyIncome)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses (Month)</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatZAR(monthlyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZAR(totalDebt)}</div>
            <p className="text-xs text-muted-foreground">
              {activeDebts} active {activeDebts === 1 ? 'debt' : 'debts'}
            </p>
          </CardContent>
        </Card>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Set up your accounts and start tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {accounts.length > 0 ? '✓' : '1'}
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Add your accounts</h4>
                <p className="text-sm text-muted-foreground">Set up your bank accounts, cash, and credit cards</p>
                {accounts.length === 0 && (
                  <Link href="/dashboard/accounts">
                    <Button variant="outline" size="sm" className="mt-2">Go to Accounts</Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">2</div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Record your first transaction</h4>
                <p className="text-sm text-muted-foreground">Track income and expenses in seconds</p>
                <p className="text-sm text-primary mt-2">Click the + button in the bottom right corner!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </div>
            <Link href="/dashboard/transactions">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => {
                const { text, className } = formatTransactionAmount(transaction.amount, transaction.type);
                return (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{transaction.title || getCategoryName(transaction.category_id)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{format(new Date(transaction.date), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{getAccountName(transaction.account_id)}</span>
                      </div>
                    </div>
                    <div className={`font-semibold ${className}`}>{text}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
