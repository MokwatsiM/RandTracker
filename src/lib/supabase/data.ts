import type { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { generateDefaultCategories } from '@/lib/db/seed';
import type {
  Account,
  Budget,
  Category,
  Debt,
  Subcategory,
  Transaction,
  UserProfile,
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/client';
import type { Rule, RuleDraft } from '@/lib/rules/types';

type RemoteUserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  currency: string | null;
  payday_date: number | null;
  rule_learning: boolean | null;
  created_at: string;
};

type RemoteCategory = {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
  color: string | null;
  is_default: boolean;
  sort_order: number | null;
  created_at: string;
};

type RemoteSubcategory = {
  id: string;
  category_id: string;
  name: string;
};

type RemoteTransaction = {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  title: string;
  notes: string | null;
  date: string;
  time: string | null;
  is_recurring: boolean;
  recurrence_frequency: Transaction['recurrence_frequency'] | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_day_of_month: number | null;
  is_subscription: boolean;
  transfer_account_id: string | null;
  linked_transaction_id: string | null;
  is_debt_payment: boolean;
  debt_id: string | null;
  principal_portion: number | null;
  interest_portion: number | null;
  attachment_url: string | null;
  tags: string[] | null;
  imported_payee: string | null;
  imported_id: string | null;
  is_paid: boolean;
  exclude_from_budget: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

type RemoteBudget = {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom';
  start_date: string;
  end_date: string | null;
  rollover_unused: boolean | null;
  alert_threshold: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type RemoteDebt = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  total_amount: number;
  current_balance: number;
  interest_rate: number | null;
  minimum_payment: number | null;
  payment_day: number | null;
  payoff_strategy: 'snowball' | 'avalanche' | 'custom' | null;
  priority_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

function getSupabaseClient() {
  return createClient();
}

// The API returns at most 1,000 rows per request, so longer lists are read in pages.
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function mapUserProfile(profile: RemoteUserProfile): UserProfile {
  return {
    id: profile.id,
    display_name: profile.full_name ?? undefined,
    currency: profile.currency ?? 'ZAR',
    payday_date: profile.payday_date ?? 25,
    theme: 'system',
    rule_learning: profile.rule_learning ?? true,
    created_at: profile.created_at,
  };
}

function mapCategory(category: RemoteCategory): Category {
  const icon = category.emoji ?? '📁';

  return {
    id: category.id,
    user_id: category.user_id,
    name: category.name,
    icon,
    emoji: icon,
    color: category.color ?? '#64748b',
    type: category.type,
    is_system: category.is_default,
    sort_order: category.sort_order ?? 0,
    created_at: category.created_at,
  };
}

function mapSubcategory(subcategory: RemoteSubcategory): Subcategory {
  return {
    id: subcategory.id,
    category_id: subcategory.category_id,
    name: subcategory.name,
    sort_order: 0,
  };
}

function mapTransaction(transaction: RemoteTransaction): Transaction {
  return {
    id: transaction.id,
    user_id: transaction.user_id,
    account_id: transaction.account_id,
    type: transaction.type,
    amount: transaction.amount,
    category_id: transaction.category_id ?? '',
    subcategory_id: transaction.subcategory_id ?? undefined,
    title: transaction.title,
    notes: transaction.notes ?? undefined,
    date: transaction.date,
    time: transaction.time ?? undefined,
    is_recurring: transaction.is_recurring,
    recurrence_frequency: transaction.recurrence_frequency ?? undefined,
    recurrence_interval: transaction.recurrence_interval ?? undefined,
    recurrence_end_date: transaction.recurrence_end_date ?? undefined,
    recurrence_day_of_month: transaction.recurrence_day_of_month ?? undefined,
    is_subscription: transaction.is_subscription,
    transfer_account_id: transaction.transfer_account_id ?? undefined,
    linked_transaction_id: transaction.linked_transaction_id ?? undefined,
    is_debt_payment: transaction.is_debt_payment,
    debt_id: transaction.debt_id ?? undefined,
    principal_portion: transaction.principal_portion ?? undefined,
    interest_portion: transaction.interest_portion ?? undefined,
    attachment_url: transaction.attachment_url ?? undefined,
    tags: transaction.tags ?? undefined,
    imported_payee: transaction.imported_payee ?? undefined,
    imported_id: transaction.imported_id ?? undefined,
    is_paid: transaction.is_paid,
    exclude_from_budget: transaction.exclude_from_budget,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
    synced_at: transaction.synced_at ?? undefined,
    is_deleted: transaction.is_deleted,
  };
}

function mapBudget(budget: RemoteBudget): Budget {
  return {
    id: budget.id,
    user_id: budget.user_id,
    name: budget.name,
    category_id: budget.category_id ?? undefined,
    amount: budget.amount,
    period: budget.period,
    start_date: budget.start_date,
    end_date: budget.end_date ?? undefined,
    rollover_unused: budget.rollover_unused ?? false,
    alert_threshold: budget.alert_threshold ?? 80,
    is_active: budget.is_active ?? true,
    created_at: budget.created_at,
    updated_at: budget.updated_at,
  };
}

function mapDebt(debt: RemoteDebt): Debt {
  return {
    id: debt.id,
    user_id: debt.user_id,
    account_id: debt.account_id ?? undefined,
    name: debt.name,
    total_amount: debt.total_amount,
    current_balance: debt.current_balance,
    interest_rate: debt.interest_rate ?? undefined,
    minimum_payment: debt.minimum_payment ?? undefined,
    payment_day: debt.payment_day ?? undefined,
    payoff_strategy: debt.payoff_strategy ?? undefined,
    priority_order: debt.priority_order ?? undefined,
    is_active: debt.is_active ?? true,
    created_at: debt.created_at,
    updated_at: debt.updated_at,
  };
}

function toRemoteTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    user_id: transaction.user_id,
    account_id: transaction.account_id,
    type: transaction.type,
    amount: transaction.amount,
    category_id: transaction.category_id || null,
    subcategory_id: transaction.subcategory_id ?? null,
    title: transaction.title,
    notes: transaction.notes ?? null,
    date: transaction.date,
    time: transaction.time ?? null,
    is_recurring: transaction.is_recurring,
    recurrence_frequency: transaction.recurrence_frequency ?? null,
    recurrence_interval: transaction.recurrence_interval ?? null,
    recurrence_end_date: transaction.recurrence_end_date ?? null,
    recurrence_day_of_month: transaction.recurrence_day_of_month ?? null,
    is_subscription: transaction.is_subscription,
    transfer_account_id: transaction.transfer_account_id ?? null,
    linked_transaction_id: transaction.linked_transaction_id ?? null,
    is_debt_payment: transaction.is_debt_payment,
    debt_id: transaction.debt_id ?? null,
    principal_portion: transaction.principal_portion ?? null,
    interest_portion: transaction.interest_portion ?? null,
    attachment_url: transaction.attachment_url ?? null,
    tags: transaction.tags ?? null,
    imported_payee: transaction.imported_payee ?? null,
    imported_id: transaction.imported_id ?? null,
    is_paid: transaction.is_paid,
    exclude_from_budget: transaction.exclude_from_budget,
    is_deleted: transaction.is_deleted,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
    synced_at: transaction.synced_at ?? null,
  };
}

export async function ensureUserProfile(authUser: User): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const fullName =
    typeof authUser.user_metadata.full_name === 'string'
      ? authUser.user_metadata.full_name
      : typeof authUser.user_metadata.name === 'string'
        ? authUser.user_metadata.name
        : authUser.email ?? 'RandTracker User';

  // Runs on every sign-in, so the defaults only apply to a profile that doesn't exist yet.
  // Updating here would reset the user's payday, currency and name each time.
  const { error: insertError } = await supabase.from('user_profiles').upsert(
    {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: fullName,
      currency: 'ZAR',
      payday_date: 25,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  if (insertError) {
    throw insertError;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single<RemoteUserProfile>();

  if (error) {
    throw error;
  }

  return mapUserProfile(data);
}

export async function updateUserProfile(profileId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      full_name: updates.display_name,
      currency: updates.currency,
      payday_date: updates.payday_date,
      rule_learning: updates.rule_learning,
    })
    .eq('id', profileId)
    .select('*')
    .single<RemoteUserProfile>();

  if (error) {
    throw error;
  }

  return mapUserProfile(data);
}

export async function fetchAccounts(userId: string): Promise<Account[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .returns<Account[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createAccountRecord(
  account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'current_balance'>
): Promise<Account> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const payload: Account = {
    ...account,
    id: uuidv4(),
    current_balance: account.initial_balance,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('accounts').insert(payload).select('*').single<Account>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateAccountRecord(id: string, updates: Partial<Account>): Promise<Account> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single<Account>();

  if (error) {
    throw error;
  }

  return data;
}

export async function archiveAccountRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('accounts')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function setPrimaryAccountRecord(userId: string, id: string): Promise<Account[]> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error: clearError } = await supabase
    .from('accounts')
    .update({ is_primary: false, updated_at: now })
    .eq('user_id', userId)
    .eq('is_archived', false);

  if (clearError) {
    throw clearError;
  }

  const { error: setError } = await supabase
    .from('accounts')
    .update({ is_primary: true, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId);

  if (setError) {
    throw setError;
  }

  return fetchAccounts(userId);
}

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  const rows = await fetchAllPages<RemoteTransaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<RemoteTransaction[]>()
  );

  return rows.map(mapTransaction);
}

