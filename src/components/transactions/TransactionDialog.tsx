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
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { useUserStore } from '@/stores/userStore';
import type { Transaction } from '@/lib/db/schema';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
}

const getInitialFormData = (transaction?: Transaction) => ({
  type: transaction?.type || 'expense' as 'income' | 'expense' | 'transfer',
  amount: transaction?.amount ? (transaction.amount / 100).toString() : '',
  date: transaction?.date || new Date().toISOString().split('T')[0],
  account_id: transaction?.account_id || '',
  category_id: transaction?.category_id || '',
  subcategory_id: transaction?.subcategory_id || '',
  title: transaction?.title || '',
  notes: transaction?.notes || '',
  transfer_account_id: transaction?.transfer_account_id || '',
  is_debt_payment: transaction?.is_debt_payment || false,
  debt_id: transaction?.debt_id || '',
  principal_portion: transaction?.principal_portion ? (transaction.principal_portion / 100).toString() : '',
  is_recurring: transaction?.is_recurring || false,
  recurrence_frequency: transaction?.recurrence_rule?.frequency || 'monthly',
  recurrence_end_date: transaction?.recurrence_rule?.end_date || '',
});

export function TransactionDialog({ open, onOpenChange, transaction }: TransactionDialogProps) {
  const user = useUserStore(state => state.user);
  const { createTransaction, updateTransaction } = useTransactionStore();
  const { accounts } = useAccountStore();
  const { categories, subcategories } = useCategoryStore();
  const { debts, loadDebts } = useDebtStore();

  const [formData, setFormData] = useState(getInitialFormData(transaction));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form data when transaction prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(transaction));
  }, [transaction, open]);

  useEffect(() => {
    if (open && user) {
      void loadDebts(user.id);
    }
  }, [loadDebts, open, user]);

  // Get subcategories for selected category
  const categorySubcategories = subcategories.filter(
    (subcategory) => subcategory.category_id === formData.category_id
  );

  // Filter categories by type
  const filteredCategories = categories.filter(c => c.type === formData.type);
  const activeDebts = debts.filter((debt) => debt.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const amountInCents = Math.round(parseFloat(formData.amount || '0') * 100);
      const principalPortionInCents = Math.min(
        amountInCents,
        Math.max(
          0,
          Math.round(parseFloat(formData.principal_portion || formData.amount || '0') * 100)
        )
      );

      const transactionData: any = {
        user_id: user.id,
        type: formData.type,
        amount: amountInCents,
        date: formData.date,
        account_id: formData.account_id,
        category_id: formData.category_id || '',
        subcategory_id: formData.subcategory_id || undefined,
        title: formData.title || 'Transaction',
        notes: formData.notes || undefined,
        transfer_account_id: formData.type === 'transfer' ? formData.transfer_account_id : undefined,
        is_recurring: formData.is_recurring,
        is_subscription: false,
        is_debt_payment: formData.type === 'expense' ? formData.is_debt_payment : false,
        debt_id:
          formData.type === 'expense' && formData.is_debt_payment && formData.debt_id
            ? formData.debt_id
            : undefined,
        principal_portion:
          formData.type === 'expense' && formData.is_debt_payment
            ? principalPortionInCents
            : undefined,
        is_paid: true,
        exclude_from_budget: false,
      };

      // Add recurrence rule if recurring
      if (formData.is_recurring) {
        transactionData.recurrence_rule = {
          frequency: formData.recurrence_frequency,
          end_date: formData.recurrence_end_date || undefined,
        };
      }

      if (transaction) {
        await updateTransaction(transaction.id, transactionData);
      } else {
        await createTransaction(transactionData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {transaction ? 'Update transaction details' : 'Record a new income or expense'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({
                ...formData,
                type: e.target.value as 'income' | 'expense' | 'transfer',
                category_id: '', // Reset category when type changes
                subcategory_id: ''
              })}
              required
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </Select>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (ZAR) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              required
            />
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

          {/* Account */}
          <div>
            <Label htmlFor="account_id">
              {formData.type === 'transfer' ? 'From Account *' : 'Account *'}
            </Label>
            <Select
              id="account_id"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              required
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </Select>
          </div>

          {/* To Account (for transfers) */}
          {formData.type === 'transfer' && (
            <div>
              <Label htmlFor="transfer_account_id">To Account *</Label>
              <Select
                id="transfer_account_id"
                value={formData.transfer_account_id}
                onChange={(e) => setFormData({ ...formData, transfer_account_id: e.target.value })}
                required
              >
                <option value="">Select account</option>
                {accounts
                  .filter(acc => acc.id !== formData.account_id)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.icon} {account.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}

          {/* Category (not for transfers) */}
          {formData.type !== 'transfer' && (
            <>
              <div>
                <Label htmlFor="category_id">Category</Label>
                <Select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => setFormData({
                    ...formData,
                    category_id: e.target.value,
                    subcategory_id: '' // Reset subcategory when category changes
                  })}
                >
                  <option value="">Select category</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Subcategory */}
              {categorySubcategories.length > 0 && (
                <div>
                  <Label htmlFor="subcategory_id">Subcategory</Label>
                  <Select
                    id="subcategory_id"
                    value={formData.subcategory_id}
                    onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                  >
                    <option value="">Select subcategory</option>
                    {categorySubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          {formData.type === 'expense' && (
            <div className="border rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_debt_payment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_debt_payment: e.target.checked,
                      debt_id: e.target.checked ? formData.debt_id : '',
                      principal_portion: e.target.checked ? formData.principal_portion : '',
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">This expense is a debt payment</span>
              </label>

              {formData.is_debt_payment && (
                <>
                  <div>
                    <Label htmlFor="debt_id">Debt *</Label>
                    <Select
                      id="debt_id"
                      value={formData.debt_id}
                      onChange={(e) => setFormData({ ...formData, debt_id: e.target.value })}
                      required={formData.is_debt_payment}
                    >
                      <option value="">Select debt</option>
                      {activeDebts.map((debt) => (
                        <option key={debt.id} value={debt.id}>
                          {debt.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="principal_portion">Principal Portion (ZAR)</Label>
                    <Input
                      id="principal_portion"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.principal_portion}
                      onChange={(e) => setFormData({ ...formData, principal_portion: e.target.value })}
                      placeholder={formData.amount || '0.00'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Only the principal portion reduces the debt balance. Leave this blank to use the full payment.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Groceries at Pick n Pay"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details..."
            />
          </div>

          {/* Recurring Transaction */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_recurring" className="mb-0 cursor-pointer">
                This is a recurring transaction
              </Label>
            </div>

            {formData.is_recurring && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label htmlFor="recurrence_frequency">Frequency</Label>
                  <Select
                    id="recurrence_frequency"
                    value={formData.recurrence_frequency}
                    onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value as any })}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (every 3 months)</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="recurrence_end_date">End Date (Optional)</Label>
                  <Input
                    id="recurrence_end_date"
                    type="date"
                    value={formData.recurrence_end_date}
                    onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    min={formData.date}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for ongoing recurring transaction
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : transaction ? 'Update' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
