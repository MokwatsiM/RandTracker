'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useInvestmentStore, type Investment, type InvestmentTransaction } from '@/stores/investmentStore';
import { useUserStore } from '@/stores/userStore';

interface InvestmentTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment;
  transaction?: InvestmentTransaction;
}

const TRANSACTION_TYPES: { value: InvestmentTransaction['type']; label: string; description: string }[] = [
  { value: 'contribution', label: 'Contribution', description: 'Add money to investment' },
  { value: 'withdrawal', label: 'Withdrawal', description: 'Take money out' },
  { value: 'dividend', label: 'Dividend', description: 'Dividend payment received' },
  { value: 'interest', label: 'Interest', description: 'Interest payment' },
  { value: 'fee', label: 'Fee', description: 'Management or admin fee' },
  { value: 'rebalance', label: 'Rebalance', description: 'Portfolio rebalancing' },
  { value: 'transfer_in', label: 'Transfer In', description: 'Transfer from another investment' },
  { value: 'transfer_out', label: 'Transfer Out', description: 'Transfer to another investment' },
];

const getInitialFormData = (transaction?: InvestmentTransaction) => ({
  type: transaction?.type || 'contribution' as InvestmentTransaction['type'],
  amount: transaction?.amount ? (transaction.amount / 100).toString() : '',
  units: transaction?.units?.toString() || '',
  price_per_unit: transaction?.price_per_unit ? (transaction.price_per_unit / 100).toString() : '',
  date: transaction?.date || new Date().toISOString().split('T')[0],
  description: transaction?.description || '',
});

export function InvestmentTransactionDialog({
  open,
  onOpenChange,
  investment,
  transaction,
}: InvestmentTransactionDialogProps) {
  const user = useUserStore(state => state.user);
  const { createInvestmentTransaction, updateInvestmentTransaction } = useInvestmentStore();

  const [formData, setFormData] = useState(getInitialFormData(transaction));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate amount from units and price
  useEffect(() => {
    if (formData.units && formData.price_per_unit) {
      const units = parseFloat(formData.units);
      const pricePerUnit = parseFloat(formData.price_per_unit);
      if (!isNaN(units) && !isNaN(pricePerUnit)) {
        const calculatedAmount = (units * pricePerUnit).toFixed(2);
        setFormData(prev => ({ ...prev, amount: calculatedAmount }));
      }
    }
  }, [formData.units, formData.price_per_unit]);

  // Reset form data when transaction prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(transaction));
  }, [transaction, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const amountInCents = Math.round(parseFloat(formData.amount || '0') * 100);

      const transactionData: Partial<InvestmentTransaction> = {
        user_id: user.id,
        investment_id: investment.id,
        type: formData.type,
        amount: amountInCents,
        units: formData.units ? parseFloat(formData.units) : undefined,
        price_per_unit: formData.price_per_unit ? Math.round(parseFloat(formData.price_per_unit) * 100) : undefined,
        date: formData.date,
        description: formData.description || undefined,
      };

      if (transaction) {
        await updateInvestmentTransaction(transaction.id, transactionData);
      } else {
        await createInvestmentTransaction(transactionData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save investment transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTransactionType = TRANSACTION_TYPES.find(t => t.value === formData.type);
  const showUnitsFields = investment.type === 'stock' || investment.type === 'etf' || investment.type === 'unit_trust';

  // Check TFSA limits for contributions
  const isContribution = formData.type === 'contribution';
  const contributionAmount = isContribution ? parseFloat(formData.amount || '0') : 0;
  const tfsaYearRemaining = investment.is_tfsa && investment.tfsa_annual_limit
    ? (investment.tfsa_annual_limit - (investment.tfsa_current_year_contribution || 0)) / 100
    : 0;
  const tfsaLifetimeRemaining = investment.is_tfsa && investment.tfsa_lifetime_limit
    ? (investment.tfsa_lifetime_limit - (investment.tfsa_lifetime_contribution || 0)) / 100
    : 0;
  const exceedsTfsaYearLimit = investment.is_tfsa && isContribution && contributionAmount > tfsaYearRemaining;
  const exceedsTfsaLifetimeLimit = investment.is_tfsa && isContribution && contributionAmount > tfsaLifetimeRemaining;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {investment.icon} {investment.name}
            {transaction ? ' - Update transaction details' : ' - Record a new transaction'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div>
            <Label htmlFor="type">Transaction Type *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as InvestmentTransaction['type'] })}
              required
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            {selectedTransactionType && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTransactionType.description}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Units and Price (for stocks/ETFs) */}
          {showUnitsFields && (
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium">Units Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="units">Units</Label>
                  <Input
                    id="units"
                    type="number"
                    step="0.0001"
                    value={formData.units}
                    onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="price_per_unit">Price per Unit (R)</Label>
                  <Input
                    id="price_per_unit"
                    type="number"
                    step="0.01"
                    value={formData.price_per_unit}
                    onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {formData.units && formData.price_per_unit && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated amount: R{formData.amount}
                </p>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (R) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              required
              disabled={showUnitsFields && !!(formData.units && formData.price_per_unit)}
            />
          </div>

          {/* TFSA Limit Warnings */}
          {investment.is_tfsa && isContribution && contributionAmount > 0 && (
            <div className="space-y-2">
              {exceedsTfsaYearLimit && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
                  <span className="text-orange-600 text-sm">
                    ⚠️ Warning: This contribution exceeds your annual TFSA limit by R
                    {(contributionAmount - tfsaYearRemaining).toFixed(2)}
                  </span>
                </div>
              )}
              {exceedsTfsaLifetimeLimit && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                  <span className="text-red-600 text-sm">
                    ⚠️ Warning: This contribution exceeds your lifetime TFSA limit by R
                    {(contributionAmount - tfsaLifetimeRemaining).toFixed(2)}
                  </span>
                </div>
              )}
              {!exceedsTfsaYearLimit && !exceedsTfsaLifetimeLimit && (
                <div className="text-sm text-muted-foreground">
                  <p>TFSA Year Remaining: R{tfsaYearRemaining.toFixed(2)}</p>
                  <p>TFSA Lifetime Remaining: R{tfsaLifetimeRemaining.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this transaction..."
              className="w-full px-3 py-2 border rounded-md min-h-[80px] bg-background"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : transaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