export async function fetchTransactionsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  const rows = await fetchAllPages<RemoteTransaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<RemoteTransaction[]>()
  );

  return rows.map(mapTransaction);
}

// Balances are kept up to date by the database (migration 010). This also brings in
// transactions dated in the future once their date arrives.
export async function refreshAllAccountBalances() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('refresh_my_balances');
  if (error) {
    throw error;
  }
}

type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>;

export async function createTransactionRecord(transaction: NewTransaction): Promise<Transaction> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const payload: Transaction = {
    ...transaction,
    id: uuidv4(),
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(toRemoteTransaction(payload))
    .select('*')
    .single<RemoteTransaction>();

  if (error) {
    throw error;
  }

  return mapTransaction(data);
}

// One request and one database statement: every row is saved or none is, and balances
// are recalculated once for the whole batch. With skipImported, rows whose imported_id is
// already on the account are left out instead of failing the whole batch.
export async function createTransactionRecords(
  transactions: NewTransaction[],
  options: { skipImported?: boolean } = {}
): Promise<Transaction[]> {
  if (transactions.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const payloads = transactions.map((transaction) =>
    toRemoteTransaction({
      ...transaction,
      id: uuidv4(),
      created_at: now,
      updated_at: now,
      is_deleted: false,
    })
  );

  const query = options.skipImported
    ? supabase.from('transactions').upsert(payloads, { onConflict: 'account_id,imported_id', ignoreDuplicates: true })
    : supabase.from('transactions').insert(payloads);
  const { data, error } = await query.select('*').returns<RemoteTransaction[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapTransaction);
}

/** Saves changed transactions in one request, so balances are recalculated once. */
export async function updateTransactionRecords(transactions: Transaction[]): Promise<Transaction[]> {
  if (transactions.length === 0) {
    return [];
  }
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .upsert(transactions.map((t) => toRemoteTransaction({ ...t, updated_at: now })), { onConflict: 'id' })
    .select('*')
    .returns<RemoteTransaction[]>();

  if (error) {
    throw error;
  }
  return (data ?? []).map(mapTransaction);
}

/** Which of these import IDs already exist on the account, including deleted rows. */
export async function fetchExistingImportIds(accountId: string, importIds: string[]): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const found = new Set<string>();
  // Kept small so the request URL stays well under the gateway's 8 KB line limit.
  for (let i = 0; i < importIds.length; i += 40) {
    const { data, error } = await supabase
      .from('transactions')
      .select('imported_id')
      .eq('account_id', accountId)
      .in('imported_id', importIds.slice(i, i + 40))
      .returns<{ imported_id: string }[]>();
    if (error) {
      throw error;
    }
    for (const row of data ?? []) found.add(row.imported_id);
  }
  return found;
}

