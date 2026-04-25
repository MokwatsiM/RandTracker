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
import { Checkbox } from '@/components/ui/checkbox';
import { useInvestmentStore, type Investment } from '@/stores/investmentStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUserStore } from '@/stores/userStore';

interface InvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: Investment;
}

const INVESTMENT_TYPES: { value: Investment['type']; label: string }[] = [
  { value: 'tfsa', label: 'TFSA (Tax-Free Savings)' },
  { value: 'unit_trust', label: 'Unit Trust' },
  { value: 'etf', label: 'ETF (Exchange Traded Fund)' },
  { value: 'stock', label: 'Stock/Share' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'savings_account', label: 'Savings Account' },
  { value: 'retirement_annuity', label: 'Retirement Annuity' },
  { value: 'other', label: 'Other Investment' },
];

const COMPOUND_FREQUENCIES: { value: Investment['compound_frequency']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const INVESTMENT_ICONS = ['📈', '💰', '💎', '🏦', '📊', '💵', '🎯', '💳', '🏠'];
const INVESTMENT_COLORS = [
  '#10b981', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#ef4444', // Red
];

const getInitialFormData = (investment?: Investment) => ({
  name: investment?.name || '',
  type: investment?.type || 'tfsa' as Investment['type'],
  provider: investment?.provider || '',
  linked_account_id: investment?.linked_account_id || '',

  // Financial
  initial_amount: investment?.initial_amount ? (investment.initial_amount / 100).toString() : '0',
  current_value: investment?.current_value ? (investment.current_value / 100).toString() : '0',

  // Interest/Returns
  interest_rate: investment?.interest_rate?.toString() || '',
  is_compound_interest: investment?.is_compound_interest || false,
  compound_frequency: investment?.compound_frequency || 'monthly' as Investment['compound_frequency'],

  // TFSA
  is_tfsa: investment?.is_tfsa || false,
  tfsa_annual_limit: investment?.tfsa_annual_limit ? (investment.tfsa_annual_limit / 100).toString() : '36000',
  tfsa_year_start_date: investment?.tfsa_year_start_date || new Date().getFullYear() + '-03-01',
  tfsa_year_end_date: investment?.tfsa_year_end_date || (new Date().getFullYear() + 1) + '-02-28',
  tfsa_lifetime_limit: investment?.tfsa_lifetime_limit ? (investment.tfsa_lifetime_limit / 100).toString() : '500000',

  // Fixed Deposit
  is_fixed_deposit: investment?.is_fixed_deposit || false,
  fixed_deposit_term_months: investment?.fixed_deposit_term_months?.toString() || '',
  fixed_deposit_start_date: investment?.fixed_deposit_start_date || new Date().toISOString().split('T')[0],
  fixed_deposit_auto_renew: investment?.fixed_deposit_auto_renew || false,

  // Performance
  purchase_price: investment?.purchase_price ? (investment.purchase_price / 100).toString() : '',
  current_price: investment?.current_price ? (investment.current_price / 100).toString() : '',
  units_held: investment?.units_held?.toString() || '',

  // Metadata
  icon: investment?.icon || '📈',
  color: investment?.color || '#10b981',
  notes: investment?.notes || '',
});

export function InvestmentDialog({ open, onOpenChange, investment }: InvestmentDialogProps) {
  const user = useUserStore(state => state.user);
  const { createInvestment, updateInvestment } = useInvestmentStore();
  const { accounts } = useAccountStore();

  const [formData, setFormData] = useState(getInitialFormData(investment));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate fixed deposit maturity date
  useEffect(() => {
    if (formData.is_fixed_deposit && formData.fixed_deposit_term_months && formData.fixed_deposit_start_date) {
      const startDate = new Date(formData.fixed_deposit_start_date);
      const termMonths = parseInt(formData.fixed_deposit_term_months);
      const maturityDate = new Date(startDate);
      maturityDate.setMonth(maturityDate.getMonth() + termMonths);

      // Don't update if it would create an infinite loop
      const calculatedDate = maturityDate.toISOString().split('T')[0];
      if (calculatedDate !== formData.fixed_deposit_start_date) {
        setFormData(prev => ({
          ...prev,
          fixed_deposit_maturity_date: calculatedDate
        }));
      }
    }
  }, [formData.is_fixed_deposit, formData.fixed_deposit_term_months, formData.fixed_deposit_start_date]);

  // Reset form data when investment prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(investment));
  }, [investment, open]);

  // Auto-check is_tfsa when type is tfsa
  useEffect(() => {
    if (formData.type === 'tfsa') {
      setFormData(prev => ({ ...prev, is_tfsa: true }));
    }
  }, [formData.type]);

  // Auto-check is_fixed_deposit when type is fixed_deposit
  useEffect(() => {
    if (formData.type === 'fixed_deposit') {
      setFormData(prev => ({ ...prev, is_fixed_deposit: true }));
    }
  }, [formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const initialAmountInCents = Math.round(parseFloat(formData.initial_amount || '0') * 100);
      const currentValueInCents = Math.round(parseFloat(formData.current_value || '0') * 100);

      const baseData = {
        user_id: user.id,
        name: formData.name,
        type: formData.type,
        provider: formData.provider || undefined,
        linked_account_id: formData.linked_account_id || undefined,

        // Financial
        initial_amount: initialAmountInCents,
        current_value: currentValueInCents,
        total_contributions: investment?.total_contributions || initialAmountInCents,
        total_withdrawals: investment?.total_withdrawals || 0,

        // Interest/Returns
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        is_compound_interest: formData.is_compound_interest,
        compound_frequency: formData.is_compound_interest ? formData.compound_frequency : undefined,

        // TFSA
        is_tfsa: formData.is_tfsa,
        tfsa_annual_limit: formData.is_tfsa ? Math.round(parseFloat(formData.tfsa_annual_limit || '36000') * 100) : undefined,
        tfsa_year_start_date: formData.is_tfsa ? formData.tfsa_year_start_date : undefined,
        tfsa_year_end_date: formData.is_tfsa ? formData.tfsa_year_end_date : undefined,
        tfsa_current_year_contribution: investment?.tfsa_current_year_contribution || 0,
        tfsa_lifetime_contribution: investment?.tfsa_lifetime_contribution || 0,
        tfsa_lifetime_limit: formData.is_tfsa ? Math.round(parseFloat(formData.tfsa_lifetime_limit || '500000') * 100) : undefined,

        // Fixed Deposit
        is_fixed_deposit: formData.is_fixed_deposit,
        fixed_deposit_term_months: formData.is_fixed_deposit ? parseInt(formData.fixed_deposit_term_months || '0') : undefined,
        fixed_deposit_start_date: formData.is_fixed_deposit ? formData.fixed_deposit_start_date : undefined,
        fixed_deposit_maturity_date: formData.is_fixed_deposit && formData.fixed_deposit_term_months ? (() => {
          const startDate = new Date(formData.fixed_deposit_start_date);
          const termMonths = parseInt(formData.fixed_deposit_term_months);
          const maturityDate = new Date(startDate);
          maturityDate.setMonth(maturityDate.getMonth() + termMonths);
          return maturityDate.toISOString().split('T')[0];
        })() : undefined,
        fixed_deposit_auto_renew: formData.is_fixed_deposit ? formData.fixed_deposit_auto_renew : undefined,

        // Performance
        purchase_price: formData.purchase_price ? Math.round(parseFloat(formData.purchase_price) * 100) : undefined,
        current_price: formData.current_price ? Math.round(parseFloat(formData.current_price) * 100) : undefined,
        units_held: formData.units_held ? parseFloat(formData.units_held) : undefined,

        // Metadata
        currency: 'ZAR',
        icon: formData.icon,
        color: formData.color,
        notes: formData.notes || undefined,
        is_active: true,
      };

      if (investment) {
        await updateInvestment(investment.id, baseData);
      } else {
        await createInvestment(baseData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save investment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter accounts to show only savings/investment accounts
  const savingsAccounts = accounts.filter(
    acc => acc.type === 'savings' || acc.type === 'investment'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{investment ? 'Edit Investment' : 'Add New Investment'}</DialogTitle>
          <DialogDescription>
            {investment ? 'Update your investment details' : 'Create a new investment to track your portfolio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Investment Name */}
          <div>
            <Label htmlFor="name">Investment Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Satrix MSCI World ETF"
              required
            />
          </div>

          {/* Investment Type */}
          <div>
            <Label htmlFor="type">Investment Type *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Investment['type'] })}
              required
            >
              {INVESTMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Provider */}
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              placeholder="e.g., Satrix, Allan Gray, FNB"
            />
          </div>

          {/* Linked Account */}
          {savingsAccounts.length > 0 && (
            <div>
              <Label htmlFor="linked_account_id">Linked Account (Optional)</Label>
              <Select
                id="linked_account_id"
                value={formData.linked_account_id}
                onChange={(e) => setFormData({ ...formData, linked_account_id: e.target.value })}
              >
                <option value="">No linked account</option>
                {savingsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Financial Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="initial_amount">Initial Amount (R) *</Label>
              <Input
                id="initial_amount"
                type="number"
                step="0.01"
                value={formData.initial_amount}
                onChange={(e) => setFormData({ ...formData, initial_amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="current_value">Current Value (R) *</Label>
              <Input
                id="current_value"
                type="number"
                step="0.01"
                value={formData.current_value}
                onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Interest Rate Configuration */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Interest/Returns</h3>

            <div>
              <Label htmlFor="interest_rate">Annual Interest Rate (%)</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                placeholder="e.g., 7.5"
              />
            </div>

            {formData.interest_rate && (
              <>
                <Checkbox
                  id="is_compound_interest"
                  checked={formData.is_compound_interest}
                  onChange={(e) => setFormData({ ...formData, is_compound_interest: e.target.checked })}
                  label="Compound Interest"
                />

                {formData.is_compound_interest && (
                  <div>
                    <Label htmlFor="compound_frequency">Compounding Frequency</Label>
                    <Select
                      id="compound_frequency"
                      value={formData.compound_frequency}
                      onChange={(e) => setFormData({ ...formData, compound_frequency: e.target.value as Investment['compound_frequency'] })}
                    >
                      {COMPOUND_FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* TFSA Configuration */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">TFSA Configuration</h3>
              <Checkbox
                id="is_tfsa"
                checked={formData.is_tfsa}
                onChange={(e) => setFormData({ ...formData, is_tfsa: e.target.checked })}
                label="This is a TFSA"
              />
            </div>

            {formData.is_tfsa && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tfsa_annual_limit">Annual Limit (R)</Label>
                    <Input
                      id="tfsa_annual_limit"
                      type="number"
                      step="0.01"
                      value={formData.tfsa_annual_limit}
                      onChange={(e) => setFormData({ ...formData, tfsa_annual_limit: e.target.value })}
                      placeholder="36000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tfsa_lifetime_limit">Lifetime Limit (R)</Label>
                    <Input
                      id="tfsa_lifetime_limit"
                      type="number"
                      step="0.01"
                      value={formData.tfsa_lifetime_limit}
                      onChange={(e) => setFormData({ ...formData, tfsa_lifetime_limit: e.target.value })}
                      placeholder="500000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tfsa_year_start_date">TFSA Year Start</Label>
                    <Input
                      id="tfsa_year_start_date"
                      type="date"
                      value={formData.tfsa_year_start_date}
                      onChange={(e) => setFormData({ ...formData, tfsa_year_start_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tfsa_year_end_date">TFSA Year End</Label>
                    <Input
                      id="tfsa_year_end_date"
                      type="date"
                      value={formData.tfsa_year_end_date}
                      onChange={(e) => setFormData({ ...formData, tfsa_year_end_date: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Fixed Deposit Configuration */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Fixed Deposit Configuration</h3>
              <Checkbox
                id="is_fixed_deposit"
                checked={formData.is_fixed_deposit}
                onChange={(e) => setFormData({ ...formData, is_fixed_deposit: e.target.checked })}
                label="This is a Fixed Deposit"
              />
            </div>

            {formData.is_fixed_deposit && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fixed_deposit_term_months">Term (Months) *</Label>
                    <Input
                      id="fixed_deposit_term_months"
                      type="number"
                      value={formData.fixed_deposit_term_months}
                      onChange={(e) => setFormData({ ...formData, fixed_deposit_term_months: e.target.value })}
                      placeholder="e.g., 12"
                      required={formData.is_fixed_deposit}
                    />
                  </div>

                  <div>
                    <Label htmlFor="fixed_deposit_start_date">Start Date *</Label>
                    <Input
                      id="fixed_deposit_start_date"
                      type="date"
                      value={formData.fixed_deposit_start_date}
                      onChange={(e) => setFormData({ ...formData, fixed_deposit_start_date: e.target.value })}
                      required={formData.is_fixed_deposit}
                    />
                  </div>
                </div>

                {formData.fixed_deposit_term_months && formData.fixed_deposit_start_date && (
                  <div className="text-sm text-muted-foreground">
                    Maturity Date: {(() => {
                      const startDate = new Date(formData.fixed_deposit_start_date);
                      const termMonths = parseInt(formData.fixed_deposit_term_months);
                      const maturityDate = new Date(startDate);
                      maturityDate.setMonth(maturityDate.getMonth() + termMonths);
                      return maturityDate.toLocaleDateString();
                    })()}
                  </div>
                )}

                <Checkbox
                  id="fixed_deposit_auto_renew"
                  checked={formData.fixed_deposit_auto_renew}
                  onChange={(e) => setFormData({ ...formData, fixed_deposit_auto_renew: e.target.checked })}
                  label="Auto-renew on maturity"
                />
              </>
            )}
          </div>

          {/* Performance Tracking (for stocks/ETFs) */}
          {(formData.type === 'stock' || formData.type === 'etf' || formData.type === 'unit_trust') && (
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">Performance Tracking</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="units_held">Units Held</Label>
                  <Input
                    id="units_held"
                    type="number"
                    step="0.0001"
                    value={formData.units_held}
                    onChange={(e) => setFormData({ ...formData, units_held: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="purchase_price">Purchase Price (R)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="current_price">Current Price (R)</Label>
                  <Input
                    id="current_price"
                    type="number"
                    step="0.01"
                    value={formData.current_price}
                    onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Icon Selection */}
          <div>
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {INVESTMENT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`text-2xl p-2 rounded border-2 ${
                    formData.icon === icon ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {INVESTMENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes about this investment..."
              className="w-full px-3 py-2 border rounded-md min-h-[80px] bg-background"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : investment ? 'Update Investment' : 'Create Investment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
