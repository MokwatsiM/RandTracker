'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, PiggyBank, Wallet, TrendingDown } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';
import { AccountDialog } from '@/components/accounts/AccountDialog';
import { AccountCard } from '@/components/accounts/AccountCard';
import { formatZAR } from '@/lib/currency';
import type { Account } from '@/lib/db/schema';

export default function AccountsPage() {
  const user = useUserStore(state => state.user);
  const { accounts, loadAccounts, deleteAccount, setPrimaryAccount, getTotalBalance } = useAccountStore();
  const { initializeDefaultCategories } = useCategoryStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>();

  useEffect(() => {
    if (user) {
      loadAccounts(user.id);
      initializeDefaultCategories(user.id);
    }
  }, [user, loadAccounts, initializeDefaultCategories]);

  if (!user) {
    return null;
  }

  const handleAddAccount = () => {
    setSelectedAccount(undefined);
    setDialogOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const handleDeleteAccount = async (account: Account) => {
    if (confirm(`Are you sure you want to delete "${account.name}"?`)) {
      await deleteAccount(account.id);
    }
  };

  const handleSetPrimary = async (account: Account) => {
    await setPrimaryAccount(account.id);
  };

  // Group accounts by type
  const bankAccounts = accounts.filter(
    acc => acc.type === 'cheque' || acc.type === 'savings' || acc.type === 'cash'
  );
  const creditCards = accounts.filter(
    acc => acc.type === 'credit_card' || acc.type === 'store_card'
  );
  const loans = accounts.filter(acc => acc.type === 'loan');
  const investments = accounts.filter(acc => acc.type === 'investment');

  const totalBalance = getTotalBalance();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts, cash, and cards</p>
        </div>
        <Button onClick={handleAddAccount}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Total Balance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth</CardTitle>
          <CardDescription>Total assets minus liabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold ${totalBalance < 0 ? 'text-red-600' : ''}`}>
            {formatZAR(totalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {accounts.length} active {accounts.length === 1 ? 'account' : 'accounts'}
          </p>
        </CardContent>
      </Card>

      {/* Account Groups */}
      <div className="space-y-6">
        {/* Cash & Bank Accounts */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Cash & Bank Accounts
          </h2>
          {bankAccounts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bankAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleEditAccount}
                  onDelete={handleDeleteAccount}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No accounts yet</p>
              <p className="text-sm">Add your first bank account or cash wallet</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddAccount}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          )}
        </div>

        {/* Credit Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Cards & Store Cards
          </h2>
          {creditCards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {creditCards.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleEditAccount}
                  onDelete={handleDeleteAccount}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No credit cards yet</p>
              <p className="text-sm">Track your credit card balances and utilisation</p>
            </div>
          )}
        </div>

        {/* Loans */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Loans & Debts
          </h2>
          {loans.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loans.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleEditAccount}
                  onDelete={handleDeleteAccount}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No loans yet</p>
              <p className="text-sm">Manage your loans and track payoff progress</p>
            </div>
          )}
        </div>

        {/* Savings & Investments */}
        {investments.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Savings & Investments
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {investments.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleEditAccount}
                  onDelete={handleDeleteAccount}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Account Dialog */}
      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={selectedAccount}
      />
    </div>
  );
}
