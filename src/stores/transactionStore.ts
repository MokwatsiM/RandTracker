import { create } from 'zustand';
import { endOfMonth, startOfMonth } from 'date-fns';
import type { Transaction } from '@/lib/db/schema';
import {
  createTransactionRecord,
  fetchTransactions,
  fetchTransactionsByDateRange,
  softDeleteTransactionRecord,
  updateTransactionRecord,
} from '@/lib/supabase/data';
import { useAccountStore } from '@/stores/accountStore';
import { useDebtStore } from '@/stores/debtStore';

interface TransactionStore {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  filters: {
    accountId?: string;
    categoryId?: string;
    type?: Transaction['type'];
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
  };
  loadTransactions: (userId: string) => Promise<void>;
  loadTransactionsByDateRange: (userId: string, startDate: Date, endDate: Date) => Promise<void>;
  createTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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
  filters: {},

  loadTransactions: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await fetchTransactions(userId);
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadTransactionsByDateRange: async (userId: string, startDate: Date, endDate: Date) => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await fetchTransactionsByDateRange(userId, startDate, endDate);
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTransaction: async (transactionData) => {
    try {
      const newTransaction = await createTransactionRecord(transactionData);
      await useAccountStore.getState().loadAccounts(newTransaction.user_id);
      await useDebtStore.getState().loadDebts(newTransaction.user_id);
      set((state) => ({ transactions: [newTransaction, ...state.transactions] }));
      return newTransaction;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const updatedTransaction = await updateTransactionRecord(id, updates);
      await useAccountStore.getState().loadAccounts(updatedTransaction.user_id);
      await useDebtStore.getState().loadDebts(updatedTransaction.user_id);
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
      await useAccountStore.getState().loadAccounts(deletedTransaction.user_id);
      await useDebtStore.getState().loadDebts(deletedTransaction.user_id);
      set((state) => ({
        transactions: state.transactions.filter((transaction) => transaction.id !== id),
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
