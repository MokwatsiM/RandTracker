'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/analytics/LineChart';
import { CashFlowChart } from '@/components/reports/CashFlowChart';
import { UpcomingSchedules } from '@/components/schedules/UpcomingSchedules';
import { formatZAR, formatTransactionAmount } from '@/lib/currency';
import { calculatePayoffPlan } from '@/lib/calculations/snowball';
import { monthsUntil } from '@/lib/reports/reports';
import { addMonths } from '@/lib/schedules/dates';
import type { WidgetInfo } from '@/lib/reports/layout';
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
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { useInvestmentStore } from '@/stores/investmentStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUserStore } from '@/stores/userStore';

export const WIDGETS: WidgetInfo[] = [
  { id: 'summary', title: 'Summary', defaultSize: 'full' },
  { id: 'coming-up', title: 'Coming up', defaultSize: 'half' },
  { id: 'budget', title: 'Budget month', defaultSize: 'half' },
  { id: 'cash-flow', title: 'Cash flow', defaultSize: 'half' },
  { id: 'net-worth', title: 'Net worth', defaultSize: 'half' },
  { id: 'recent', title: 'Recent transactions', defaultSize: 'half' },
  { id: 'spending', title: 'Spending compared', defaultSize: 'half' },
  { id: 'debt-free', title: 'Debt-free date', defaultSize: 'half' },
  { id: 'tfsa', title: 'TFSA room', defaultSize: 'half' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const LIABILITIES = ['credit_card', 'loan', 'store_card'];

function Widget({ title, description, link, children }: { title: string; description?: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {link && <Link href={link.href} className="text-sm underline">{link.label}</Link>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Loads a report once, and again when transactions change. */
function useReport<T>(load: () => Promise<T>, initial: T): T {
  const transactions = useTransactionStore((s) => s.transactions);
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let cancelled = false;
    load().then((v) => !cancelled && setValue(v)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

function SummaryWidget() {
  const accounts = useAccountStore((s) => s.accounts);
  const getTotalBalance = useAccountStore((s) => s.getTotalBalance);
  const { getMonthlyIncome, getMonthlyExpenses } = useTransactionStore();
  // Debts are stored as negative balances (migration 007).
  const debtAccounts = accounts.filter((a) => LIABILITIES.includes(a.type) && a.current_balance < 0);
  const totalDebt = debtAccounts.reduce((sum, a) => sum - a.current_balance, 0);
  const total = getTotalBalance();
  const stats = [
    { label: 'Net worth', value: formatZAR(total), note: `${accounts.length} account${accounts.length === 1 ? '' : 's'}`, icon: Wallet, tone: total < 0 ? 'text-red-600' : '' },
    { label: 'Income (month)', value: formatZAR(getMonthlyIncome(new Date())), note: 'This month', icon: ArrowUpRight, tone: 'text-green-600' },
    { label: 'Expenses (month)', value: formatZAR(getMonthlyExpenses(new Date())), note: 'This month', icon: ArrowDownRight, tone: 'text-red-600' },
    { label: 'Total debt', value: formatZAR(totalDebt), note: `${debtAccounts.length} account${debtAccounts.length === 1 ? '' : 's'} with debt`, icon: TrendingDown, tone: '' },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
            <p className="text-xs text-muted-foreground">{s.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ComingUpWidget() {
  const user = useUserStore((s) => s.user);
  const loadSchedules = useScheduleStore((s) => s.loadSchedules);
  useEffect(() => {
    if (user) void loadSchedules(user.id);
  }, [user, loadSchedules]);
  return (
    <Widget title="Coming up" description="The next 7 days" link={{ href: '/dashboard/schedules', label: 'Schedules' }}>
      <UpcomingSchedules days={7} limit={6} />
    </Widget>
  );
}

function BudgetWidget() {
  const month = useReport<BudgetMonth | null>(() => fetchBudgetMonth(todayIso()), null);
  if (!month) return <Widget title="Budget month">Loading...</Widget>;
  const spent = month.categories.reduce((s, c) => s + c.spent, 0);
  const over = month.categories.filter((c) => c.available < 0).length;
  return (
    <Widget title="Budget month" description={`${month.cycle_start} to ${month.cycle_end}`} link={{ href: '/dashboard/budgets', label: 'Budget' }}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-xs text-muted-foreground">Assigned</p><p className="font-bold">{formatZAR(month.assigned)}</p></div>
        <div><p className="text-xs text-muted-foreground">Spent</p><p className="font-bold">{formatZAR(spent)}</p></div>
        <div><p className="text-xs text-muted-foreground">{month.to_budget < 0 ? 'Over-assigned' : 'Left to budget'}</p><p className={`font-bold ${month.to_budget < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatZAR(Math.abs(month.to_budget))}</p></div>
      </div>
      {over > 0 && <p className="mt-3 text-sm text-red-600">{over} categor{over === 1 ? 'y is' : 'ies are'} overspent.</p>}
    </Widget>
  );
}

function CashFlowWidget() {
  const today = todayIso();
  const rows = useReport<CashFlowRow[]>(() => fetchCashFlow(addMonths(`${today.slice(0, 7)}-01`, -5), today, 'month'), []);
  return (
    <Widget title="Cash flow" description="Last 6 months" link={{ href: '/dashboard/reports', label: 'Reports' }}>
      <CashFlowChart rows={rows} height={180} label={(r) => new Date(`${r.period_start}T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', timeZone: 'UTC' })} />
    </Widget>
  );
}

function NetWorthWidget() {
  const rows = useReport<NetWorthRow[]>(() => fetchNetWorth(12), []);
  const latest = rows[rows.length - 1];
  return (
    <Widget title="Net worth" description={latest ? `${formatZAR(latest.net_worth)} now` : 'Last 12 months'} link={{ href: '/dashboard/reports', label: 'Reports' }}>
      <LineChart
        data={rows.map((r) => ({ label: new Date(`${r.month_end}T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', timeZone: 'UTC' }), value: r.net_worth / 100 }))}
        height={180}
        formatValue={(v) => formatZAR(Math.round(v * 100))}
      />
    </Widget>
  );
}

function RecentWidget() {
  const transactions = useTransactionStore((s) => s.transactions);
  const categories = useCategoryStore((s) => s.categories);
  const accounts = useAccountStore((s) => s.accounts);
  return (
    <Widget title="Recent transactions" link={{ href: '/dashboard/transactions', label: 'View all' }}>
      <div className="space-y-3">
        {transactions.slice(0, 5).map((t) => {
          const { text, className } = formatTransactionAmount(t.amount, t.type);
          return (
            <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.title || categories.find((c) => c.id === t.category_id)?.name || 'Transaction'}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(t.date), 'd MMM yyyy')} · {accounts.find((a) => a.id === t.account_id)?.name}</p>
              </div>
              <span className={`font-semibold ${className}`}>{text}</span>
            </div>
          );
        })}
        {transactions.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
      </div>
    </Widget>
  );
}

function SpendingWidget() {
  const categories = useCategoryStore((s) => s.categories);
  const rows = useReport<SpendingComparedRow[]>(() => fetchSpendingCompared(todayIso()), []);
  const top = [...rows].sort((a, b) => b.this_cycle - a.this_cycle).slice(0, 5);
  return (
    <Widget title="Spending compared" description="This cycle against your 3-cycle average" link={{ href: '/dashboard/reports', label: 'Reports' }}>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spending in recent cycles.</p>
      ) : (
        <div className="space-y-2">
          {top.map((r) => {
            const ratio = r.average_3 > 0 ? r.this_cycle / r.average_3 : null;
            return (
              <div key={r.category_id} className="flex items-center justify-between text-sm">
                <span className="truncate">{categories.find((c) => c.id === r.category_id)?.name ?? 'Category'}</span>
                <span className={ratio !== null && ratio > 1.1 ? 'font-medium text-red-600' : ''}>
                  {formatZAR(r.this_cycle)}
                  <span className="ml-2 text-xs text-muted-foreground">avg {formatZAR(r.average_3)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

function DebtFreeWidget() {
  const user = useUserStore((s) => s.user);
  const { debts, loadDebts } = useDebtStore();
  useEffect(() => {
    if (user) void loadDebts(user.id);
  }, [user, loadDebts]);
  const plan = useMemo(() => {
    const active = debts.filter((d) => d.is_active && d.current_balance > 0);
    return active.length ? calculatePayoffPlan(active, 'avalanche') : null;
  }, [debts]);
  return (
    <Widget title="Debt-free date" description="Paying minimums, highest interest first" link={{ href: '/dashboard/debts', label: 'Debts' }}>
      {!plan ? (
        <p className="text-sm text-muted-foreground">No active debts. 🎉</p>
      ) : plan.total_months >= 600 ? (
        <p className="text-sm text-amber-600">The minimum payments don&apos;t cover the interest, so these debts won&apos;t be paid off. Check them on the Debts page.</p>
      ) : (
        <div>
          <p className="text-2xl font-bold">{format(plan.debt_free_date, 'MMMM yyyy')}</p>
          <p className="text-sm text-muted-foreground">
            In {monthsUntil(new Date(), plan.debt_free_date)} months, with {formatZAR(plan.total_interest)} interest still to pay.
          </p>
        </div>
      )}
    </Widget>
  );
}

function TfsaWidget() {
  const user = useUserStore((s) => s.user);
  const { investments, loadInvestments } = useInvestmentStore();
  useEffect(() => {
    if (user) void loadInvestments(user.id);
  }, [user, loadInvestments]);
  const tfsas = investments.filter((i) => i.is_tfsa);
  // Limits are per person, so the largest limit recorded applies across all TFSAs.
  const annualLimit = Math.max(0, ...tfsas.map((i) => i.tfsa_annual_limit ?? 0));
  const lifetimeLimit = Math.max(0, ...tfsas.map((i) => i.tfsa_lifetime_limit ?? 0));
  const thisYear = tfsas.reduce((s, i) => s + (i.tfsa_current_year_contribution ?? 0), 0);
  const lifetime = tfsas.reduce((s, i) => s + (i.tfsa_lifetime_contribution ?? 0), 0);
  return (
    <Widget title="TFSA room" description="Tax-free savings left to contribute" link={{ href: '/dashboard/investments', label: 'Investments' }}>
      {tfsas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tax-free savings accounts yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-xs text-muted-foreground">This tax year</p><p className="text-xl font-bold">{formatZAR(Math.max(0, annualLimit - thisYear))}</p></div>
          <div><p className="text-xs text-muted-foreground">Lifetime</p><p className="text-xl font-bold">{formatZAR(Math.max(0, lifetimeLimit - lifetime))}</p></div>
        </div>
      )}
    </Widget>
  );
}

export function renderWidget(id: string) {
  switch (id) {
    case 'summary': return <SummaryWidget />;
    case 'coming-up': return <ComingUpWidget />;
    case 'budget': return <BudgetWidget />;
    case 'cash-flow': return <CashFlowWidget />;
    case 'net-worth': return <NetWorthWidget />;
    case 'recent': return <RecentWidget />;
    case 'spending': return <SpendingWidget />;
    case 'debt-free': return <DebtFreeWidget />;
    case 'tfsa': return <TfsaWidget />;
    default: return null;
  }
}

export function GettingStarted({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>Set up your accounts and start tracking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{hasAccounts ? '✓' : '1.'} Add your bank accounts, cash and cards.</p>
        {!hasAccounts && <Link href="/dashboard/accounts"><Button variant="outline" size="sm">Go to Accounts</Button></Link>}
        <p>2. Import a statement or add your first transaction with the + button.</p>
      </CardContent>
    </Card>
  );
}
