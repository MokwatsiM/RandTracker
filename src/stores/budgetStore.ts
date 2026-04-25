import { create } from 'zustand';
import type { Budget } from '@/lib/db/schema';
import {
  createBudgetRecord,
  deleteBudgetRecord,
  fetchBudgets,
  updateBudgetRecord,
} from '@/lib/supabase/data';

interface BudgetStore {
  budgets: Budget[];
  isLoading: boolean;
  error: string | null;
  loadBudgets: (userId: string) => Promise<void>;
  createBudget: (budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>) => Promise<Budget>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  getBudgetById: (id: string) => Budget | undefined;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budgets: [],
  isLoading: false,
  error: null,

  loadBudgets: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const budgets = await fetchBudgets(userId);
      set({ budgets, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createBudget: async (budget) => {
    try {
      const newBudget = await createBudgetRecord(budget);
      set((state) => ({
        budgets: [...state.budgets, newBudget],
      }));
      return newBudget;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateBudget: async (id, updates) => {
    try {
      const updatedBudget = await updateBudgetRecord(id, updates);
      set((state) => ({
        budgets: state.budgets.map((budget) => (budget.id === id ? updatedBudget : budget)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteBudget: async (id) => {
    try {
      await deleteBudgetRecord(id);
      set((state) => ({
        budgets: state.budgets.filter((budget) => budget.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  getBudgetById: (id) => get().budgets.find((budget) => budget.id === id),
}));
