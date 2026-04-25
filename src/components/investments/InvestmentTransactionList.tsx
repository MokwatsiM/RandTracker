'use client';

import { useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Percent, Settings, ArrowRightLeft, Edit, Trash2 } from 'lucide-react';
import { formatZAR } from '@/lib/currency';
import { useInvestmentStore, type Investment, type InvestmentTransaction } from '@/stores/investmentStore';
import { format } from 'date-fns';

interface InvestmentTransactionListProps {
  investment: Investment;
  onEditTransaction: (transaction: InvestmentTransaction) => void;
  onDeleteTransaction: (transaction: InvestmentTransaction) => void;
}

const TRANSACTION_ICONS: Record<InvestmentTransaction['type'], { icon: any; color: string }> = {
  contribution: { icon: ArrowUpCircle, color: 'text-green-600' },
  withdrawal: { icon: ArrowDownCircle, color: 'text-red-600' },
  dividend: { icon: DollarSign, color: 'text-blue-600' },
  interest: { icon: Percent, color: 'text-purple-600' },
  fee: { icon: Settings, color: 'text-orange-600' },
  rebalance: { icon: ArrowRightLeft, color: 'text-gray-600' },
  transfer_in: { icon: ArrowUpCircle, color: 'text-cyan-600' },
  transfer_out: { icon: ArrowDownCircle, color: 'text-pink-600' },
};

export function InvestmentTransactionList({
  investment,
  onEditTransaction,
  onDeleteTransaction,
}: InvestmentTransactionListProps) {
  const { investmentTransactions, loadInvestmentTransactions } = useInvestmentStore();

  useEffect(() => {
    loadInvestmentTransactions(investment.id);
  }, [investment.id, loadInvestmentTransactions]);

  if (investmentTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No transactions yet</p>
        <p className="text-sm mt-2">Add your first transaction to start tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {investmentTransactions.map((transaction) => {
        const { icon: Icon, color } = TRANSACTION_ICONS[transaction.type];
        const isPositive = transaction.type === 'contribution' || transaction.type === 'dividend' ||
          transaction.type === 'interest' || transaction.type === 'transfer_in';

        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`${color}`}>
                <Icon className="h-5 w-5" />
              </div>

              <div>
                <p className="font-medium capitalize">
                  {transaction.type.replace('_', ' ')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(transaction.date), 'MMM dd, yyyy')}
                </p>
                {transaction.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transaction.description}
                  </p>
                )}
                {transaction.units && transaction.price_per_unit && (
                  <p className="text-xs text-muted-foreground">
                    {transaction.units.toFixed(4)} units @ {formatZAR(transaction.price_per_unit)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : '-'}{formatZAR(Math.abs(transaction.amount))}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditTransaction(transaction)}
                  className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
                  title="Edit transaction"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDeleteTransaction(transaction)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded-md text-muted-foreground hover:text-red-600"
                  title="Delete transaction"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
