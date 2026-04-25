'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, PiggyBank, Building2, Landmark } from 'lucide-react';
import { useInvestmentStore, type Investment, type InvestmentTransaction } from '@/stores/investmentStore';
import { useUserStore } from '@/stores/userStore';
import { InvestmentDialog } from '@/components/investments/InvestmentDialog';
import { InvestmentCard } from '@/components/investments/InvestmentCard';
import { InvestmentTransactionDialog } from '@/components/investments/InvestmentTransactionDialog';
import { InvestmentTransactionList } from '@/components/investments/InvestmentTransactionList';
import { formatZAR } from '@/lib/currency';

export default function InvestmentsPage() {
  const user = useUserStore(state => state.user);
  const {
    investments,
    loadInvestments,
    deleteInvestment,
    deleteInvestmentTransaction,
    getTotalPortfolioValue,
    getTotalPortfolioGains,
  } = useInvestmentStore();

  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | undefined>();

  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<InvestmentTransaction | undefined>();
  const [transactionInvestment, setTransactionInvestment] = useState<Investment | undefined>();

  const [viewingInvestment, setViewingInvestment] = useState<Investment | null>(null);

  useEffect(() => {
    if (user) {
      loadInvestments(user.id);
    }
  }, [user, loadInvestments]);

  if (!user) {
    return null;
  }

  const handleAddInvestment = () => {
    setSelectedInvestment(undefined);
    setInvestmentDialogOpen(true);
  };

  const handleEditInvestment = (investment: Investment) => {
    setSelectedInvestment(investment);
    setInvestmentDialogOpen(true);
  };

  const handleDeleteInvestment = async (investment: Investment) => {
    if (confirm(`Are you sure you want to delete "${investment.name}"?`)) {
      await deleteInvestment(investment.id);
      if (viewingInvestment?.id === investment.id) {
        setViewingInvestment(null);
      }
    }
  };

  const handleViewInvestment = (investment: Investment) => {
    setViewingInvestment(investment);
  };

  const handleAddTransaction = (investment: Investment) => {
    setTransactionInvestment(investment);
    setSelectedTransaction(undefined);
    setTransactionDialogOpen(true);
  };

  const handleEditTransaction = (transaction: InvestmentTransaction) => {
    const investment = investments.find(inv => inv.id === transaction.investment_id);
    if (investment) {
      setTransactionInvestment(investment);
      setSelectedTransaction(transaction);
      setTransactionDialogOpen(true);
    }
  };

  const handleDeleteTransaction = async (transaction: InvestmentTransaction) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await deleteInvestmentTransaction(transaction.id);
    }
  };

  // Group investments by type
  const tfsaInvestments = investments.filter(inv => inv.is_tfsa);
  const fixedDeposits = investments.filter(inv => inv.is_fixed_deposit && !inv.is_tfsa);
  const stocksAndEtfs = investments.filter(
    inv => !inv.is_tfsa && !inv.is_fixed_deposit && (inv.type === 'stock' || inv.type === 'etf' || inv.type === 'unit_trust')
  );
  const otherInvestments = investments.filter(
    inv => !inv.is_tfsa && !inv.is_fixed_deposit && inv.type !== 'stock' && inv.type !== 'etf' && inv.type !== 'unit_trust'
  );

  const totalPortfolioValue = getTotalPortfolioValue();
  const totalPortfolioGains = getTotalPortfolioGains();
  const totalPortfolioGainsPercentage = totalPortfolioValue > 0
    ? (totalPortfolioGains / (totalPortfolioValue - totalPortfolioGains)) * 100
    : 0;

  // If viewing a specific investment, show transaction view
  if (viewingInvestment) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setViewingInvestment(null)}
            >
              ← Back to Investments
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{viewingInvestment.icon}</span>
                <h1 className="text-3xl font-bold">{viewingInvestment.name}</h1>
              </div>
              <p className="text-muted-foreground capitalize">
                {viewingInvestment.type.replace('_', ' ')}
                {viewingInvestment.provider && ` • ${viewingInvestment.provider}`}
              </p>
            </div>
          </div>
          <Button onClick={() => handleAddTransaction(viewingInvestment)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>

        {/* Investment Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Current Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatZAR(viewingInvestment.current_value)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Contributed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatZAR(viewingInvestment.total_contributions)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Gain/Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                viewingInvestment.current_value - viewingInvestment.total_contributions >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatZAR(viewingInvestment.current_value - viewingInvestment.total_contributions)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All transactions for this investment</CardDescription>
          </CardHeader>
          <CardContent>
            <InvestmentTransactionList
              investment={viewingInvestment}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          </CardContent>
        </Card>

        {/* Transaction Dialog */}
        {transactionInvestment && (
          <InvestmentTransactionDialog
            open={transactionDialogOpen}
            onOpenChange={setTransactionDialogOpen}
            investment={transactionInvestment}
            transaction={selectedTransaction}
          />
        )}
      </div>
    );
  }

  // Main investments overview
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Investments</h1>
          <p className="text-muted-foreground">Track your TFSA, stocks, ETFs, and other investments</p>
        </div>
        <Button onClick={handleAddInvestment}>
          <Plus className="mr-2 h-4 w-4" />
          Add Investment
        </Button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatZAR(totalPortfolioValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {investments.length} active {investments.length === 1 ? 'investment' : 'investments'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gains/Losses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalPortfolioGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPortfolioGains >= 0 ? '+' : ''}{formatZAR(totalPortfolioGains)}
            </div>
            <p className={`text-xs mt-1 ${totalPortfolioGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPortfolioGains >= 0 ? '+' : ''}{totalPortfolioGainsPercentage.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">TFSA Investments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tfsaInvestments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatZAR(tfsaInvestments.reduce((sum, inv) => sum + inv.current_value, 0))} total value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Groups */}
      <div className="space-y-6">
        {/* TFSA Investments */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-green-600" />
            TFSA Investments
          </h2>
          {tfsaInvestments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tfsaInvestments.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  onEdit={handleEditInvestment}
                  onDelete={handleDeleteInvestment}
                  onClick={handleViewInvestment}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No TFSA investments yet</p>
              <p className="text-sm">Track your tax-free savings and monitor contribution limits</p>
            </div>
          )}
        </div>

        {/* Fixed Deposits */}
        {fixedDeposits.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-600" />
              Fixed Deposits
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {fixedDeposits.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  onEdit={handleEditInvestment}
                  onDelete={handleDeleteInvestment}
                  onClick={handleViewInvestment}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stocks & ETFs */}
        {stocksAndEtfs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Stocks, ETFs & Unit Trusts
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stocksAndEtfs.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  onEdit={handleEditInvestment}
                  onDelete={handleDeleteInvestment}
                  onClick={handleViewInvestment}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Investments */}
        {otherInvestments.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Other Investments
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherInvestments.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  onEdit={handleEditInvestment}
                  onDelete={handleDeleteInvestment}
                  onClick={handleViewInvestment}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {investments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No investments yet</h3>
            <p className="text-sm mb-6">Start tracking your investments and build your portfolio</p>
            <Button onClick={handleAddInvestment}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Investment
            </Button>
          </div>
        )}
      </div>

      {/* Investment Dialog */}
      <InvestmentDialog
        open={investmentDialogOpen}
        onOpenChange={setInvestmentDialogOpen}
        investment={selectedInvestment}
      />
    </div>
  );
}
