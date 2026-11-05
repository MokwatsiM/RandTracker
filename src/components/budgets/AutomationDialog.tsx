'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { BudgetTemplate, TemplateKind } from '@/lib/budget/automations';
import type { Budget, Goal } from '@/lib/db/schema';

export interface AutomationSettings {
  template: BudgetTemplate;
  amount: number;
  period: Budget['period'];
  rollover: boolean;
}

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  budget?: Budget;
  goals: Goal[];
  onSave: (settings: AutomationSettings) => Promise<void>;
}

const KINDS: { value: TemplateKind; label: string; help: string }[] = [
  { value: 'fixed', label: 'A fixed amount', help: 'The same amount every cycle.' },
  { value: 'average', label: 'What I usually spend', help: 'The average of the last few cycles.' },
  { value: 'schedules', label: 'My scheduled payments', help: 'The debit orders and payments scheduled in this category for the cycle.' },
  { value: 'goal', label: 'Saving for a goal', help: "What's still needed, spread over the cycles until the goal's date." },
  { value: 'percent', label: 'A share of income', help: "A percentage of this cycle's income." },
  { value: 'manual', label: 'I set it myself', help: 'Fill budget leaves this category alone.' },
];

export function AutomationDialog({ open, onOpenChange, categoryName, budget, goals, onSave }: AutomationDialogProps) {
  const [kind, setKind] = useState<TemplateKind>('fixed');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<Budget['period']>('monthly');
  const [cycles, setCycles] = useState('3');
  const [goalId, setGoalId] = useState('');
  const [percent, setPercent] = useState('10');
  const [priority, setPriority] = useState('0');
  const [upTo, setUpTo] = useState('');
  const [rollover, setRollover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = budget?.template;
    setKind(t?.kind ?? 'fixed');
    setAmount(budget ? String(budget.amount / 100) : '');
    setPeriod(budget?.period ?? 'monthly');
    setCycles(String(t?.cycles ?? 3));
    setGoalId(t?.goal_id ?? '');
    setPercent(String(t?.percent ?? 10));
    setPriority(String(t?.priority ?? 0));
    setUpTo(t?.up_to ? String(t.up_to / 100) : '');
    setRollover(budget?.rollover_unused ?? false);
    setError(null);
  }, [open, budget]);

  const save = async () => {
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (kind === 'fixed' && amountCents <= 0) return setError('Enter the amount for each cycle.');
    if (kind === 'goal' && !goalId) return setError('Choose a goal.');
    const upToCents = upTo ? Math.round(parseFloat(upTo) * 100) : null;
    setSaving(true);
    try {
      await onSave({
        template: {
          kind,
          ...(kind === 'average' ? { cycles: Math.max(1, Number(cycles) || 3) } : {}),
          ...(kind === 'goal' ? { goal_id: goalId } : {}),
          ...(kind === 'percent' ? { percent: Math.max(0, Number(percent) || 0) } : {}),
          priority: Number(priority) || 0,
          up_to: upToCents && upToCents > 0 ? upToCents : null,
        },
        // The budget's own amount stays meaningful for the other budget views.
        amount: kind === 'fixed' ? amountCents : budget?.amount ?? 0,
        period: kind === 'fixed' ? period : budget?.period ?? 'monthly',
        rollover,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const help = KINDS.find((k) => k.value === kind)?.help;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{categoryName}</DialogTitle>
          <DialogDescription>How Fill budget works out this category each cycle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="a-kind">Amount</Label>
            <Select id="a-kind" value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
            {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
          </div>

          {kind === 'fixed' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="a-amount">Amount (R)</Label>
                <Input id="a-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="a-period">Per</Label>
                <Select id="a-period" value={period} onChange={(e) => setPeriod(e.target.value as Budget['period'])}>
                  <option value="monthly">Month</option>
                  <option value="weekly">Week</option>
                  <option value="yearly">Year</option>
                </Select>
              </div>
            </div>
          )}
          {kind === 'average' && (
            <div>
              <Label htmlFor="a-cycles">Cycles to average</Label>
              <Input id="a-cycles" type="number" min="1" max="24" value={cycles} onChange={(e) => setCycles(e.target.value)} />
            </div>
          )}
          {kind === 'goal' && (
            <div>
              <Label htmlFor="a-goal">Goal</Label>
              <Select id="a-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">Choose...</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id} disabled={!g.target_date}>
                    {g.name}{g.target_date ? '' : ' (needs a target date)'}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {kind === 'percent' && (
            <div>
              <Label htmlFor="a-percent">Percent of income</Label>
              <Input id="a-percent" type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} />
            </div>
          )}

          {kind !== 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="a-priority">Priority</Label>
                <Input id="a-priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Lower numbers are filled first when money runs short.</p>
              </div>
              <div>
                <Label htmlFor="a-upto">Keep at most (R, optional)</Label>
                <Input id="a-upto" type="number" step="0.01" min="0" value={upTo} onChange={(e) => setUpTo(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Stops adding once the category has this much.</p>
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
            <span>
              <span className="font-medium">Carry unused money over</span>
              <span className="block text-muted-foreground">
                Otherwise what&apos;s left at the end of a cycle goes back to be budgeted again.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
