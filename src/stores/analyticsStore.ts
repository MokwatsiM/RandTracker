import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface SpendingByCategory {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  transaction_type: 'income' | 'expense';
  transaction_count: number;
  total_amount: number;
  average_amount: number;
}

export interface MonthlySummary {
  month: string;
  total_income: number;
  total_expenses: number;
  net_income: number;
  income_transaction_count: number;
  expense_transaction_count: number;
  total_transaction_count: number;
}

export interface DailyBalance {
  date: string;
  daily_change: number;
  cumulative_balance: number;
}

export interface NetWorthSummary {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  total_investments: number;
  total_debt: number;
}

export interface BudgetPerformance {
  budget_id: string;
  budget_name: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  budget_amount: number;
  spent_amount: number;
  remaining_amount: number;
  usage_percentage: number;
  period: string;
  start_date: string;
  end_date: string;
}

export interface TopMerchant {
  merchant_name: string;
  category_name: string;
  category_icon: string;
  transaction_count: number;
  total_spent: number;
  average_transaction: number;
  first_transaction: string;
  last_transaction: string;
}

export interface IncomeSource {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  transaction_count: number;
  total_income: number;
  average_income: number;
}

export interface SpendingTrend {
  period: string;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface SavingsRate {
  total_income: number;
  total_expenses: number;
  total_saved: number;
  savings_rate: number;
}

// ============================================================================
// STORE
// ============================================================================

interface AnalyticsStore {
  // State
  spendingByCategory: SpendingByCategory[];
  monthlySummary: MonthlySummary[];
  dailyBalance: DailyBalance[];
  netWorthSummary: NetWorthSummary | null;
  budgetPerformance: BudgetPerformance[];
  topMerchants: TopMerchant[];
  incomeSources: IncomeSource[];
  isLoading: boolean;
  error: string | null;

  // Actions - Views
  loadSpendingByCategory: (userId: string) => Promise<void>;
  loadMonthlySummary: (userId: string, months?: number) => Promise<void>;
  loadDailyBalance: (userId: string) => Promise<void>;
  loadNetWorthSummary: (userId: string) => Promise<void>;
  loadBudgetPerformance: (userId: string) => Promise<void>;
  loadTopMerchants: (userId: string, limit?: number) => Promise<void>;
  loadIncomeSources: (userId: string) => Promise<void>;

  // Actions - Functions
  getSpendingTrend: (
    userId: string,
    startDate: string,
    endDate: string,
    interval?: 'day' | 'week' | 'month'
  ) => Promise<SpendingTrend[]>;
  getCategoryBreakdown: (
    userId: string,
    startDate: string,
    endDate: string,
    type?: 'income' | 'expense'
  ) => Promise<CategoryBreakdown[]>;
  getSavingsRate: (
    userId: string,
    startDate: string,
    endDate: string
  ) => Promise<SavingsRate | null>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  // Initial State
  spendingByCategory: [],
  monthlySummary: [],
  dailyBalance: [],
  netWorthSummary: null,
  budgetPerformance: [],
  topMerchants: [],
  incomeSources: [],
  isLoading: false,
  error: null,

  // Load Spending by Category
  loadSpendingByCategory: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('spending_by_category')
        .select('*')
        .eq('user_id', userId)
        .order('total_amount', { ascending: false });

      if (error) throw error;

      set({ spendingByCategory: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Monthly Summary
  loadMonthlySummary: async (userId: string, months = 12) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('monthly_summary')
        .select('*')
        .eq('user_id', userId)
        .gte('month', startDate.toISOString())
        .order('month', { ascending: true });

      if (error) throw error;

      set({ monthlySummary: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Daily Balance
  loadDailyBalance: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('daily_balance')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) throw error;

      set({ dailyBalance: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Net Worth Summary
  loadNetWorthSummary: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('net_worth_summary')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      set({ netWorthSummary: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Budget Performance
  loadBudgetPerformance: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('budget_performance')
        .select('*')
        .eq('user_id', userId)
        .order('usage_percentage', { ascending: false });

      if (error) throw error;

      set({ budgetPerformance: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Top Merchants
  loadTopMerchants: async (userId: string, limit = 10) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('top_merchants')
        .select('*')
        .eq('user_id', userId)
        .order('total_spent', { ascending: false })
        .limit(limit);

      if (error) throw error;

      set({ topMerchants: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Load Income Sources
  loadIncomeSources: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', userId)
        .order('total_income', { ascending: false });

      if (error) throw error;

      set({ incomeSources: data || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Get Spending Trend
  getSpendingTrend: async (
    userId: string,
    startDate: string,
    endDate: string,
    interval: 'day' | 'week' | 'month' = 'day'
  ) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc('get_spending_trend', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_interval: interval,
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get spending trend:', error);
      return [];
    }
  },

  // Get Category Breakdown
  getCategoryBreakdown: async (
    userId: string,
    startDate: string,
    endDate: string,
    type: 'income' | 'expense' = 'expense'
  ) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc('get_category_breakdown', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_type: type,
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get category breakdown:', error);
      return [];
    }
  },

  // Get Savings Rate
  getSavingsRate: async (userId: string, startDate: string, endDate: string) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc('calculate_savings_rate', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw error;

      return data?.[0] || null;
    } catch (error) {
      console.error('Failed to get savings rate:', error);
      return null;
    }
  },
}));
