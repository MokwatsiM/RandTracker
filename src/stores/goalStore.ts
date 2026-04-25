import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Goal } from '@/lib/db/schema';

interface GoalStore {
  goals: Goal[];
  isLoading: boolean;
  error: string | null;

  loadGoals: (userId: string) => Promise<void>;
  createGoal: (goal: Partial<Goal>) => Promise<Goal | null>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateGoalProgress: (id: string, currentAmount: number) => Promise<void>;
  markGoalAsAchieved: (id: string) => Promise<void>;
  getGoalById: (id: string) => Goal | undefined;
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],
  isLoading: false,
  error: null,

  loadGoals: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ goals: data || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createGoal: async (goalData: Partial<Goal>) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert([goalData])
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        goals: [data, ...state.goals],
      }));

      return data;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  updateGoal: async (id: string, updates: Partial<Goal>) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        goals: state.goals.map((goal) =>
          goal.id === id ? { ...goal, ...updates } : goal
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteGoal: async (id: string) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        goals: state.goals.filter((goal) => goal.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateGoalProgress: async (id: string, currentAmount: number) => {
    const supabase = createClient();

    try {
      const goal = get().goals.find((g) => g.id === id);
      if (!goal) return;

      const isAchieved = currentAmount >= goal.target_amount;

      const { error } = await supabase
        .from('goals')
        .update({
          current_amount: currentAmount,
          is_achieved: isAchieved,
        })
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        goals: state.goals.map((goal) =>
          goal.id === id
            ? { ...goal, current_amount: currentAmount, is_achieved: isAchieved }
            : goal
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  markGoalAsAchieved: async (id: string) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('goals')
        .update({ is_achieved: true })
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        goals: state.goals.map((goal) =>
          goal.id === id ? { ...goal, is_achieved: true } : goal
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  getGoalById: (id: string) => {
    return get().goals.find((goal) => goal.id === id);
  },
}));
