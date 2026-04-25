import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  currency: string;
  timezone: string;
  payday_date?: number;
  monthly_income: number;
  created_at: string;
  updated_at: string;
}

interface UserProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  loadProfile: (userId: string) => Promise<void>;
  updateProfile: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  updateCurrency: (userId: string, currency: string) => Promise<void>;
  updatePaydayDate: (userId: string, paydayDate: number) => Promise<void>;
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async (userId: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      set({ profile: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      set({ profile: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateCurrency: async (userId: string, currency: string) => {
    await get().updateProfile(userId, { currency });
  },

  updatePaydayDate: async (userId: string, paydayDate: number) => {
    await get().updateProfile(userId, { payday_date: paydayDate });
  },
}));
