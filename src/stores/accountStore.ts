import { create } from 'zustand';
import type { Account } from '@/lib/db/schema';
import {
  archiveAccountRecord,
  createAccountRecord,
  fetchAccounts,
  refreshAllAccountBalances,
  setPrimaryAccountRecord,
  updateAccountRecord,
} from '@/lib/supabase/data';

interface AccountStore {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  loadAccounts: (userId: string) => Promise<void>;
  createAccount: (account: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'current_balance'>) => Promise<Account>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setPrimaryAccount: (id: string) => Promise<void>;
  getAccountById: (id: string) => Account | undefined;
  getAccountsByType: (type: Account['type']) => Account[];
  getTotalBalance: () => number;
  refreshBalances: () => Promise<void>;
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  loadAccounts: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await fetchAccounts(userId);
      set({ accounts, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createAccount: async (accountData) => {
    try {
      const newAccount = await createAccountRecord(accountData);
      set((state) => ({ accounts: [...state.accounts, newAccount] }));
      return newAccount;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateAccount: async (id, updates) => {
    try {
      const updatedAccount = await updateAccountRecord(id, updates);
      set((state) => ({
        accounts: state.accounts.map((account) => (account.id === id ? updatedAccount : account)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteAccount: async (id) => {
    try {
      await archiveAccountRecord(id);
      set((state) => ({
        accounts: state.accounts.filter((account) => account.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  setPrimaryAccount: async (id) => {
    try {
      const targetAccount = get().accounts.find((account) => account.id === id);
      if (!targetAccount) {
        throw new Error('Account not found');
      }

      const accounts = await setPrimaryAccountRecord(targetAccount.user_id, id);
      set({ accounts });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getAccountById: (id) => get().accounts.find((account) => account.id === id),

  getAccountsByType: (type) => get().accounts.filter((account) => account.type === type),

  getTotalBalance: () =>
    get().accounts.reduce((total, account) => {
      if (account.type === 'credit_card' || account.type === 'loan' || account.type === 'store_card') {
        return total - account.current_balance;
      }

      return total + account.current_balance;
    }, 0),

  refreshBalances: async () => {
    try {
      const firstAccount = get().accounts[0];
      if (!firstAccount) {
        return;
      }

      await refreshAllAccountBalances(firstAccount.user_id);
      const accounts = await fetchAccounts(firstAccount.user_id);
      set({ accounts });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
