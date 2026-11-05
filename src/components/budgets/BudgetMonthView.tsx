'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Settings2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AutomationDialog, type AutomationSettings } from '@/components/budgets/AutomationDialog';
import { formatZAR } from '@/lib/currency';
import { cycleLabel, nextCycleStart, previousCycleStart } from '@/lib/budget/cycles';
import {
  averageSpending,
  describeTemplate,
  fillBudget,
  scheduledSpending,
  templateAmount,
  type Automation,
  type FillContext,
} from '@/lib/budget/automations';
import { fetchBudgetMonth, saveAllocations, type BudgetMonth } from '@/lib/supabase/data';
import { useUserStore } from '@/stores/userStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useGoalStore } from '@/stores/goalStore';
import type { Budget } from '@/lib/db/schema';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** A ring that fills as the category's target is met: green met, amber not yet, red overspent. */
function TargetRing({ progress, overspent }: { progress: number; overspent: boolean }) {
  const r = 9;
  const length = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, progress)) * length;
  const colour = overspent ? 'text-red-500' : progress >= 1 ? 'text-green-500' : 'text-amber-500';
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 -rotate-90 ${colour}`} aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${filled} ${length}`} strokeLinecap="round" />
    </svg>
  );
}

export function BudgetMonthView() {
  const user = useUserStore((s) => s.user);
  const { budgets, loadBudgets, createBudget, updateBudget } = useBudgetStore();
  const { categories, loadCategories } = useCategoryStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { schedules, loadSchedules } = useScheduleStore();
  const { goals, loadGoals } = useGoalStore();

  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState<BudgetMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ categoryId: string; name: string } | null>(null);
  // The server's payday, so cycle dates here always match its figures.
  const payday = month?.payday ?? user?.payday_date ?? 25;

  const load = useCallback(async () => {
    try {
      setMonth(await fetchBudgetMonth(date));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the budget month');
    }
  }, [date]);

  useEffect(() => {
    if (!user) return;
    void loadBudgets(user.id);
    void loadCategories(user.id);
    void loadTransactions(user.id);
    void loadSchedules(user.id);
    void loadGoals(user.id);
  }, [user, loadBudgets, loadCategories, loadTransactions, loadSchedules, loadGoals]);

  // Spending changes the figures, so they're read again whenever transactions change.
  useEffect(() => {
    if (user) void load();
  }, [user, load, transactions]);

  const rows = useMemo(() => new Map((month?.categories ?? []).map((c) => [c.category_id, c])), [month]);
  const budgetFor = useCallback(
    (categoryId: string): Budget | undefined => budgets.find((b) => b.category_id === categoryId && b.is_active),
    [budgets]
  );
  const automations: Automation[] = useMemo(
    () =>
      budgets
        .filter((b) => b.is_active && b.category_id)
        .map((b) => ({ category_id: b.category_id!, template: b.template ?? { kind: 'fixed' }, amount: b.amount, period: b.period })),
    [budgets]
  );

  const context = useMemo((): FillContext | null => {
    if (!month) return null;
    return {
      payday,
      cycleStart: month.cycle_start,
      toBudget: month.to_budget,
      income: month.income,
      assigned: new Map(month.categories.map((c) => [c.category_id, c.assigned])),
      carried: new Map(month.categories.map((c) => [c.category_id, c.carried])),
      average: (n) => averageSpending(transactions, payday, month.cycle_start, n),
      scheduled: scheduledSpending(schedules, payday, month.cycle_start),
      goals,
    };
  }, [month, payday, transactions, schedules, goals]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const saveAmounts = async (amounts: Map<string, number>) => {
    if (!user || !month || amounts.size === 0) return;
    setBusy(true);
    try {
      await saveAllocations(user.id, month.cycle_start, amounts);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const commitDraft = async (categoryId: string) => {
    const text = drafts[categoryId];
    if (text === undefined) return;
    const cents = Math.max(0, Math.round(parseFloat(text || '0') * 100));
    setDrafts(({ [categoryId]: _, ...rest }) => rest);
    if (cents !== (rows.get(categoryId)?.assigned ?? 0)) await saveAmounts(new Map([[categoryId, cents]]));
  };

  const fill = async (mode: 'empty' | 'overwrite') => {
    if (!context) return;
    if (mode === 'overwrite' && !window.confirm('Replace the amounts in every automated category for this cycle?')) return;
    const { allocations, shortfall } = fillBudget(automations, context, mode);
    await saveAmounts(allocations);
    if (shortfall > 0) alert(`There wasn't enough to budget: ${formatZAR(shortfall)} of what the automations asked for couldn't be assigned.`);
    else if (allocations.size === 0) alert('Nothing to fill. Set up automations with the gear button on each category.');
  };

  const saveAutomation = async (categoryId: string, name: string, settings: AutomationSettings) => {
    if (!user) return;
    const existing = budgetFor(categoryId);
    const fields = {
      name: existing?.name ?? name,
      category_id: categoryId,
      amount: settings.amount,
      period: settings.period,
      start_date: existing?.start_date ?? month?.cycle_start ?? todayIso(),
      end_date: existing?.end_date,
      rollover_unused: settings.rollover,
      alert_threshold: existing?.alert_threshold ?? 80,
      is_active: true,
      template: settings.template,
    };
    if (existing) await updateBudget(existing.id, fields);
    else await createBudget({ ...fields, user_id: user.id });
    await load();
  };

  if (!user) return null;

  const toBudget = month?.to_budget ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => month && setDate(previousCycleStart(payday, month.cycle_start))} aria-label="Previous cycle">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[14rem] text-center">
            <p className="font-medium">{month ? cycleLabel(payday, month.cycle_start) : '...'}</p>
            <p className="text-xs text-muted-foreground">Payday on the {payday}{payday === 1 ? 'st' : payday === 2 ? 'nd' : payday === 3 ? 'rd' : 'th'}, or the working day before</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => month && setDate(nextCycleStart(payday, month.cycle_start))} aria-label="Next cycle">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {month && (todayIso() < month.cycle_start || todayIso() > month.cycle_end) && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayIso())}>This cycle</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fill('overwrite')} disabled={busy || !context}>Overwrite with automations</Button>
          <Button onClick={() => void fill('empty')} disabled={busy || !context}>
            <Wand2 className="mr-2 h-4 w-4" />
            Fill budget
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Income this cycle</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatZAR(month?.income ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Assigned</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatZAR(month?.assigned ?? 0)}</p></CardContent>
        </Card>
        <Card className={toBudget < 0 ? 'border-red-400' : ''}>
          <CardHeader className="pb-2"><CardDescription>{toBudget < 0 ? 'Over-assigned' : 'Left to budget'}</CardDescription></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${toBudget < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatZAR(Math.abs(toBudget))}</p>
            {(month?.overspent_last_cycle ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">Includes {formatZAR(month!.overspent_last_cycle)} overspent last cycle</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Available = carried over + assigned − spent. Overspending comes out of the next cycle; unused money carries over
            only where you turned that on.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1fr_8rem_7rem_7rem_2rem] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Category</span>
            <span className="text-right">Assigned</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Available</span>
            <span />
          </div>
          <div className="divide-y">
            {expenseCategories.map((c) => {
              const row = rows.get(c.id);
              const budget = budgetFor(c.id);
              const automation = automations.find((a) => a.category_id === c.id);
              const target = automation && context ? templateAmount(automation, context) : null;
              const available = row?.available ?? 0;
              return (
                <div key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_8rem_7rem_7rem_2rem]">
                  <div className="flex min-w-0 items-center gap-2">
                    {target ? <TargetRing progress={(row?.assigned ?? 0) / target} overspent={available < 0} /> : <span className="w-6" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.icon} {c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {budget ? describeTemplate(budget.template ?? { kind: 'fixed' }, budget.amount, budget.period, goals.find((g) => g.id === budget.template?.goal_id)?.name) : 'No automation'}
                        {row && row.carried !== 0 ? ` · ${formatZAR(row.carried)} carried over` : ''}
                      </p>
                    </div>
                  </div>
                  <Input
                    className="h-8 text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    value={drafts[c.id] ?? ((row?.assigned ?? 0) / 100).toFixed(2)}
                    onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
                    onBlur={() => void commitDraft(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    aria-label={`Assigned to ${c.name}`}
                    disabled={busy}
                  />
                  <p className="text-right text-sm text-muted-foreground">{formatZAR(row?.spent ?? 0)}</p>
                  <p className={`text-right text-sm font-medium ${available < 0 ? 'text-red-600' : available > 0 ? 'text-green-600' : ''}`}>
                    {formatZAR(available)}
                  </p>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing({ categoryId: c.id, name: c.name })} aria-label={`Automation for ${c.name}`}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AutomationDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categoryName={editing?.name ?? ''}
        budget={editing ? budgetFor(editing.categoryId) : undefined}
        goals={goals}
        onSave={(settings) => saveAutomation(editing!.categoryId, editing!.name, settings)}
      />
    </div>
  );
}
