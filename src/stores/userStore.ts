import { create } from 'zustand';
import type { UserProfile } from '@/lib/db/schema';
import { updateUserProfile } from '@/lib/supabase/data';

interface UserStore {
  user: UserProfile | null;
  authMode: 'authenticated' | null;
  isAuthenticated: boolean;
  initializeUser: () => void;
  setSupabaseUser: (user: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  authMode: null,
  isAuthenticated: false,

  initializeUser: () => {},

  setSupabaseUser: (user) => {
    set({
      user,
      authMode: 'authenticated',
      isAuthenticated: true,
    });
  },

  updateProfile: (updates) => {
    const currentUser = get().user;
    if (!currentUser) {
      return;
    }

    const optimisticUser = { ...currentUser, ...updates };
    set({ user: optimisticUser });

    void updateUserProfile(currentUser.id, updates)
      .then((profile) => {
        set({ user: profile });
      })
      .catch(() => {
        set({ user: currentUser });
      });
  },

  clearUser: () => {
    set({ user: null, authMode: null, isAuthenticated: false });
  },
}));
