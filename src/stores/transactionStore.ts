import { create } from 'zustand';
import { endOfMonth, startOfMonth } from 'date-fns';
import type { Transaction } from '@/lib/db/schema';
import {
  createTransactionRecord,
  createTransactionRecords,
  updateTransactionRecords,
  fetchTransactions,
  fetchTransactionsByDateRange,
  softDeleteTransactionRecord,
  restoreTransactionRecord,
  updateTransactionRecord,
} from '@/lib/supabase/data';
import { useAccountStore } from '@/stores/accountStore';
import { useDebtStore } from '@/stores/debtStore';

type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>;

// Most pages need the whole list, and each one asks for it when it opens. Changes made in
// this browser update the list directly, so it's only downloaded again once it's this old,
// or when something else (another device, recurring processing) may have changed it.
const RELOAD_AFTER_MS = 2 * 60 * 1000;

async function reloadBalances(userId: string) {
  await Promise.all([
    useAccountStore.getState().loadAccounts(userId),
    useDebtStore.getState().loadDebts(userId),
  ]);
}

interface TransactionStore {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  loadedFor: { userId: string; at: number } | null;
  filters: {
    accountId?: string;
    categoryId?: string;
    type?: Transaction['type'];
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
  };
  loadTransactions: (userId: string, options?: { force?: boolean }) => Promise<void>;
  loadTransactionsByDateRange: (userId: string, startDate: Date, endDate: Date) => Promise<void>;
  createTransaction: (transaction: NewTransaction) => Promise<Transaction>;
  createTransactions: (transactions: NewTransaction[], options?: { skipImported?: boolean }) => Promise<Transaction[]>;
  /** Saves many edited transactions in one request. */
  updateTransactions: (transactions: Transaction[]) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Deletes several in one request. */
  deleteTransactions: (transactions: Transaction[]) => Promise<void>;
  /** Undoes a delete. */
  restoreTransactions: (transactions: Transaction[]) => Promise<void>;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByAccount: (accountId: string) => Transaction[];
  getTransactionsByCategory: (categoryId: string) => Transaction[];
  setFilters: (filters: TransactionStore['filters']) => void;
  getFilteredTransactions: () => Transaction[];
  getMonthlyIncome: (month: Date) => number;
  getMonthlyExpenses: (month: Date) => number;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  loadedFor: null,
  filters: {},

  loadTransactions: async (userId: string, options) => {
    const loaded = get().loadedFor;
    if (!options?.force && loaded?.userId === userId && Date.now() - loaded.at < RELOAD_AFTER_MS) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const transactions = await fetchTransactions(userId);
      set({ transactions, isLoading: false, loadedFor: { userId, at: Date.now() } });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadTransactionsByDateRange: async (userId: string, startDate: Date, endDate: Date) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await fetchTransactionsByDateRange(userId, startDate, endDate);
      // A partial list, so the next full load must not be skipped.
      set({ transactions, isLoading: false, loadedFor: null });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTransaction: async (transactionData) => {
    try {
      const newTransaction = await createTransactionRecord(transactionData);
      await reloadBalances(newTransaction.user_id);
      set((state) => ({ transactions: [newTransaction, ...state.transactions] }));
      return newTransaction;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  createTransactions: async (transactionsData, options) => {
    try {
      const created = await createTransactionRecords(transactionsData, options);
      if (created.length > 0) {
        await reloadBalances(created[0].user_id);
        set((state) => ({
          transactions: [...created, ...state.transactions].sort((a, b) => b.date.localeCompare(a.date)),
        }));
      }
      return created;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateTransactions: async (changed) => {
    if (changed.length === 0) return;
    try {
      const saved = await updateTransactionRecords(changed);
      const byId = new Map(saved.map((t) => [t.id, t]));
      await reloadBalances(saved[0].user_id);
      set((state) => ({
        transactions: state.transactions.map((t) => byId.get(t.id) ?? t),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const updatedTransaction = await updateTransactionRecord(id, updates);
      await reloadBalances(updatedTransaction.user_id);
      set((state) => ({
        transactions: state.transactions.map((transaction) =>
          transaction.id === id ? updatedTransaction : transaction
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    try {
      const deletedTransaction = await softDeleteTransactionRecord(id);
      await reloadBalances(deletedTransaction.user_id);
      set((state) => ({
        transactions: state.transactions.filter((transaction) => transaction.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteTransactions: async (list) => {
    if (list.length === 0) return;
    try {
      await updateTransactionRecords(list.map((t) => ({ ...t, is_deleted: true })));
      const ids = new Set(list.map((t) => t.id));
      await reloadBalances(list[0].user_id);
      set((state) => ({ transactions: state.transactions.filter((t) => !ids.has(t.id)) }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  restoreTransactions: async (list) => {
    if (list.length === 0) return;
    try {
      const restored = list.length === 1
        ? [await restoreTransactionRecord(list[0].id)]
        : await updateTransactionRecords(list.map((t) => ({ ...t, is_deleted: false })));
      await reloadBalances(list[0].user_id);
      set((state) => ({
        transactions: [...restored, ...state.transactions].sort((a, b) => b.date.localeCompare(a.date)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getTransactionById: (id) => get().transactions.find((transaction) => transaction.id === id),

  getTransactionsByAccount: (accountId) =>
    get().transactions.filter((transaction) => transaction.account_id === accountId),

  getTransactionsByCategory: (categoryId) =>
    get().transactions.filter((transaction) => transaction.category_id === categoryId),

  setFilters: (filters) => {
    set({ filters });
  },

  getFilteredTransactions: () => {
    const { transactions, filters } = get();
    let filtered = [...transactions];

    if (filters.accountId) {
      filtered = filtered.filter((transaction) => transaction.account_id === filters.accountId);
    }

    if (filters.categoryId) {
      filtered = filtered.filter((transaction) => transaction.category_id === filters.categoryId);
    }

    if (filters.type) {
      filtered = filtered.filter((transaction) => transaction.type === filters.type);
    }

    if (filters.startDate) {
      filtered = filtered.filter((transaction) => transaction.date >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter((transaction) => transaction.date <= filters.endDate!);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (transaction) =>
          transaction.title?.toLowerCase().includes(query) ||
          transaction.notes?.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  getMonthlyIncome: (month: Date) => {
    const start = startOfMonth(month).toISOString().split('T')[0];
    const end = endOfMonth(month).toISOString().split('T')[0];

    return get()
      .transactions.filter((transaction) => transaction.type === 'income' && transaction.date >= start && transaction.date <= end)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  },

  getMonthlyExpenses: (month: Date) => {
    const start = startOfMonth(month).toISOString().split('T')[0];
    const end = endOfMonth(month).toISOString().split('T')[0];

    return get()
      .transactions.filter((transaction) => transaction.type === 'expense' && transaction.date >= start && transaction.date <= end)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  },
}));