export async function fetchRules(userId: string): Promise<Rule[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .returns<Rule[]>();
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function createRuleRecords(userId: string, drafts: RuleDraft[]): Promise<Rule[]> {
  if (drafts.length === 0) {
    return [];
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rules')
    .insert(drafts.map((draft) => ({ ...draft, user_id: userId })))
    .select('*')
    .returns<Rule[]>();
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function updateRuleRecord(id: string, updates: Partial<RuleDraft>): Promise<Rule> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('rules').update(updates).eq('id', id).select('*').single<Rule>();
  if (error) {
    throw error;
  }
  return data;
}

export async function deleteRuleRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function updateTransactionRecord(id: string, updates: Partial<Transaction>): Promise<Transaction> {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single<RemoteTransaction>();

  if (existingError) {
    throw existingError;
  }

  const current = mapTransaction(existing);
  const next: Transaction = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('transactions')
    .update(toRemoteTransaction(next))
    .eq('id', id)
    .select('*')
    .single<RemoteTransaction>();

  if (error) {
    throw error;
  }

  return mapTransaction(data);
}

export async function softDeleteTransactionRecord(id: string): Promise<Transaction> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single<RemoteTransaction>();

  if (error) {
    throw error;
  }

  return mapTransaction(data);
}

export async function fetchCategories(userId: string): Promise<{
  categories: Category[];
  subcategories: Subcategory[];
}> {
  const supabase = getSupabaseClient();
  const { data: categories, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .returns<RemoteCategory[]>();

  if (categoryError) {
    throw categoryError;
  }

  const mappedCategories = (categories ?? []).map(mapCategory);
  const categoryIds = mappedCategories.map((category) => category.id);

  if (categoryIds.length === 0) {
    return { categories: mappedCategories, subcategories: [] };
  }

  const { data: subcategories, error: subcategoryError } = await supabase
    .from('subcategories')
    .select('*')
    .in('category_id', categoryIds)
    .returns<RemoteSubcategory[]>();

  if (subcategoryError) {
    throw subcategoryError;
  }

  return {
    categories: mappedCategories,
    subcategories: (subcategories ?? []).map(mapSubcategory),
  };
}

export async function initializeDefaultCategoriesForUser(userId: string): Promise<{
  categories: Category[];
  subcategories: Subcategory[];
}> {
  const current = await fetchCategories(userId);
  if (current.categories.length > 0) {
    return current;
  }

  const supabase = getSupabaseClient();
  const { categories, subcategories } = generateDefaultCategories(userId);

  const { error: categoryError } = await supabase.from('categories').insert(
    categories.map((category) => ({
      id: category.id,
      user_id: category.user_id,
      name: category.name,
      type: category.type,
      emoji: category.icon,
      color: category.color,
      is_default: false,
      sort_order: category.sort_order,
    }))
  );

  if (categoryError) {
    throw categoryError;
  }

  if (subcategories.length > 0) {
    const { error: subcategoryError } = await supabase.from('subcategories').insert(
      subcategories.map((subcategory) => ({
        id: subcategory.id,
        category_id: subcategory.category_id,
        name: subcategory.name,
      }))
    );

    if (subcategoryError) {
      throw subcategoryError;
    }
  }

  return { categories, subcategories };
}

export async function createCategoryRecord(category: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      id: uuidv4(),
      user_id: category.user_id,
      name: category.name,
      type: category.type,
      emoji: category.icon,
      color: category.color,
      is_default: false,
      sort_order: category.sort_order,
    })
    .select('*')
    .single<RemoteCategory>();

  if (error) {
    throw error;
  }

  return mapCategory(data);
}

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<RemoteBudget[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBudget);
}

