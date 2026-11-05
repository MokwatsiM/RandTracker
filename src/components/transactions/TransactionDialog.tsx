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
import { useRuleStore } from '@/stores/ruleStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { firstOccurrenceFrom, nextOccurrence } from '@/lib/schedules/dates';
import type { ScheduleDraft, ScheduleFrequency } from '@/lib/schedules/types';
import { mergeTags, splitProblem, tagsInText } from '@/lib/ledger/ledger';
import { useToastStore } from '@/stores/toastStore';
import { applyRules } from '@/lib/rules/engine';
import type { RuleSubject } from '@/lib/rules/types';
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
  recurrence_frequency: transaction?.recurrence_frequency || 'monthly',
  recurrence_end_date: transaction?.recurrence_end_date || '',
  is_split: Boolean(transaction?.splits?.length),
  splits: (transaction?.splits ?? []).map((s) => ({ category_id: s.category_id, amount: (s.amount / 100).toString() })),
  tags: (transaction?.tags ?? []).join(', '),
  cleared: transaction?.cleared ?? false,
});

export function TransactionDialog({ open, onOpenChange, transaction }: TransactionDialogProps) {
  const user = useUserStore(state => state.user);
  const { createTransaction, updateTransaction } = useTransactionStore();
  const { accounts } = useAccountStore();
  const { categories, subcategories } = useCategoryStore();
  const { debts, loadDebts } = useDebtStore();

  const { rules, loadRules, learnCategories, planRename, saveChange } = useRuleStore();
  const createSchedule = useScheduleStore((state) => state.createSchedule);

  const [formData, setFormData] = useState(getInitialFormData(transaction));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Rules only fill in the category until the user picks one themselves.
  const [categoryTouched, setCategoryTouched] = useState(false);

  // Reset form data when transaction prop changes or dialog opens/closes
  useEffect(() => {
    setFormData(getInitialFormData(transaction));
    setCategoryTouched(false);
    setFormError(null);
  }, [transaction, open]);

  useEffect(() => {
    if (open && user) {
      void loadRules(user.id);
    }
  }, [loadRules, open, user]);

  // For a new transaction, rules suggest a category from the title.
  const suggestCategory = () => {
    if (transaction || categoryTouched || formData.type === 'transfer' || !formData.title.trim() || !formData.account_id) {
      return;
    }
    const subject: RuleSubject = {
      title: formData.title,
      account_id: formData.account_id,
      type: formData.type,
      amount: Math.round(parseFloat(formData.amount || '0') * 100),
      date: formData.date,
      category_id: null,
    };
    const { subject: result } = applyRules(subject, rules, {
      categoryTypes: new Map(categories.map((c) => [c.id, c.type])),
    });
    if (result.category_id) {
      setFormData((current) => ({
        ...current,
        category_id: result.category_id ?? '',
        subcategory_id: result.subcategory_id ?? '',
      }));
    }
  };

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

  // A changed category teaches the payee's learned rule. A changed title on an imported
  // transaction can become a rule that renames future ones.
  const learnFromEdit = async (before: Transaction, after: Partial<Transaction>) => {
    if (!user) return;
    try {
      const subject: RuleSubject = {
        imported_payee: before.imported_payee ?? null,
        title: after.title ?? before.title,
        account_id: after.account_id ?? before.account_id,
        type: after.type ?? before.type,
        amount: after.amount ?? before.amount,
        date: after.date ?? before.date,
        category_id: after.category_id || null,
      };
      if (user.rule_learning !== false && categoryTouched && after.category_id && after.category_id !== before.category_id) {
        const all = useTransactionStore.getState().transactions;
        await learnCategories(user.id, [subject], all);
      }
      if (after.title && after.title !== before.title) {
        const rename = planRename({ imported_payee: before.imported_payee }, after.title);
        if (
          rename &&
          window.confirm(`Rename future "${before.imported_payee}" transactions to "${after.title}" too?`)
        ) {
          await saveChange(user.id, rename);
        }
      }
    } catch (error) {
      // The transaction itself is saved; a rule that failed to save can be added later.
      console.error('Failed to update rules:', error);
    }
  };

  // "Repeat this" creates a schedule, and this transaction becomes its first occurrence,
  // so the server adds the following ones on their dates.
  const createRepeating = async (transactionData: any) => {
    if (!user) return;
    const repeat: Record<string, [ScheduleFrequency, number]> = {
      weekly: ['weekly', 1], biweekly: ['weekly', 2], monthly: ['monthly', 1], quarterly: ['monthly', 3], yearly: ['yearly', 1],
    };
    const [frequency, interval] = repeat[formData.recurrence_frequency] ?? ['monthly', 1];
    const timing = { frequency, interval, start_date: transactionData.date as string, month_end: false };
    const today = new Date().toISOString().slice(0, 10);
    const draft: ScheduleDraft = {
      name: transactionData.title,
      payee: transactionData.title,
      account_id: transactionData.account_id,
      type: transactionData.type,
      transfer_account_id: transactionData.transfer_account_id ?? null,
      category_id: transactionData.category_id || null,
      subcategory_id: transactionData.subcategory_id || null,
      amount: transactionData.amount,
      amount_type: 'exact',
      amount_min: null,
      amount_max: null,
      ...timing,
      // Dated in the future: the schedule adds it on the day instead of now.
      next_date: timing.start_date > today ? timing.start_date : nextOccurrence(timing, timing.start_date) ?? firstOccurrenceFrom(timing, today),
      end_date: formData.recurrence_end_date || null,
      weekend: 'none',
      auto_add: true,
      is_subscription: false,
      debt_id: transactionData.debt_id ?? null,
      notes: transactionData.notes ?? null,
      is_active: true,
    };
    const schedule = await createSchedule(user.id, draft);
    if (timing.start_date <= today) {
      await createTransaction({ ...transactionData, is_recurring: false, schedule_id: schedule.id, schedule_date: timing.start_date });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    const amountInCents = Math.round(parseFloat(formData.amount || '0') * 100);
    const splitting = formData.is_split && formData.type !== 'transfer';
    const splits = splitting
      ? formData.splits.map((s) => ({ category_id: s.category_id, amount: Math.round(parseFloat(s.amount || '0') * 100) }))
      : null;
    if (splits) {
      const problem = splitProblem(amountInCents, splits);
      if (problem) {
        setFormError(problem);
        return;
      }
    }

    // A reconciled transaction already matches a bank statement.
    if (
      transaction?.reconciled &&
      (amountInCents !== transaction.amount || formData.date !== transaction.date || formData.account_id !== transaction.account_id) &&
      !window.confirm('This transaction was reconciled against a statement. Changing its amount, date or account will make the account disagree with that statement. Change it anyway?')
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
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
        category_id: splits ? '' : formData.category_id || '',
        subcategory_id: splits ? undefined : formData.subcategory_id || undefined,
        splits,
        // Tags typed in notes as #tag are added too.
        tags: mergeTags(formData.tags.split(','), tagsInText(formData.notes)),
        cleared: formData.cleared,
        title: formData.title || 'Transaction',
        notes: formData.notes || undefined,
        transfer_account_id: formData.type === 'transfer' ? formData.transfer_account_id : undefined,
        is_recurring: formData.is_recurring,
        is_subscription: transaction?.is_subscription ?? false,
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
        exclude_from_budget: transaction?.exclude_from_budget ?? false,
      };

      // Add recurrence rule if recurring
      if (formData.is_recurring) {
        transactionData.recurrence_frequency = formData.recurrence_frequency;
        transactionData.recurrence_end_date = formData.recurrence_end_date || undefined;
      }

      if (transaction) {
        await updateTransaction(transaction.id, transactionData);
        const original = transaction;
        useToastStore.getState().show('Transaction saved.', {
          label: 'Undo',
          run: () => updateTransaction(original.id, original),
        });
        await learnFromEdit(transaction, transactionData);
      } else if (formData.is_recurring) {
        await createRepeating(transactionData);
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.is_split}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_split: e.target.checked,
                    splits:
                      e.target.checked && formData.splits.length === 0
                        ? [
                            { category_id: formData.category_id, amount: formData.amount },
                            { category_id: '', amount: '' },
                          ]
                        : formData.splits,
                  })
                }
              />
              Split across categories
            </label>
          )}

          {formData.type !== 'transfer' && formData.is_split && (
            <div className="space-y-2 rounded-lg border p-3">
              {formData.splits.map((part, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                  <Select
                    value={part.category_id}
                    onChange={(e) => {
                      const splits = [...formData.splits];
                      splits[i] = { ...part, category_id: e.target.value };
                      setFormData({ ...formData, splits });
                    }}
                    aria-label={`Category for part ${i + 1}`}
                  >
                    <option value="">Category...</option>
                    {filteredCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={part.amount}
                    onChange={(e) => {
                      const splits = [...formData.splits];
                      splits[i] = { ...part, amount: e.target.value };
                      setFormData({ ...formData, splits });
                    }}
                    aria-label={`Amount for part ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={formData.splits.length <= 2}
                    onClick={() => setFormData({ ...formData, splits: formData.splits.filter((_, j) => j !== i) })}
                    aria-label={`Remove part ${i + 1}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, splits: [...formData.splits, { category_id: '', amount: '' }] })}>
                  Add part
                </Button>
                <span>
                  {splitProblem(
                    Math.round(parseFloat(formData.amount || '0') * 100),
                    formData.splits.map((s) => ({ category_id: s.category_id, amount: Math.round(parseFloat(s.amount || '0') * 100) }))
                  ) ?? 'Parts add up to the total'}
                </span>
              </div>
            </div>
          )}

          {formData.type !== 'transfer' && !formData.is_split && (
            <>
              <div>
                <Label htmlFor="category_id">Category</Label>
                <Select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    setFormData({
                      ...formData,
                      category_id: e.target.value,
                      subcategory_id: '' // Reset subcategory when category changes
                    });
                  }}
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
              onBlur={suggestCategory}
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

          {/* Tags */}
          <div>
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="e.g. work, holiday"
            />
            <p className="text-xs text-muted-foreground mt-1">Separate with commas. #tags written in notes are added too.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.cleared} onChange={(e) => setFormData({ ...formData, cleared: e.target.checked })} />
            Cleared (shown on a bank statement)
          </label>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          {/* Recurring Transaction */}
          {/* Only for new transactions; existing schedules are managed on the Schedules page. */}
          {!transaction && (
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
                Repeat this (creates a schedule)
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
                    Leave empty to keep repeating. Manage it later under Schedules.
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

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
