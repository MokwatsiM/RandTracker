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
import { useAccountStore } from '@/stores/accountStore';
import { useUserStore } from '@/stores/userStore';
import type { Account } from '@/lib/db/schema';

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}

const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'cheque', label: 'Cheque Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'store_card', label: 'Store Card' },
  { value: 'investment', label: 'Investment' },
];

const ACCOUNT_ICONS = ['💳', '💰', '💵', '🏦', '💎', '🎯', '📊', '🏠', '🚗'];
const ACCOUNT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Green
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#06b6d4', // Cyan
];

const getInitialFormData = (account?: Account) => ({
  name: account?.name || '',
  type: account?.type || 'cheque' as Account['type'],
  initial_balance: account?.initial_balance ? (account.initial_balance / 100).toString() : '0',
  icon: account?.icon || '💳',
  color: account?.color || '#6366f1',
  group_name: account?.group_name || '',

  // Credit card fields
  credit_limit: account?.credit_limit ? (account.credit_limit / 100).toString() : '',
  statement_day: account?.statement_day?.toString() || '',
  payment_due_day: account?.payment_due_day?.toString() || '',
  interest_rate: account?.interest_rate?.toString() || '',

  // Loan fields
  loan_principal: account?.loan_principal ? (account.loan_principal / 100).toString() : '',
  loan_interest_rate: account?.loan_interest_rate?.toString() || '',
  loan_term_months: account?.loan_term_months?.toString() || '',
  monthly_instalment: account?.monthly_instalment ? (account.monthly_instalment / 100).toString() : '',
});

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const user = useUserStore(state => state.user);
  const { createAccount, updateAccount } = useAccountStore();

  const [formData, setFormData] = useState(getInitialFormData(account));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form data when account prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(account));
  }, [account, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const balanceInCents = Math.round(parseFloat(formData.initial_balance || '0') * 100);

      const baseData = {
        user_id: user.id,
        name: formData.name,
        type: formData.type,
        initial_balance: balanceInCents,
        icon: formData.icon,
        color: formData.color,
        group_name: formData.group_name || undefined,
        is_primary: false,
        is_archived: false,
        sort_order: 0,
        currency: 'ZAR',
      };

      const accountData: any = { ...baseData };

      // When editing, update current_balance to match the new balance
      if (account) {
        accountData.current_balance = balanceInCents;
      }

      // Add type-specific fields
      if (formData.type === 'credit_card' || formData.type === 'store_card') {
        accountData.credit_limit = formData.credit_limit ? Math.round(parseFloat(formData.credit_limit) * 100) : undefined;
        accountData.statement_day = formData.statement_day ? parseInt(formData.statement_day) : undefined;
        accountData.payment_due_day = formData.payment_due_day ? parseInt(formData.payment_due_day) : undefined;
        accountData.interest_rate = formData.interest_rate ? parseFloat(formData.interest_rate) : undefined;
        accountData.minimum_payment_percentage = 5; // Default 5%
      }

      if (formData.type === 'loan') {
        accountData.loan_principal = formData.loan_principal ? Math.round(parseFloat(formData.loan_principal) * 100) : undefined;
        accountData.loan_interest_rate = formData.loan_interest_rate ? parseFloat(formData.loan_interest_rate) : undefined;
        accountData.loan_term_months = formData.loan_term_months ? parseInt(formData.loan_term_months) : undefined;
        accountData.monthly_instalment = formData.monthly_instalment ? Math.round(parseFloat(formData.monthly_instalment) * 100) : undefined;
        accountData.loan_start_date = account?.loan_start_date || new Date().toISOString().split('T')[0];
      }

      if (account) {
        await updateAccount(account.id, accountData);
      } else {
        await createAccount(accountData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add New Account'}</DialogTitle>
          <DialogDescription>
            {account ? 'Update your account details' : 'Create a new account to track your finances'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Name */}
          <div>
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., FNB Cheque Account"
              required
            />
          </div>

          {/* Account Type */}
          <div>
            <Label htmlFor="type">Account Type *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })}
              required
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Initial Balance / Current Balance */}
          <div>
            <Label htmlFor="initial_balance">
              {account
                ? (formData.type === 'loan' ? 'Current Outstanding' : 'Current Balance')
                : (formData.type === 'credit_card' || formData.type === 'store_card' ? 'Current Balance' : 'Initial Balance')
              } *
            </Label>
            <Input
              id="initial_balance"
              type="number"
              step="0.01"
              value={formData.initial_balance}
              onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          {/* Credit Card Fields */}
          {(formData.type === 'credit_card' || formData.type === 'store_card') && (
            <>
              <div>
                <Label htmlFor="credit_limit">Credit Limit</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="statement_day">Statement Day</Label>
                  <Input
                    id="statement_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.statement_day}
                    onChange={(e) => setFormData({ ...formData, statement_day: e.target.value })}
                    placeholder="e.g., 15"
                  />
                </div>

                <div>
                  <Label htmlFor="payment_due_day">Payment Due Day</Label>
                  <Input
                    id="payment_due_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_due_day}
                    onChange={(e) => setFormData({ ...formData, payment_due_day: e.target.value })}
                    placeholder="e.g., 25"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                <Input
                  id="interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.interest_rate}
                  onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                  placeholder="e.g., 21.75"
                />
              </div>
            </>
          )}

          {/* Loan Fields */}
          {formData.type === 'loan' && (
            <>
              <div>
                <Label htmlFor="loan_principal">Loan Amount</Label>
                <Input
                  id="loan_principal"
                  type="number"
                  step="0.01"
                  value={formData.loan_principal}
                  onChange={(e) => setFormData({ ...formData, loan_principal: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="loan_interest_rate">Interest Rate (%)</Label>
                <Input
                  id="loan_interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.loan_interest_rate}
                  onChange={(e) => setFormData({ ...formData, loan_interest_rate: e.target.value })}
                  placeholder="e.g., 11.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loan_term_months">Term (Months)</Label>
                  <Input
                    id="loan_term_months"
                    type="number"
                    value={formData.loan_term_months}
                    onChange={(e) => setFormData({ ...formData, loan_term_months: e.target.value })}
                    placeholder="e.g., 60"
                  />
                </div>

                <div>
                  <Label htmlFor="monthly_instalment">Monthly Payment</Label>
                  <Input
                    id="monthly_instalment"
                    type="number"
                    step="0.01"
                    value={formData.monthly_instalment}
                    onChange={(e) => setFormData({ ...formData, monthly_instalment: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          )}

          {/* Icon Selection */}
          <div>
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {ACCOUNT_ICONS.map((icon) => (
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
              {ACCOUNT_COLORS.map((color) => (
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

          {/* Group Name */}
          <div>
            <Label htmlFor="group_name">Group (Optional)</Label>
            <Input
              id="group_name"
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              placeholder="e.g., FNB Accounts"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
