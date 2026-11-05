'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { LineChart } from '@/components/analytics/LineChart';
import { CashFlowChart } from '@/components/reports/CashFlowChart';
import { MoneyFlowChart } from '@/components/reports/MoneyFlowChart';
import { CalendarView } from '@/components/reports/CalendarView';
import { formatZAR } from '@/lib/currency';
import { calendarMonth, downloadReport, moneyFlow } from '@/lib/reports/reports';
import { addMonths } from '@/lib/schedules/dates';
import { cycleLabel, previousCycleStart } from '@/lib/budget/cycles';
import {
  fetchBudgetMonth,
  fetchCashFlow,
  fetchNetWorth,
  fetchSpendingCompared,
  type BudgetMonth,
  type CashFlowRow,
  type NetWorthRow,
  type SpendingComparedRow,
} from '@/lib/supabase/data';
import { useUserStore } from '@/stores/userStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useScheduleStore } from '@/stores/scheduleStore';

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function DownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} title="Download CSV">
      <Download className="h-4 w-4" />
      <span className="sr-only">Download CSV</span>
    </Button>
  );
}

export default function ReportsPage() {
  const user = useUserStore((s) => s.user);
  const { categories, loadCategories } = useCategoryStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { schedules, loadSchedules } = useScheduleStore();

  const [months, setMonths] = useState(6);
  const [by, setBy] = useState<'month' | 'cycle'>('month');
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthRow[]>([]);
  const [compared, setCompared] = useState<SpendingComparedRow[]>([]);
  const [cycles, setCycles] = useState<BudgetMonth[]>([]);
  const [calendarDate, setCalendarDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  const from = addMonths(`${today.slice(0, 7)}-01`, -(months - 1));

  useEffect(() => {
    if (!user) return;
    void loadCategories(user.id);
    void loadTransactions(user.id);
    void loadSchedules(user.id);
  }, [user, loadCategories, loadTransactions, loadSchedules]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [flow, worth, comp, current] = await Promise.all([
          fetchCashFlow(from, today, by),
          fetchNetWorth(months),
          fetchSpendingCompared(today),
          fetchBudgetMonth(today),
        ]);
        // The budget month needs one call per cycle; the last six are enough to compare.
        const starts = [current.cycle_start];
        for (let i = 1; i < 6; i++) starts.push(previousCycleStart(current.payday, starts[i - 1]));
        const previous = await Promise.all(starts.slice(1).map((s) => fetchBudgetMonth(s)));
        if (cancelled) return;
        setCashFlow(flow);
        setNetWorth(worth);
        setCompared(comp);
        setCycles([current, ...previous].reverse());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Transactions are a dependency so reports refresh after changes elsewhere.
  }, [user, from, today, by, months, transactions]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Deleted category';
  const flowLinks = useMemo(() => moneyFlow(transactions, from, today, categoryName), [transactions, from, today, categories]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendar = useMemo(() => calendarMonth(calendarDate, transactions, schedules, today), [calendarDate, transactions, schedules, today]);
  const comparedSorted = [...compared].sort((a, b) => b.this_cycle - a.this_cycle);
  const latestWorth = netWorth[netWorth.length - 1];
  const payday = cycles[0]?.payday ?? user?.payday_date ?? 25;
  const periodLabel = (row: CashFlowRow) => (by === 'cycle' ? row.period_start.slice(5) : monthLabel(row.period_start));

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Cash flow, net worth and where your money goes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select className="w-auto" value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period">
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 2 years</option>
          </Select>
          <Select className="w-auto" value={by} onChange={(e) => setBy(e.target.value as 'month' | 'cycle')} aria-label="Group by">
            <option value="month">By month</option>
            <option value="cycle">By payday cycle</option>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Cash flow</CardTitle>
              <CardDescription>
                Money in and out, transfers left out.
                {cashFlow.length > 0 && ` Over the period: ${formatZAR(cashFlow[cashFlow.length - 1].cumulative)} net.`}
              </CardDescription>
            </div>
            <DownloadButton onClick={() => downloadReport('cash-flow', cashFlow as unknown as Record<string, unknown>[], ['income', 'expenses', 'net', 'cumulative'])} />
          </CardHeader>
          <CardContent>
            <CashFlowChart rows={cashFlow} label={periodLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Net worth</CardTitle>
              <CardDescription>
                {latestWorth
                  ? `${formatZAR(latestWorth.net_worth)} now: ${formatZAR(latestWorth.assets)} in accounts, ${formatZAR(latestWorth.liabilities)} owed.`
                  : 'Account balances at the end of each month.'}{' '}
                Investments aren&apos;t included.
              </CardDescription>
            </div>
            <DownloadButton onClick={() => downloadReport('net-worth', netWorth as unknown as Record<string, unknown>[], ['assets', 'liabilities', 'net_worth'])} />
          </CardHeader>
          <CardContent>
            <LineChart
              data={netWorth.map((r) => ({ label: monthLabel(r.month_end), value: r.net_worth / 100 }))}
              height={220}
              formatValue={(v) => formatZAR(Math.round(v * 100))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Where the money went</CardTitle>
            <CardDescription>Income by source, then spending by category, over the period.</CardDescription>
          </div>
          <DownloadButton onClick={() => downloadReport('money-flow', flowLinks as unknown as Record<string, unknown>[], ['amount'])} />
        </CardHeader>
        <CardContent>
          <MoneyFlowChart links={flowLinks} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Spending compared</CardTitle>
              <CardDescription>This payday cycle against the last one and the average of the three before.</CardDescription>
            </div>
            <DownloadButton
              onClick={() =>
                downloadReport(
                  'spending-compared',
                  comparedSorted.map((r) => ({ category: categoryName(r.category_id), this_cycle: r.this_cycle, last_cycle: r.last_cycle, average_3: r.average_3 })),
                  ['this_cycle', 'last_cycle', 'average_3']
                )
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            {comparedSorted.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No spending in recent cycles.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="p-2 sm:p-3 text-left font-medium">Category</th>
                    <th className="p-2 sm:p-3 text-right font-medium">This cycle</th>
                    <th className="p-2 sm:p-3 text-right font-medium">Last</th>
                    <th className="p-2 sm:p-3 text-right font-medium">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comparedSorted.map((r) => {
                    const up = r.average_3 > 0 && r.this_cycle > r.average_3 * 1.1;
                    return (
                      <tr key={r.category_id}>
                        <td className="p-2 sm:p-3">{categoryName(r.category_id)}</td>
                        <td className={`p-3 text-right font-medium ${up ? 'text-red-600' : ''}`}>{formatZAR(r.this_cycle)}{up ? ' ▲' : ''}</td>
                        <td className="p-2 sm:p-3 text-right text-muted-foreground">{formatZAR(r.last_cycle)}</td>
                        <td className="p-2 sm:p-3 text-right text-muted-foreground">{formatZAR(r.average_3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Budget analysis</CardTitle>
              <CardDescription>The last six payday cycles of the budget month.</CardDescription>
            </div>
            <DownloadButton
              onClick={() =>
                downloadReport(
                  'budget-analysis',
                  cycles.map((c) => ({
                    cycle_start: c.cycle_start,
                    cycle_end: c.cycle_end,
                    income: c.income,
                    assigned: c.assigned,
                    spent: c.categories.reduce((s, x) => s + x.spent, 0),
                    left_to_budget: c.to_budget,
                  })),
                  ['income', 'assigned', 'spent', 'left_to_budget']
                )
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 sm:p-3 text-left font-medium">Cycle</th>
                  <th className="p-2 sm:p-3 text-right font-medium">Assigned</th>
                  <th className="p-2 sm:p-3 text-right font-medium">Spent</th>
                  <th className="p-2 sm:p-3 text-right font-medium">Left to budget</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cycles.map((c) => {
                  const spent = c.categories.reduce((s, x) => s + x.spent, 0);
                  return (
                    <tr key={c.cycle_start}>
                      <td className="p-2 sm:p-3">{cycleLabel(payday, c.cycle_start)}</td>
                      <td className="p-2 sm:p-3 text-right">{formatZAR(c.assigned)}</td>
                      <td className={`p-3 text-right ${spent > c.assigned ? 'text-red-600' : ''}`}>{formatZAR(spent)}</td>
                      <td className={`p-3 text-right ${c.to_budget < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{formatZAR(c.to_budget)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Daily spending, and scheduled payments still to come.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCalendarDate(addMonths(calendarDate, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="w-28 text-center text-sm font-medium">{new Date(`${calendarDate}T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
            <Button variant="outline" size="sm" onClick={() => setCalendarDate(addMonths(calendarDate, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <CalendarView days={calendar} today={today} />
        </CardContent>
      </Card>
    </div>
  );
}
