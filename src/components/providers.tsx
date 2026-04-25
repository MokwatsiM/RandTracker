'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthSessionBridge } from '@/components/auth/AuthSessionBridge';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthSessionBridge />
      {children}
    </AuthProvider>
  );
}