export async function createBudgetRecord(
  budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
): Promise<Budget> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: budget.user_id,
      name: budget.name,
      category_id: budget.category_id ?? null,
      amount: budget.amount,
      period: budget.period,
      start_date: budget.start_date,
      end_date: budget.end_date ?? null,
      rollover_unused: budget.rollover_unused,
      alert_threshold: budget.alert_threshold,
      is_active: budget.is_active,
    })
    .select('*')
    .single<RemoteBudget>();

  if (error) {
    throw error;
  }

  return mapBudget(data);
}

export async function updateBudgetRecord(id: string, updates: Partial<Budget>): Promise<Budget> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('budgets')
    .update({
      name: updates.name,
      category_id: updates.category_id ?? null,
      amount: updates.amount,
      period: updates.period,
      start_date: updates.start_date,
      end_date: updates.end_date ?? null,
      rollover_unused: updates.rollover_unused,
      alert_threshold: updates.alert_threshold,
      is_active: updates.is_active,
    })
    .eq('id', id)
    .select('*')
    .single<RemoteBudget>();

  if (error) {
    throw error;
  }

  return mapBudget(data);
}

export async function deleteBudgetRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('budgets').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function fetchDebts(userId: string): Promise<Debt[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .returns<RemoteDebt[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDebt);
}

