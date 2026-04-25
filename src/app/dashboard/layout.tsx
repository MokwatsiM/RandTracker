'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FAB } from '@/components/layout/FAB';
import { QuickAddSheet } from '@/components/transactions/QuickAddSheet';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content */}
      <div className="md:pl-64">
        <main className="py-6 px-4 md:px-8 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav />

      {/* Quick Add FAB */}
      <FAB onClick={() => setQuickAddOpen(true)} />

      {/* Quick Add Transaction Sheet */}
      <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </div>
  );
}
