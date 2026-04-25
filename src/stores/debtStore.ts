import { create } from 'zustand';
import type { Debt } from '@/lib/db/schema';
import {
  createDebtRecord,
  deleteDebtRecord,
  fetchDebts,
  updateDebtRecord,
} from '@/lib/supabase/data';

interface DebtStore {
  debts: Debt[];
  isLoading: boolean;
  error: string | null;
  loadDebts: (userId: string) => Promise<void>;
  createDebt: (debt: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => Promise<Debt>;
  updateDebt: (id: string, updates: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  getDebtById: (id: string) => Debt | undefined;
}

export const useDebtStore = create<DebtStore>((set, get) => ({
  debts: [],
  isLoading: false,
  error: null,

  loadDebts: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const debts = await fetchDebts(userId);
      set({ debts, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createDebt: async (debt) => {
    try {
      const newDebt = await createDebtRecord(debt);
      set((state) => ({ debts: [...state.debts, newDebt] }));
      return newDebt;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateDebt: async (id, updates) => {
    try {
      const updatedDebt = await updateDebtRecord(id, updates);
      set((state) => ({
        debts: state.debts.map((debt) => (debt.id === id ? updatedDebt : debt)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteDebt: async (id) => {
    try {
      await deleteDebtRecord(id);
      set((state) => ({
        debts: state.debts.filter((debt) => debt.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getDebtById: (id) => get().debts.find((debt) => debt.id === id),
}));