export async function createDebtRecord(
  debt: Omit<Debt, 'id' | 'created_at' | 'updated_at'>
): Promise<Debt> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: debt.user_id,
      account_id: debt.account_id ?? null,
      name: debt.name,
      total_amount: debt.total_amount,
      current_balance: debt.current_balance,
      interest_rate: debt.interest_rate ?? null,
      minimum_payment: debt.minimum_payment ?? null,
      payment_day: debt.payment_day ?? null,
      payoff_strategy: debt.payoff_strategy ?? null,
      priority_order: debt.priority_order ?? null,
      is_active: debt.is_active,
    })
    .select('*')
    .single<RemoteDebt>();

  if (error) {
    throw error;
  }

  return mapDebt(data);
}

export async function updateDebtRecord(id: string, updates: Partial<Debt>): Promise<Debt> {
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = {};

  if (updates.account_id !== undefined) payload.account_id = updates.account_id ?? null;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.total_amount !== undefined) payload.total_amount = updates.total_amount;
  if (updates.current_balance !== undefined) payload.current_balance = updates.current_balance;
  if (updates.interest_rate !== undefined) payload.interest_rate = updates.interest_rate ?? null;
  if (updates.minimum_payment !== undefined) payload.minimum_payment = updates.minimum_payment ?? null;
  if (updates.payment_day !== undefined) payload.payment_day = updates.payment_day ?? null;
  if (updates.payoff_strategy !== undefined) payload.payoff_strategy = updates.payoff_strategy ?? null;
  if (updates.priority_order !== undefined) payload.priority_order = updates.priority_order ?? null;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('debts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single<RemoteDebt>();

  if (error) {
    throw error;
  }

  return mapDebt(data);
}

export async function deleteDebtRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('debts').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function updateCategoryRecord(id: string, updates: Partial<Category>): Promise<Category> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('categories')
    .update({
      name: updates.name,
      type: updates.type,
      emoji: updates.icon,
      color: updates.color,
      sort_order: updates.sort_order,
    })
    .eq('id', id)
    .select('*')
    .single<RemoteCategory>();

  if (error) {
    throw error;
  }

  return mapCategory(data);
}

export async function deleteCategoryRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('is_deleted', false);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    throw new Error('Cannot delete category that is used in transactions');
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function createSubcategoryRecord(subcategory: Omit<Subcategory, 'id'>): Promise<Subcategory> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subcategories')
    .insert({
      id: uuidv4(),
      category_id: subcategory.category_id,
      name: subcategory.name,
    })
    .select('*')
    .single<RemoteSubcategory>();

  if (error) {
    throw error;
  }

  return mapSubcategory(data);
}

export async function updateSubcategoryRecord(id: string, updates: Partial<Subcategory>): Promise<Subcategory> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subcategories')
    .update({ name: updates.name })
    .eq('id', id)
    .select('*')
    .single<RemoteSubcategory>();

  if (error) {
    throw error;
  }

  return mapSubcategory(data);
}

export async function deleteSubcategoryRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('subcategories').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
