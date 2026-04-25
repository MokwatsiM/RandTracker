'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/userStore';
import { useUserProfileStore } from '@/stores/userProfileStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useDebtStore } from '@/stores/debtStore';
import { useGoalStore } from '@/stores/goalStore';
import { CurrencyDialog } from '@/components/settings/CurrencyDialog';
import { PaydayDialog } from '@/components/settings/PaydayDialog';
import { ThemeDialog } from '@/components/settings/ThemeDialog';
import {
  exportTransactionsToCSV,
  exportAccountsToCSV,
  exportBudgetsToCSV,
  exportBackupJSON,
  exportComprehensiveCSV,
} from '@/lib/export';
import { Download, FileDown } from 'lucide-react';

export default function SettingsPage() {
  const { user: authUser, signOut } = useAuth();
  const localUser = useUserStore((state) => state.user);
  const authMode = useUserStore((state) => state.authMode);

  const { profile, loadProfile, updateCurrency, updatePaydayDate } = useUserProfileStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { categories, loadCategories } = useCategoryStore();
  const { budgets, loadBudgets } = useBudgetStore();
  const { debts, loadDebts } = useDebtStore();
  const { goals, loadGoals } = useGoalStore();

  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [paydayDialogOpen, setPaydayDialogOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('system');
  const [isExporting, setIsExporting] = useState(false);

  const isCloudSyncEnabled = authMode === 'authenticated' && !!authUser;

  useEffect(() => {
    if (localUser) {
      loadProfile(localUser.id);
      loadTransactions(localUser.id);
      loadAccounts(localUser.id);
      loadCategories(localUser.id);
      loadBudgets(localUser.id);
      loadDebts(localUser.id);
      loadGoals(localUser.id);
    }
  }, [localUser]);

  useEffect(() => {
    // Load current theme
    const stored = localStorage.getItem('theme') || 'system';
    setCurrentTheme(stored);
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUpdateCurrency = async (currency: string) => {
    if (localUser) {
      await updateCurrency(localUser.id, currency);
    }
  };

  const handleUpdatePayday = async (paydayDate: number) => {
    if (localUser) {
      await updatePaydayDate(localUser.id, paydayDate);
    }
  };

  const handleExportTransactions = () => {
    setIsExporting(true);
    try {
      exportTransactionsToCSV(transactions, accounts, categories);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAccounts = () => {
    setIsExporting(true);
    try {
      exportAccountsToCSV(accounts);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBudgets = () => {
    setIsExporting(true);
    try {
      exportBudgetsToCSV(budgets, categories);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportComprehensive = () => {
    setIsExporting(true);
    try {
      exportComprehensiveCSV(transactions, accounts, categories);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackup = () => {
    setIsExporting(true);
    try {
      exportBackupJSON({
        transactions,
        accounts,
        categories,
        budgets,
        debts,
        goals,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getThemeLabel = () => {
    switch (currentTheme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      default:
        return 'System default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and app configuration</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic app preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">
                {profile?.currency || 'ZAR'} (
                {profile?.currency === 'ZAR'
                  ? 'South African Rand'
                  : profile?.currency === 'USD'
                  ? 'US Dollar'
                  : profile?.currency || 'South African Rand'}
                )
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrencyDialogOpen(true)}>
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Payday Date</p>
              <p className="text-sm text-muted-foreground">
                {profile?.payday_date
                  ? `${profile.payday_date}${
                      profile.payday_date === 1
                        ? 'st'
                        : profile.payday_date === 2
                        ? 'nd'
                        : profile.payday_date === 3
                        ? 'rd'
                        : 'th'
                    } of each month`
                  : 'Not set'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPaydayDialogOpen(true)}>
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">{getThemeLabel()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setThemeDialogOpen(true)}>
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export and backup your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Transactions</p>
              <p className="text-sm text-muted-foreground">
                Download all transactions as CSV ({transactions.length} transactions)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTransactions}
              disabled={isExporting || transactions.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Accounts</p>
              <p className="text-sm text-muted-foreground">
                Download all accounts as CSV ({accounts.length} accounts)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAccounts}
              disabled={isExporting || accounts.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Budgets</p>
              <p className="text-sm text-muted-foreground">
                Download all budgets as CSV ({budgets.length} budgets)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBudgets}
              disabled={isExporting || budgets.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Comprehensive Report</p>
              <p className="text-sm text-muted-foreground">
                Download detailed financial report as CSV
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportComprehensive}
              disabled={isExporting || transactions.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Complete Backup</p>
                <p className="text-sm text-muted-foreground">
                  Download all your data as JSON backup file
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackup}
                disabled={isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Backup
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Cloud Sync</p>
              <p className="text-sm text-muted-foreground">
                {isCloudSyncEnabled
                  ? 'Supabase is your primary data store'
                  : 'Sign in to enable Supabase storage'}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              {isCloudSyncEnabled ? 'Connected' : 'Required'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account & Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Account & Sync</CardTitle>
          <CardDescription>Your account data is stored in Supabase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {isCloudSyncEnabled ? 'Cloud sync connected' : 'Guest mode'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCloudSyncEnabled
                  ? `Signed in as ${authUser.email ?? localUser?.display_name ?? 'your account'}`
                  : 'Sign in to access your Supabase-backed data.'}
              </p>
            </div>

            {isCloudSyncEnabled ? (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            )}
          </div>

          {!isCloudSyncEnabled && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Sign in required</p>
                <p className="text-sm text-muted-foreground">
                  Local guest storage has been removed, so you'll need an account to use the app.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/auth/signup">Sign up</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">RandTracker v0.1.0</p>
          <p className="text-sm text-muted-foreground mt-2">
            A South African budget and debt management app
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CurrencyDialog
        open={currencyDialogOpen}
        onOpenChange={setCurrencyDialogOpen}
        currentCurrency={profile?.currency || 'ZAR'}
        onSave={handleUpdateCurrency}
      />

      <PaydayDialog
        open={paydayDialogOpen}
        onOpenChange={setPaydayDialogOpen}
        currentPayday={profile?.payday_date}
        onSave={handleUpdatePayday}
      />

      <ThemeDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
    </div>
  );
}
