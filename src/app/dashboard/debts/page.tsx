'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingDown } from 'lucide-react';
import { useDebtStore } from '@/stores/debtStore';
import { useUserStore } from '@/stores/userStore';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { calculatePayoffPlan, compareStrategies } from '@/lib/calculations/snowball';
import { calculateDebtToIncomeRatio } from '@/lib/calculations/interest';
import { formatZAR } from '@/lib/currency';
import { DebtDialog } from '@/components/debts/DebtDialog';
import { DebtCard } from '@/components/debts/DebtCard';
import type { Debt } from '@/lib/db/schema';

export default function DebtsPage() {
  const user = useUserStore((state) => state.user);
  const { debts, loadDebts, deleteDebt } = useDebtStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { getMonthlyIncome, loadTransactions } = useTransactionStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | undefined>();
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche' | 'custom'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);
  const [selectedPlanDebtId, setSelectedPlanDebtId] = useState('');

  useEffect(() => {
    if (user) {
      loadDebts(user.id);
      loadAccounts(user.id);
      loadTransactions(user.id);
    }
  }, [loadAccounts, loadDebts, loadTransactions, user]);

  const activeDebts = useMemo(() => debts.filter((debt) => debt.is_active && debt.current_balance > 0), [debts]);

  const totals = useMemo(() => {
    const totalDebt = activeDebts.reduce((sum, debt) => sum + debt.current_balance, 0);
    const monthlyPayments = activeDebts.reduce((sum, debt) => sum + (debt.minimum_payment ?? 0), 0);
    const monthlyIncome = getMonthlyIncome(new Date());
    const debtToIncome = calculateDebtToIncomeRatio(monthlyPayments, monthlyIncome);
    return { totalDebt, monthlyPayments, monthlyIncome, debtToIncome };
  }, [activeDebts, getMonthlyIncome]);

  const strategyComparison = useMemo(() => {
    return compareStrategies(activeDebts, extraPayment);
  }, [activeDebts, extraPayment]);

  const selectedPlan = useMemo(() => {
    return calculatePayoffPlan(activeDebts, strategy, extraPayment);
  }, [activeDebts, extraPayment, strategy]);

  useEffect(() => {
    if (activeDebts.length === 0) {
      setSelectedPlanDebtId('');
      return;
    }

    if (!activeDebts.some((debt) => debt.id === selectedPlanDebtId)) {
      setSelectedPlanDebtId(activeDebts[0].id);
    }
  }, [activeDebts, selectedPlanDebtId]);

  const selectedDebtDetail = activeDebts.find((debt) => debt.id === selectedPlanDebtId);
  const selectedDebtSchedule = useMemo(() => {
    if (!selectedDebtDetail) {
      return [];
    }

    return selectedPlan.schedule
      .map((row) => {
        const allocation = row.allocations.find((item) => item.debt_id === selectedDebtDetail.id);

        if (!allocation || allocation.payment === 0) {
          return null;
        }

        return {
          month: row.month,
          payment: allocation.payment,
          principal: allocation.principal,
          interest: allocation.interest,
          balance: allocation.balance,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [selectedDebtDetail, selectedPlan.schedule]);

  const handleCreateDebt = () => {
    setSelectedDebt(undefined);
    setDialogOpen(true);
  };

  const handleEditDebt = (debt: Debt) => {
    setSelectedDebt(debt);
    setDialogOpen(true);
  };

  const handleDeleteDebt = async (debt: Debt) => {
    if (confirm(`Are you sure you want to delete "${debt.name}"?`)) {
      await deleteDebt(debt.id);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Debt Management</h1>
          <p className="text-muted-foreground">Track loans, credit cards, and plan your payoff strategy</p>
        </div>
        <Button onClick={handleCreateDebt}>
          <Plus className="mr-2 h-4 w-4" />
          Add Debt
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZAR(totals.totalDebt)}</div>
            <p className="text-xs text-muted-foreground">{activeDebts.length} active debts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZAR(totals.monthlyPayments)}</div>
            <p className="text-xs text-muted-foreground">Total per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debt-to-Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.debtToIncome}%</div>
            <p className="text-xs text-muted-foreground">Based on this month&apos;s income</p>
          </CardContent>
        </Card>
      </div>

      {activeDebts.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payoff Planner</CardTitle>
              <CardDescription>
                Adjust your strategy and extra monthly payment to see how fast you can become debt free.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as 'snowball' | 'avalanche' | 'custom')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="avalanche">Avalanche</option>
                  <option value="snowball">Snowball</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Extra Monthly Payment</label>
                <input
                  type="range"
                  min="0"
                  max="2000000"
                  step="1000"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <p className="text-sm font-semibold mt-2">{formatZAR(extraPayment)}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Schedule Debt</label>
                <select
                  value={selectedPlanDebtId}
                  onChange={(e) => setSelectedPlanDebtId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {activeDebts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Strategy Recommendation</CardTitle>
                <CardDescription>
                  Comparing avalanche and snowball using your current minimum payments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Recommended strategy: <span className="font-semibold capitalize">{strategyComparison.recommendation}</span>
                </p>
                <p>
                  Estimated interest saved with avalanche:{' '}
                  <span className="font-semibold">{formatZAR(Math.max(strategyComparison.interestDifference, 0))}</span>
                </p>
                <p>
                  Estimated months saved with avalanche:{' '}
                  <span className="font-semibold">{Math.max(strategyComparison.monthsDifference, 0)}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Debt Free Projection</CardTitle>
                <CardDescription>
                  Based on the selected strategy and extra payment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Total months: <span className="font-semibold">{selectedPlan.total_months}</span>
                </p>
                <p>
                  Total interest: <span className="font-semibold">{formatZAR(selectedPlan.total_interest)}</span>
                </p>
                <p>
                  Total paid: <span className="font-semibold">{formatZAR(selectedPlan.total_paid)}</span>
                </p>
                <p>
                  Debt-free by:{' '}
                  <span className="font-semibold">{selectedPlan.debt_free_date.toLocaleDateString()}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payoff Table</CardTitle>
              <CardDescription>
                Estimated payoff order and totals for the selected strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Debt</th>
                    <th className="py-2 pr-4">Starting Balance</th>
                    <th className="py-2 pr-4">Payoff Month</th>
                    <th className="py-2 pr-4">Payoff Date</th>
                    <th className="py-2 pr-4">Interest</th>
                    <th className="py-2">Total Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlan.debts.map((debtPlan) => (
                    <tr key={debtPlan.debt_id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{debtPlan.name}</td>
                      <td className="py-2 pr-4">{formatZAR(debtPlan.original_balance)}</td>
                      <td className="py-2 pr-4">{debtPlan.payoff_month}</td>
                      <td className="py-2 pr-4">{debtPlan.payoff_date.toLocaleDateString()}</td>
                      <td className="py-2 pr-4">{formatZAR(debtPlan.total_interest)}</td>
                      <td className="py-2">{formatZAR(debtPlan.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Payoff Timeline</CardTitle>
              <CardDescription>
                Monthly totals across all debts for the selected strategy.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Payment</th>
                    <th className="py-2 pr-4">Principal</th>
                    <th className="py-2 pr-4">Interest</th>
                    <th className="py-2 pr-4">Remaining Balance</th>
                    <th className="py-2">Active Debts</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlan.schedule.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.month}</td>
                      <td className="py-2 pr-4">{row.date.toLocaleDateString()}</td>
                      <td className="py-2 pr-4">{formatZAR(row.totalPayment)}</td>
                      <td className="py-2 pr-4">{formatZAR(row.totalPrincipal)}</td>
                      <td className="py-2 pr-4">{formatZAR(row.totalInterest)}</td>
                      <td className="py-2 pr-4">{formatZAR(row.remainingBalance)}</td>
                      <td className="py-2">{row.remainingDebts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {selectedDebtDetail && selectedDebtSchedule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedDebtDetail.name} Paydown Schedule</CardTitle>
                <CardDescription>
                  Month-by-month allocation for this debt within the selected strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">Payment</th>
                      <th className="py-2 pr-4">Principal</th>
                      <th className="py-2 pr-4">Interest</th>
                      <th className="py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDebtSchedule.map((row) => (
                      <tr key={row.month} className="border-b last:border-0">
                        <td className="py-2 pr-4">{row.month}</td>
                        <td className="py-2 pr-4">{formatZAR(row.payment)}</td>
                        <td className="py-2 pr-4">{formatZAR(row.principal)}</td>
                        <td className="py-2 pr-4">{formatZAR(row.interest)}</td>
                        <td className="py-2">{formatZAR(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {debts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Debt Dashboard</CardTitle>
            <CardDescription>
              Manage all your debts in one place with payoff planning tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">
                No debts tracked yet. Add your loans and credit cards to see payoff projections and strategy comparisons.
              </p>
              <Button onClick={handleCreateDebt}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Debt
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              account={accounts.find((account) => account.id === debt.account_id)}
              onEdit={handleEditDebt}
              onDelete={handleDeleteDebt}
            />
          ))}
        </div>
      )}

      <DebtDialog open={dialogOpen} onOpenChange={setDialogOpen} debt={selectedDebt} />
    </div>
  );
}
