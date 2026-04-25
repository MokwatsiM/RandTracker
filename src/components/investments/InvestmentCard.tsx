'use client';

import { useState, useEffect } from 'react';
import { MoreVertical, Edit, Trash2, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatZAR, calculatePercentage } from '@/lib/currency';
import { useInvestmentStore, type Investment, type InvestmentPerformance } from '@/stores/investmentStore';

interface InvestmentCardProps {
  investment: Investment;
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
  onClick?: (investment: Investment) => void;
}

export function InvestmentCard({ investment, onEdit, onDelete, onClick }: InvestmentCardProps) {
  const { getInvestmentPerformance } = useInvestmentStore();
  const [performance, setPerformance] = useState<InvestmentPerformance | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

  useEffect(() => {
    const loadPerformance = async () => {
      setIsLoadingPerformance(true);
      try {
        const perf = await getInvestmentPerformance(investment.id);
        setPerformance(perf);
      } catch (error) {
        console.error('Failed to load investment performance:', error);
      } finally {
        setIsLoadingPerformance(false);
      }
    };

    loadPerformance();
  }, [investment.id, getInvestmentPerformance]);

  // Calculate gain/loss
  const totalGainLoss = performance?.total_gain_loss || (investment.current_value - investment.total_contributions);
  const gainLossPercentage = performance?.gain_loss_percentage ||
    (investment.total_contributions > 0
      ? ((investment.current_value - investment.total_contributions) / investment.total_contributions) * 100
      : 0);

  const isGain = totalGainLoss >= 0;

  // TFSA tracking
  const tfsaYearRemaining = investment.is_tfsa && investment.tfsa_annual_limit
    ? investment.tfsa_annual_limit - (investment.tfsa_current_year_contribution || 0)
    : 0;

  const tfsaLifetimeRemaining = investment.is_tfsa && investment.tfsa_lifetime_limit
    ? investment.tfsa_lifetime_limit - (investment.tfsa_lifetime_contribution || 0)
    : 0;

  const tfsaYearUtilization = investment.is_tfsa && investment.tfsa_annual_limit
    ? ((investment.tfsa_current_year_contribution || 0) / investment.tfsa_annual_limit) * 100
    : 0;

  // Fixed Deposit maturity
  const daysToMaturity = investment.is_fixed_deposit && investment.fixed_deposit_maturity_date
    ? Math.ceil((new Date(investment.fixed_deposit_maturity_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(investment)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <div
            className="text-2xl w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: investment.color + '20' }}
          >
            {investment.icon}
          </div>
          <div>
            <h3 className="font-semibold">{investment.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{investment.type.replace('_', ' ')}</span>
              {investment.provider && (
                <>
                  <span>•</span>
                  <span>{investment.provider}</span>
                </>
              )}
            </div>
            {investment.is_tfsa && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded">
                TFSA
              </span>
            )}
            {investment.is_fixed_deposit && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded ml-1">
                Fixed Deposit
              </span>
            )}
          </div>
        </div>

        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {/* Current Value */}
          <div>
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-2xl font-bold">
              {formatZAR(investment.current_value)}
            </p>
          </div>

          {/* Gain/Loss */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Gain/Loss</span>
            <div className="flex items-center gap-1">
              {isGain ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`font-medium ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                {formatZAR(Math.abs(totalGainLoss))} ({isGain ? '+' : '-'}{Math.abs(gainLossPercentage).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Contributions */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Contributed</span>
            <span className="font-medium">{formatZAR(investment.total_contributions)}</span>
          </div>

          {/* TFSA Limits */}
          {investment.is_tfsa && investment.tfsa_annual_limit && (
            <div className="space-y-2 pt-2 border-t">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">TFSA Year Limit</span>
                  <span className={tfsaYearUtilization > 90 ? 'text-orange-600' : ''}>
                    {formatZAR(tfsaYearRemaining)} remaining
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      tfsaYearUtilization > 90
                        ? 'bg-orange-500'
                        : tfsaYearUtilization > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(tfsaYearUtilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Lifetime Remaining</span>
                <span>{formatZAR(tfsaLifetimeRemaining)}</span>
              </div>
            </div>
          )}

          {/* Fixed Deposit Maturity */}
          {investment.is_fixed_deposit && daysToMaturity !== null && (
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Maturity</span>
              </div>
              <span className={daysToMaturity <= 30 ? 'text-orange-600 font-medium' : ''}>
                {daysToMaturity > 0
                  ? `${daysToMaturity} days`
                  : daysToMaturity === 0
                  ? 'Today'
                  : 'Matured'
                }
              </span>
            </div>
          )}

          {/* Interest Rate */}
          {investment.interest_rate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Interest Rate {investment.is_compound_interest && `(${investment.compound_frequency})`}
              </span>
              <span>{investment.interest_rate}% p.a.</span>
            </div>
          )}

          {/* Units (for stocks/ETFs) */}
          {investment.units_held && investment.current_price && (
            <div className="space-y-1 text-sm pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Units Held</span>
                <span>{investment.units_held.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Price</span>
                <span>{formatZAR(investment.current_price)}</span>
              </div>
              {investment.purchase_price && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Price</span>
                  <span>{formatZAR(investment.purchase_price)}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 mt-2 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(investment);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm hover:bg-accent rounded-md"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(investment);
              }}
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
