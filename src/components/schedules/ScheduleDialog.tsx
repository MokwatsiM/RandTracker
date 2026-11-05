'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { firstOccurrenceFrom } from '@/lib/schedules/dates';
import type { AmountType, Schedule, ScheduleDraft, ScheduleFrequency, WeekendRule } from '@/lib/schedules/types';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An existing schedule to edit, or a suggested draft to start from. */
  schedule?: Schedule;
  draft?: ScheduleDraft;
  onSave: (draft: ScheduleDraft, existing?: Schedule) => Promise<void>;
}

const REPEATS: { value: string; label: string; frequency: ScheduleFrequency; interval: number }[] = [
  { value: 'once', label: 'Once', frequency: 'once', interval: 1 },
  { value: 'weekly', label: 'Every week', frequency: 'weekly', interval: 1 },
  { value: 'fortnightly', label: 'Every 2 weeks', frequency: 'weekly', interval: 2 },
  { value: 'monthly', label: 'Every month', frequency: 'monthly', interval: 1 },
  { value: 'quarterly', label: 'Every 3 months', frequency: 'monthly', interval: 3 },
  { value: 'yearly', label: 'Every year', frequency: 'yearly', interval: 1 },
  { value: 'daily', label: 'Every day', frequency: 'daily', interval: 1 },
];

const today = () => new Date().toISOString().slice(0, 10);
const toRand = (cents: number | null | undefined) => (cents ? String(cents / 100) : '');
const toCents = (rand: string) => Math.round(parseFloat(rand || '0') * 100);

interface FormState {
  name: string;
  payee: string;
  account_id: string;
  type: Schedule['type'];
  transfer_account_id: string;
  category_id: string;
  subcategory_id: string;
  amount: string;
  amount_type: AmountType;
  amount_min: string;
  amount_max: string;
  repeat: string;
  month_end: boolean;
  start_date: string;
  end_date: string;
  weekend: WeekendRule;
  auto_add: boolean;
  is_subscription: boolean;
  debt_id: string;
  notes: string;
}

function initialState(source?: ScheduleDraft): FormState {
  const repeat =
    REPEATS.find((r) => r.frequency === source?.frequency && r.interval === source?.interval)?.value ?? 'monthly';
  return {
    name: source?.name ?? '',
    payee: source?.payee ?? '',
    account_id: source?.account_id ?? '',
    type: source?.type ?? 'expense',
    transfer_account_id: source?.transfer_account_id ?? '',
    category_id: source?.category_id ?? '',
    subcategory_id: source?.subcategory_id ?? '',
    amount: toRand(source?.amount),
    amount_type: source?.amount_type ?? 'exact',
    amount_min: toRand(source?.amount_min),
    amount_max: toRand(source?.amount_max),
    repeat,
    month_end: source?.month_end ?? false,
    start_date: source?.start_date ?? today(),
    end_date: source?.end_date ?? '',
    weekend: source?.weekend ?? 'after',
    auto_add: source?.auto_add ?? false,
    is_subscription: source?.is_subscription ?? false,
    debt_id: source?.debt_id ?? '',
    notes: source?.notes ?? '',
  };
}

