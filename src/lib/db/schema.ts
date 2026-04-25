// TypeScript interfaces for RandTracker data models

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'cheque' | 'savings' | 'cash' | 'credit_card' | 'loan' | 'store_card' | 'investment';
  currency: string;
  initial_balance: number; // In cents
  current_balance: number; // Calculated from transactions
  is_primary: boolean;
  icon: string;
  color: string;
  group_name?: string;

  // Credit card specific
  credit_limit?: number;
  statement_day?: number;
  payment_due_day?: number;
  interest_rate?: number;
  minimum_payment_percentage?: number;

  // Loan specific
  loan_principal?: number;
  loan_interest_rate?: number;
  loan_term_months?: number;
  loan_start_date?: string;
  monthly_instalment?: number;

  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  synced_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // In cents, always positive
  category_id: string;
  subcategory_id?: string;
  title: string;
  notes?: string;
  date: string; // ISO date
  time?: string;

  // Recurring
  is_recurring: boolean;
  recurrence_rule?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    interval?: number;
    end_date?: string;
    day_of_month?: number;
  };
  is_subscription: boolean;

  // Transfer specific
  transfer_account_id?: string;
  linked_transaction_id?: string;

  // Debt specific
  is_debt_payment: boolean;
  debt_id?: string;
  principal_portion?: number;
  interest_portion?: number;

  // Split transaction
  splits?: {
    category_id: string;
    amount: number;
    notes?: string;
  }[];

  // Metadata
  attachment_url?: string;
  tags?: string[];
  is_paid: boolean;
  exclude_from_budget: boolean;

  created_at: string;
  updated_at: string;
  synced_at?: string;
  is_deleted: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  emoji?: string;
  color: string;
  type: 'income' | 'expense';
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  icon?: string;
  sort_order: number;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  category_id?: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom';
  start_date: string;
  end_date?: string;
  rollover_unused: boolean;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  total_amount: number;
  current_balance: number;
  interest_rate?: number;
  minimum_payment?: number;
  payment_day?: number;
  term_months?: number;
  payoff_strategy?: 'snowball' | 'avalanche' | 'custom';
  priority_order?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  type?: 'saving' | 'debt_payoff';
  target_amount: number;
  current_amount: number;
  target_date?: string;
  deadline?: string;
  icon: string;
  color: string;
  account_id?: string;
  linked_account_id?: string;
  linked_debt_id?: string;
  monthly_contribution?: number;
  is_achieved: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id?: number;
  user_id?: string;
  table: string;
  record_id: string;
  operation: 'insert' | 'update' | 'delete';
  data?: unknown;
  synced: boolean;
  created_at: string;
  attempts?: number;
  last_error?: string;
}

export interface UserProfile {
  id: string;
  display_name?: string;
  currency: string;
  payday_date: number;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
}
