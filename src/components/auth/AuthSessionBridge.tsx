'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/userStore';
import { ensureUserProfile } from '@/lib/supabase/data';

export function AuthSessionBridge() {
  const { user, loading } = useAuth();
  const setSupabaseUser = useUserStore((state) => state.setSupabaseUser);
  const clearUser = useUserStore((state) => state.clearUser);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (loading) {
        return;
      }

      if (user) {
        const profile = await ensureUserProfile(user);
        if (!cancelled) {
          setSupabaseUser(profile);
        }
        return;
      }

      clearUser();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [clearUser, loading, setSupabaseUser, user]);

  return null;
}