export function ScheduleDialog({ open, onOpenChange, schedule, draft, onSave }: ScheduleDialogProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const { categories, subcategories } = useCategoryStore();
  const debts = useDebtStore((s) => s.debts);
  const [form, setForm] = useState<FormState>(initialState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(schedule ?? draft));
      setError(null);
    }
  }, [open, schedule, draft]);

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const repeat = REPEATS.find((r) => r.value === form.repeat)!;
  const categoryOptions = categories.filter((c) => c.type === (form.type === 'income' ? 'income' : 'expense'));
  const subcategoryOptions = subcategories.filter((s) => s.category_id === form.category_id);

  const save = async () => {
    const amount = toCents(form.amount);
    if (!form.name.trim() || !form.account_id || amount <= 0) {
      setError('A name, an account and an amount are needed.');
      return;
    }
    if (form.type === 'transfer' && (!form.transfer_account_id || form.transfer_account_id === form.account_id)) {
      setError('Choose a different account to transfer to.');
      return;
    }
    if (form.amount_type === 'range' && toCents(form.amount_min) > toCents(form.amount_max)) {
      setError('The lowest amount must not be more than the highest.');
      return;
    }

    const timing = {
      frequency: repeat.frequency,
      interval: repeat.interval,
      start_date: form.start_date,
      month_end: repeat.frequency === 'monthly' && form.month_end,
    };
    const timingChanged =
      !schedule ||
      schedule.frequency !== timing.frequency ||
      schedule.interval !== timing.interval ||
      schedule.start_date !== timing.start_date ||
      schedule.month_end !== timing.month_end;
    // A new or retimed schedule starts at its next occurrence from today, so it doesn't
    // add past transactions. Suggestions already know theirs.
    const nextDate = timingChanged
      ? draft?.next_date && !schedule
        ? draft.next_date
        : firstOccurrenceFrom(timing, today())
      : schedule!.next_date;

    setSaving(true);
    try {
      await onSave(
        {
          name: form.name.trim(),
          payee: form.payee.trim() || null,
          account_id: form.account_id,
          type: form.type,
          transfer_account_id: form.type === 'transfer' ? form.transfer_account_id : null,
          category_id: form.type === 'transfer' ? null : form.category_id || null,
          subcategory_id: form.type === 'transfer' ? null : form.subcategory_id || null,
          amount,
          amount_type: form.amount_type,
          amount_min: form.amount_type === 'range' ? toCents(form.amount_min) : null,
          amount_max: form.amount_type === 'range' ? toCents(form.amount_max) : null,
          ...timing,
          next_date: nextDate,
          end_date: form.end_date || null,
          weekend: form.weekend,
          auto_add: form.auto_add,
          is_subscription: form.is_subscription,
          debt_id: form.type === 'expense' ? form.debt_id || null : null,
          notes: form.notes.trim() || null,
          is_active: schedule?.is_active ?? true,
        },
        schedule
      );
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{schedule ? 'Edit schedule' : 'New schedule'}</DialogTitle>
          <DialogDescription>
            A debit order, subscription, salary or any payment you expect regularly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Vodacom contract" />
          </div>
          <div>
            <Label htmlFor="s-payee">Bank description (optional)</Label>
            <Input id="s-payee" value={form.payee} onChange={(e) => set({ payee: e.target.value })} placeholder="Used to match imports" />
          </div>
          <div>
            <Label htmlFor="s-type">Type</Label>
            <Select id="s-type" value={form.type} onChange={(e) => set({ type: e.target.value as Schedule['type'], category_id: '', subcategory_id: '', weekend: e.target.value === 'income' ? 'before' : 'after' })}>
              <option value="expense">Money out</option>
              <option value="income">Money in</option>
              <option value="transfer">Transfer between accounts</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-account">{form.type === 'transfer' ? 'From account' : 'Account'}</Label>
            <Select id="s-account" value={form.account_id} onChange={(e) => set({ account_id: e.target.value })}>
              <option value="">Choose...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </Select>
          </div>
          {form.type === 'transfer' ? (
            <div>
              <Label htmlFor="s-to">To account</Label>
              <Select id="s-to" value={form.transfer_account_id} onChange={(e) => set({ transfer_account_id: e.target.value })}>
                <option value="">Choose...</option>
                {accounts.filter((a) => a.id !== form.account_id).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="s-category">Category</Label>
                <Select id="s-category" value={form.category_id} onChange={(e) => set({ category_id: e.target.value, subcategory_id: '' })}>
                  <option value="">None</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </Select>
              </div>
              {subcategoryOptions.length > 0 && (
                <div>
                  <Label htmlFor="s-sub">Subcategory</Label>
                  <Select id="s-sub" value={form.subcategory_id} onChange={(e) => set({ subcategory_id: e.target.value })}>
                    <option value="">None</option>
                    {subcategoryOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
              )}
            </>
          )}

          <div>
            <Label htmlFor="s-amount">Amount (R)</Label>
            <Input id="s-amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-amount-type">The amount is</Label>
            <Select id="s-amount-type" value={form.amount_type} onChange={(e) => set({ amount_type: e.target.value as AmountType })}>
              <option value="exact">Always the same</option>
              <option value="approx">About this (within 7.5%)</option>
              <option value="range">Between two amounts</option>
            </Select>
          </div>
          {form.amount_type === 'range' && (
            <>
              <div>
                <Label htmlFor="s-min">Lowest (R)</Label>
                <Input id="s-min" type="number" step="0.01" min="0" value={form.amount_min} onChange={(e) => set({ amount_min: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="s-max">Highest (R)</Label>
                <Input id="s-max" type="number" step="0.01" min="0" value={form.amount_max} onChange={(e) => set({ amount_max: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="s-repeat">Repeats</Label>
            <Select id="s-repeat" value={form.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              {REPEATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            {repeat.frequency === 'monthly' && (
              <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.month_end} onChange={(e) => set({ month_end: e.target.checked })} />
                Always on the last day of the month
              </label>
            )}
          </div>
          <div>
            <Label htmlFor="s-start">{repeat.frequency === 'once' ? 'Date' : 'First date'}</Label>
            <Input id="s-start" type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
          </div>
          {repeat.frequency !== 'once' && (
            <div>
              <Label htmlFor="s-end">Ends (optional)</Label>
              <Input id="s-end" type="date" value={form.end_date} min={form.start_date} onChange={(e) => set({ end_date: e.target.value })} />
            </div>
          )}
          <div>
            <Label htmlFor="s-weekend">On weekends and public holidays</Label>
            <Select id="s-weekend" value={form.weekend} onChange={(e) => set({ weekend: e.target.value as WeekendRule })}>
              <option value="after">Move to the next working day</option>
              <option value="before">Move to the working day before</option>
              <option value="none">Keep the date</option>
            </Select>
          </div>
          {form.type === 'expense' && debts.length > 0 && (
            <div>
              <Label htmlFor="s-debt">Payment towards a debt (optional)</Label>
              <Select id="s-debt" value={form.debt_id} onChange={(e) => set({ debt_id: e.target.value })}>
                <option value="">None</option>
                {debts.filter((d) => d.is_active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="s-notes">Notes (optional)</Label>
            <Input id="s-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.auto_add} onChange={(e) => set({ auto_add: e.target.checked })} />
              <span>
                <span className="font-medium">Add automatically</span>
                <span className="block text-muted-foreground">
                  Otherwise it waits for you to approve it, which suits amounts that change.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_subscription} onChange={(e) => set({ is_subscription: e.target.checked })} />
              <span className="font-medium">This is a subscription</span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
