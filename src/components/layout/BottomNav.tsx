'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Receipt,
  CreditCard,
  TrendingUp,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Transactions', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Accounts', href: '/dashboard/accounts', icon: CreditCard },
  { name: 'Investments', href: '/dashboard/investments', icon: TrendingUp },
  { name: 'Goals', href: '/dashboard/goals', icon: Target },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
      <div className="grid grid-cols-5 h-16">
        {mobileNavigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center space-y-1 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
