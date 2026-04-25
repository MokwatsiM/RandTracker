import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: 'tfsa' | 'unit_trust' | 'etf' | 'stock' | 'fixed_deposit' | 'savings_account' | 'retirement_annuity' | 'other';
  provider?: string;
  linked_account_id?: string;

  // Financial
  initial_amount: number;
  current_value: number;
  total_contributions: number;
  total_withdrawals: number;

  // Interest/Returns
  interest_rate?: number;
  is_compound_interest: boolean;
  compound_frequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';

  // TFSA
  is_tfsa: boolean;
  tfsa_annual_limit?: number;
  tfsa_year_start_date?: string;
  tfsa_year_end_date?: string;
  tfsa_current_year_contribution?: number;
  tfsa_lifetime_contribution?: number;
  tfsa_lifetime_limit?: number;

  // Fixed Deposit
  is_fixed_deposit: boolean;
  fixed_deposit_term_months?: number;
  fixed_deposit_start_date?: string;
  fixed_deposit_maturity_date?: string;
  fixed_deposit_auto_renew?: boolean;

  // Performance
  purchase_price?: number;
  current_price?: number;
  units_held?: number;

  // Metadata
  currency: string;
  icon: string;
  color: string;
  notes?: string;
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface InvestmentTransaction {
  id: string;
  user_id: string;
  investment_id: string;
  type: 'contribution' | 'withdrawal' | 'dividend' | 'interest' | 'fee' | 'rebalance' | 'transfer_in' | 'transfer_out';
  amount: number;
  units?: number;
  price_per_unit?: number;
  date: string;
  description?: string;
  related_transaction_id?: string;
  bank_transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentPerformance {
  total_invested: number;
  current_value: number;
  total_gain_loss: number;
  gain_loss_percentage: number;
  total_contributions: number;
  total_withdrawals: number;
  total_dividends: number;
  total_fees: number;
}

interface InvestmentStore {
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadInvestments: (userId: string) => Promise<void>;
  loadInvestmentTransactions: (investmentId: string) => Promise<void>;
  createInvestment: (investment: Partial<Investment>) => Promise<Investment | null>;
  updateInvestment: (id: string, updates: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;

  // Investment Transactions
  createInvestmentTransaction: (transaction: Partial<InvestmentTransaction>) => Promise<InvestmentTransaction | null>;
  updateInvestmentTransaction: (id: string, updates: Partial<InvestmentTransaction>) => Promise<void>;
  deleteInvestmentTransaction: (id: string) => Promise<void>;

  // Performance
  getInvestmentPerformance: (investmentId: string) => Promise<InvestmentPerformance | null>;
  getTotalPortfolioValue: () => number;
  getTotalPortfolioGains: () => number;
}

export const useInvestmentStore = create<InvestmentStore>((set, get) => ({
  investments: [],
  investmentTransactions: [],
  isLoading: false,
  error: null,

  loadInvestments: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ investments: data || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  loadInvestmentTransactions: async (investmentId: string) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('investment_transactions')
        .select('*')
        .eq('investment_id', investmentId)
        .order('date', { ascending: false });

      if (error) throw error;

      set({ investmentTransactions: data || [] });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  createInvestment: async (investmentData) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('investments')
        .insert([investmentData])
        .select()
        .single();

      if (error) throw error;

      set(state => ({ investments: [data, ...state.investments] }));
      return data;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  updateInvestment: async (id, updates) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('investments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        investments: state.investments.map(inv =>
          inv.id === id ? { ...inv, ...updates } : inv
        )
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteInvestment: async (id) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('investments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        investments: state.investments.filter(inv => inv.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  createInvestmentTransaction: async (transactionData) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('investment_transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) throw error;

      // Reload investment to get updated totals
      if (transactionData.investment_id) {
        const { data: investmentData } = await supabase
          .from('investments')
          .select('*')
          .eq('id', transactionData.investment_id)
          .single();

        if (investmentData) {
          set(state => ({
            investments: state.investments.map(inv =>
              inv.id === transactionData.investment_id ? investmentData : inv
            ),
            investmentTransactions: [data, ...state.investmentTransactions]
          }));
        }
      }

      return data;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  updateInvestmentTransaction: async (id, updates) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('investment_transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        investmentTransactions: state.investmentTransactions.map(tx =>
          tx.id === id ? { ...tx, ...updates } : tx
        )
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteInvestmentTransaction: async (id) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('investment_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        investmentTransactions: state.investmentTransactions.filter(tx => tx.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  getInvestmentPerformance: async (investmentId: string) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .rpc('calculate_investment_performance', { investment_uuid: investmentId });

      if (error) throw error;

      return data?.[0] || null;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  getTotalPortfolioValue: () => {
    return get().investments.reduce((total, inv) => total + inv.current_value, 0);
  },

  getTotalPortfolioGains: () => {
    return get().investments.reduce((total, inv) => {
      const gains = inv.current_value - inv.total_contributions;
      return total + gains;
    }, 0);
  }
}));
