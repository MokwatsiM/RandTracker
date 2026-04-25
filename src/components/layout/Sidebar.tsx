'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CreditCard,
  Receipt,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Target,
  BarChart3,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Transactions', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Accounts', href: '/dashboard/accounts', icon: CreditCard },
  { name: 'Budgets', href: '/dashboard/budgets', icon: PiggyBank },
  { name: 'Investments', href: '/dashboard/investments', icon: TrendingUp },
  { name: 'Debts', href: '/dashboard/debts', icon: TrendingDown },
  { name: 'Goals', href: '/dashboard/goals', icon: Target },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b">
          <span className="text-2xl font-bold text-primary">RandTracker</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 flex-shrink-0 h-5 w-5',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
