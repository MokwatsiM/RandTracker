export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AmountType = 'exact' | 'approx' | 'range';
/** What happens when a date falls on a weekend or South African public holiday. */
export type WeekendRule = 'none' | 'before' | 'after';

export interface Schedule {
  id: string;
  user_id: string;
  name: string;
  /** Matched against the bank description of imported transactions. */
  payee: string | null;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  transfer_account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  /** Expected amount in cents; this is what's posted. */
  amount: number;
  amount_type: AmountType;
  /** Range bounds in cents, for amount_type 'range'. */
  amount_min: number | null;
  amount_max: number | null;
  frequency: ScheduleFrequency;
  interval: number;
  /** First occurrence. Later ones are counted from it, so the 31st stays the 31st. */
  start_date: string;
  /** For monthly schedules: always the last day of the month. */
  month_end: boolean;
  /** The next occurrence not yet posted or skipped, before weekend adjustment. */
  next_date: string | null;
  end_date: string | null;
  weekend: WeekendRule;
  auto_add: boolean;
  is_subscription: boolean;
  debt_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleDraft = Omit<Schedule, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
