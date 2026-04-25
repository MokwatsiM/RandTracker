'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAccountStore } from '@/stores/accountStore';
import { useDebtStore } from '@/stores/debtStore';
import { useUserStore } from '@/stores/userStore';
import type { Debt } from '@/lib/db/schema';

interface DebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt;
}

function getInitialFormData(debt?: Debt) {
  return {
    name: debt?.name ?? '',
    account_id: debt?.account_id ?? '',
    total_amount: debt?.total_amount ? (debt.total_amount / 100).toString() : '',
    current_balance: debt?.current_balance ? (debt.current_balance / 100).toString() : '',
    interest_rate: debt?.interest_rate?.toString() ?? '',
    minimum_payment: debt?.minimum_payment ? (debt.minimum_payment / 100).toString() : '',
    payment_day: debt?.payment_day?.toString() ?? '',
    term_months: debt?.term_months?.toString() ?? '',
    payoff_strategy: debt?.payoff_strategy ?? ('avalanche' as NonNullable<Debt['payoff_strategy']>),
    priority_order: debt?.priority_order?.toString() ?? '',
    is_active: debt?.is_active ?? true,
  };
}

export function DebtDialog({ open, onOpenChange, debt }: DebtDialogProps) {
  const user = useUserStore((state) => state.user);
  const { accounts } = useAccountStore();
  const { createDebt, updateDebt } = useDebtStore();
  const [formData, setFormData] = useState(getInitialFormData(debt));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData(debt));
  }, [debt, open]);

  // Auto-populate fields when a linked account is selected
  useEffect(() => {
    if (!formData.account_id || debt) return; // Don't auto-populate when editing

    const selectedAccount = accounts.find(acc => acc.id === formData.account_id);
    if (!selectedAccount) return;

    const updates: Partial<typeof formData> = {};

    // For loan accounts
    if (selectedAccount.type === 'loan') {
      if (selectedAccount.loan_principal && !formData.total_amount) {
        updates.total_amount = (selectedAccount.loan_principal / 100).toString();
      }
      if (selectedAccount.current_balance && !formData.current_balance) {
        updates.current_balance = (selectedAccount.current_balance / 100).toString();
      }
      if (selectedAccount.loan_interest_rate && !formData.interest_rate) {
        updates.interest_rate = selectedAccount.loan_interest_rate.toString();
      }
      if (selectedAccount.monthly_instalment && !formData.minimum_payment) {
        updates.minimum_payment = (selectedAccount.monthly_instalment / 100).toString();
      }
      if (selectedAccount.loan_term_months && !formData.term_months) {
        updates.term_months = selectedAccount.loan_term_months.toString();
      }
    }

    // For credit cards
    if (selectedAccount.type === 'credit_card' || selectedAccount.type === 'store_card') {
      if (selectedAccount.credit_limit && !formData.total_amount) {
        updates.total_amount = (selectedAccount.credit_limit / 100).toString();
      }
      if (selectedAccount.current_balance && !formData.current_balance) {
        updates.current_balance = (selectedAccount.current_balance / 100).toString();
      }
      if (selectedAccount.interest_rate && !formData.interest_rate) {
        updates.interest_rate = selectedAccount.interest_rate.toString();
      }
      if (selectedAccount.payment_due_day && !formData.payment_day) {
        updates.payment_day = selectedAccount.payment_due_day.toString();
      }
    }

    // Auto-populate name if empty
    if (!formData.name) {
      updates.name = selectedAccount.name;
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [formData.account_id, accounts, debt]);

  const debtAccounts = accounts.filter(
    (account) =>
      account.type === 'credit_card' ||
      account.type === 'store_card' ||
      account.type === 'loan'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        user_id: user.id,
        account_id: formData.account_id || undefined,
        name: formData.name.trim(),
        total_amount: Math.round(parseFloat(formData.total_amount || '0') * 100),
        current_balance: Math.round(parseFloat(formData.current_balance || '0') * 100),
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        minimum_payment: formData.minimum_payment
          ? Math.round(parseFloat(formData.minimum_payment) * 100)
          : undefined,
        payment_day: formData.payment_day ? parseInt(formData.payment_day, 10) : undefined,
        term_months: formData.term_months ? parseInt(formData.term_months, 10) : undefined,
        payoff_strategy: formData.payoff_strategy,
        priority_order: formData.priority_order ? parseInt(formData.priority_order, 10) : undefined,
        is_active: formData.is_active,
      };

      if (debt) {
        await updateDebt(debt.id, payload);
      } else {
        await createDebt(payload);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save debt:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{debt ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
          <DialogDescription>
            Track balances, minimum payments, and payoff strategy for each debt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Debt Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. FNB Credit Card"
              required
            />
          </div>

          <div>
            <Label htmlFor="account_id">Linked Account</Label>
            <Select
              id="account_id"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
            >
              <option value="">None</option>
              {debtAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="total_amount">Original Amount (ZAR) *</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="current_balance">Current Balance (ZAR) *</Label>
              <Input
                id="current_balance"
                type="number"
                step="0.01"
                min="0"
                value={formData.current_balance}
                onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="minimum_payment">Minimum Payment (ZAR)</Label>
              <Input
                id="minimum_payment"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_payment}
                onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="term_months">Term (Months)</Label>
              <Input
                id="term_months"
                type="number"
                min="1"
                value={formData.term_months}
                onChange={(e) => setFormData({ ...formData, term_months: e.target.value })}
                placeholder="Original loan term"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Original term of the loan/debt
              </p>
            </div>
            <div>
              <Label htmlFor="payment_day">Payment Day</Label>
              <Input
                id="payment_day"
                type="number"
                min="1"
                max="31"
                value={formData.payment_day}
                onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                placeholder="Day of month"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="payoff_strategy">Payoff Strategy</Label>
              <Select
                id="payoff_strategy"
                value={formData.payoff_strategy}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payoff_strategy: e.target.value as NonNullable<Debt['payoff_strategy']>,
                  })
                }
              >
                <option value="avalanche">Avalanche (Highest Interest First)</option>
                <option value="snowball">Snowball (Lowest Balance First)</option>
                <option value="custom">Custom Priority</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority_order">Priority Order</Label>
              <Input
                id="priority_order"
                type="number"
                min="1"
                value={formData.priority_order}
                onChange={(e) => setFormData({ ...formData, priority_order: e.target.value })}
                placeholder="For custom strategy"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm rounded-lg border p-4">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4"
            />
            Debt is active
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : debt ? 'Save Changes' : 'Add Debt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
