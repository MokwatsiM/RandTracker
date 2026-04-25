'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, Calendar } from 'lucide-react';
import { useAnalyticsStore, type CategoryBreakdown, type SpendingTrend } from '@/stores/analyticsStore';
import { useUserStore } from '@/stores/userStore';
import { PieChart } from '@/components/analytics/PieChart';
import { BarChart } from '@/components/analytics/BarChart';
import { LineChart } from '@/components/analytics/LineChart';
import { formatZAR } from '@/lib/currency';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function AnalyticsPage() {
  const user = useUserStore((state) => state.user);
  const {
    monthlySummary,
    netWorthSummary,
    budgetPerformance,
    topMerchants,
    incomeSources,
    loadMonthlySummary,
    loadNetWorthSummary,
    loadBudgetPerformance,
    loadTopMerchants,
    loadIncomeSources,
    getCategoryBreakdown,
    getSpendingTrend,
    getSavingsRate,
  } = useAnalyticsStore();

  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '12m'>('3m');
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>([]);
  const [spendingTrend, setSpendingTrend] = useState<SpendingTrend[]>([]);
  const [savingsRate, setSavingsRate] = useState<number>(0);

  useEffect(() => {
    if (user) {
      const months = timeRange === '1m' ? 1 : timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;

      loadMonthlySummary(user.id, months);
      loadNetWorthSummary(user.id);
      loadBudgetPerformance(user.id);
      loadTopMerchants(user.id, 5);
      loadIncomeSources(user.id);

      // Calculate date range
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(new Date(), months - 1));

      // Load breakdown data
      getCategoryBreakdown(
        user.id,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        'expense'
      ).then(setExpenseBreakdown);

      getCategoryBreakdown(
        user.id,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        'income'
      ).then(setIncomeBreakdown);

      // Load spending trend
      getSpendingTrend(
        user.id,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        'month'
      ).then(setSpendingTrend);

      // Load savings rate
      getSavingsRate(
        user.id,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      ).then((data) => {
        if (data) {
          setSavingsRate(data.savings_rate);
        }
      });
    }
  }, [user, timeRange]);

  if (!user) {
    return null;
  }

  // Calculate totals for the selected period
  const periodTotals = monthlySummary.reduce(
    (acc, month) => ({
      income: acc.income + Number(month.total_income),
      expenses: acc.expenses + Number(month.total_expenses),
      net: acc.net + Number(month.net_income),
    }),
    { income: 0, expenses: 0, net: 0 }
  );

  // Prepare chart data
  const expensePieData = expenseBreakdown.slice(0, 8).map((cat) => ({
    label: cat.category_name,
    value: Number(cat.total_amount),
    color: cat.category_color,
  }));

  const incomePieData = incomeBreakdown.map((cat) => ({
    label: cat.category_name,
    value: Number(cat.total_amount),
    color: cat.category_color,
  }));

  const monthlyTrendData = monthlySummary.map((month) => ({
    label: format(new Date(month.month), 'MMM'),
    value: Number(month.net_income),
  }));

  const expenseBarData = expenseBreakdown.slice(0, 10).map((cat) => ({
    label: cat.category_name,
    value: Number(cat.total_amount),
    color: cat.category_color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Insights into your spending and financial trends</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '1m' | '3m' | '6m' | '12m')}
          >
            <option value="1m">Last Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(netWorthSummary?.net_worth || 0) < 0 ? 'text-red-600' : ''}`}>
              {formatZAR(netWorthSummary?.net_worth || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Assets: {formatZAR(netWorthSummary?.total_assets || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatZAR(periodTotals.income)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlySummary.length} months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatZAR(periodTotals.expenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlySummary.reduce((sum, m) => sum + m.expense_transaction_count, 0)} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${savingsRate < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {savingsRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saved: {formatZAR(periodTotals.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Income vs Expenses Trend */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
            <CardDescription>Monthly net income over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrendData.length > 0 ? (
              <LineChart
                data={monthlyTrendData}
                height={300}
                color="#10b981"
                fillColor="#10b981"
                formatValue={(v) => formatZAR(v)}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Category Breakdowns */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            {expensePieData.length > 0 ? (
              <PieChart data={expensePieData} size={300} showLegend={true} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No expense data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income Sources</CardTitle>
            <CardDescription>Your income breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {incomePieData.length > 0 ? (
              <PieChart data={incomePieData} size={300} showLegend={true} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No income data for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Top Categories Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Expense Categories</CardTitle>
          <CardDescription>Your highest spending categories</CardDescription>
        </CardHeader>
        <CardContent>
          {expenseBarData.length > 0 ? (
            <BarChart
              data={expenseBarData}
              height={300}
              showValues={true}
              formatValue={(v) => formatZAR(v)}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No expense categories found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Merchants */}
        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
            <CardDescription>Where you spend the most</CardDescription>
          </CardHeader>
          <CardContent>
            {topMerchants.length > 0 ? (
              <div className="space-y-3">
                {topMerchants.map((merchant, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{merchant.category_icon}</span>
                      <div>
                        <p className="font-medium">{merchant.merchant_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {merchant.transaction_count} transactions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatZAR(merchant.total_spent)}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg: {formatZAR(merchant.average_transaction)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No merchant data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Performance</CardTitle>
            <CardDescription>How well you're staying on track</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetPerformance.length > 0 ? (
              <div className="space-y-4">
                {budgetPerformance.slice(0, 5).map((budget) => (
                  <div key={budget.budget_id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span>{budget.category_icon}</span>
                        <span className="text-sm font-medium">{budget.category_name}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {budget.usage_percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          budget.usage_percentage > 100
                            ? 'bg-red-500'
                            : budget.usage_percentage > 80
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(budget.usage_percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatZAR(budget.spent_amount)}</span>
                      <span>{formatZAR(budget.budget_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No active budgets
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
