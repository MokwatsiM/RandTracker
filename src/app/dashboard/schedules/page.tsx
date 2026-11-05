'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pause, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScheduleDialog } from '@/components/schedules/ScheduleDialog';
import { UpcomingSchedules, formatScheduleAmount } from '@/components/schedules/UpcomingSchedules';
import { useUserStore } from '@/stores/userStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { formatZAR } from '@/lib/currency';
import { adjustForWorkingDay, describeFrequency, firstOccurrenceFrom, monthlyCost } from '@/lib/schedules/dates';
import { suggestDebtSchedules, suggestSchedules, type ScheduleSuggestion } from '@/lib/schedules/detect';
import type { Schedule, ScheduleDraft } from '@/lib/schedules/types';

export default function SchedulesPage() {
  const user = useUserStore((s) => s.user);
  const { schedules, isLoading, loadSchedules, createSchedule, updateSchedule, deleteSchedule } = useScheduleStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { loadCategories } = useCategoryStore();
  const { debts, loadDebts } = useDebtStore();
  const { transactions, loadTransactions } = useTransactionStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | undefined>();
  const [fromSuggestion, setFromSuggestion] = useState<ScheduleDraft | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadSchedules(user.id);
    void loadAccounts(user.id);
    void loadCategories(user.id);
    void loadDebts(user.id);
    void loadTransactions(user.id);
  }, [user, loadSchedules, loadAccounts, loadCategories, loadDebts, loadTransactions]);

  const suggestions: ScheduleSuggestion[] = useMemo(
    () =>
      showSuggestions
        ? [
            ...suggestDebtSchedules(debts, schedules, accounts.find((a) => a.is_primary)?.id ?? accounts[0]?.id),
            ...suggestSchedules(transactions, schedules),
          ]
        : [],
    [showSuggestions, debts, schedules, accounts, transactions]
  );

  const subscriptions = schedules.filter((s) => s.is_active && s.is_subscription && s.next_date);
  const subscriptionMonthly = subscriptions.reduce((sum, s) => sum + monthlyCost(s), 0);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';

  const openNew = (draft?: ScheduleDraft) => {
    setEditing(undefined);
    setFromSuggestion(draft);
    setDialogOpen(true);
  };

  const save = async (draft: ScheduleDraft, existing?: Schedule) => {
    if (!user) return;
    if (existing) await updateSchedule(existing.id, draft);
    else await createSchedule(user.id, draft);
    // A schedule due today is posted straight away rather than tonight.
    useScheduleStore.setState({ postedFor: null });
    await useScheduleStore.getState().postDue(user.id);
  };

  const togglePaused = async (s: Schedule) => {
    // Resuming starts from the next occurrence, so a long pause doesn't add a backlog.
    const resumeFrom = s.is_active ? s.next_date : firstOccurrenceFrom(s, new Date().toISOString().slice(0, 10));
    await updateSchedule(s.id, { is_active: !s.is_active, next_date: resumeFrom });
  };

  const remove = async (s: Schedule) => {
    if (window.confirm(`Delete "${s.name}"? Transactions it already added stay.`)) {
      await deleteSchedule(s.id);
    }
  };

  if (!user) return null;

  const sorted = [...schedules].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active) || (a.next_date ?? '9999').localeCompare(b.next_date ?? '9999')
  );

  return (
    <div className="container max-w-5xl mx-auto p-0 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Schedules</h1>
          <p className="text-muted-foreground mt-1">Debit orders, subscriptions and other payments you expect</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowSuggestions(!showSuggestions)}>
            <Search className="mr-2 h-4 w-4" />
            Find schedules
          </Button>
          <Button onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />
            New schedule
          </Button>
        </div>
      </div>

      {showSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
            <CardDescription>
              Payments that repeat in your history, and minimum payments on your debts. Check each one before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {suggestions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nothing found. Suggestions need at least three payments to the same payee at a regular interval.
              </p>
            ) : (
              <div className="divide-y">
                {suggestions.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{s.draft.name}</p>
                      <p className="text-muted-foreground">
                        {describeFrequency(s.draft)} · {formatScheduleAmount(s.draft)} · {accountName(s.draft.account_id)} ·{' '}
                        {s.reason}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openNew(s.draft)}>
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Next 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingSchedules days={30} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>{subscriptions.length} active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">{formatZAR(subscriptionMonthly)}<span className="text-sm font-normal text-muted-foreground"> a month</span></p>
            <p className="text-sm text-muted-foreground">{formatZAR(subscriptionMonthly * 12)} a year</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All schedules</CardTitle>
          <CardDescription>
            Automatic ones are added on the day (moved off weekends and public holidays if you chose that). Imported
            transactions that match a schedule are linked to it instead of being added twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && schedules.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Loading schedules...</p>
          ) : sorted.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No schedules yet. Use Find schedules to start from your history.</p>
          ) : (
            <div className="divide-y">
              {sorted.map((s) => (
                <div key={s.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center ${s.is_active ? '' : 'opacity-60'}`}>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground">
                      {describeFrequency(s)} · {formatScheduleAmount(s)} · {accountName(s.account_id)}
                      {s.type === 'transfer' && s.transfer_account_id ? ` → ${accountName(s.transfer_account_id)}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {!s.is_active
                        ? 'Paused'
                        : s.next_date
                          ? `Next: ${adjustForWorkingDay(s.next_date, s.weekend)}`
                          : 'Finished'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={s.auto_add ? 'secondary' : 'outline'}>{s.auto_add ? 'Automatic' : 'Asks first'}</Badge>
                      {s.is_subscription && <Badge variant="outline">Subscription</Badge>}
                      {s.debt_id && <Badge variant="outline">Debt payment: {debts.find((d) => d.id === s.debt_id)?.name ?? 'debt'}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => void togglePaused(s)} title={s.is_active ? 'Pause' : 'Resume'}>
                      {s.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      <span className="sr-only">{s.is_active ? 'Pause' : 'Resume'}</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setFromSuggestion(undefined); setDialogOpen(true); }} title="Edit">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void remove(s)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} schedule={editing} draft={fromSuggestion} onSave={save} />
    </div>
  );
}
