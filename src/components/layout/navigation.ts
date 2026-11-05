import {
  BarChart3,
  CalendarClock,
  CreditCard,
  Home,
  LineChart,
  PiggyBank,
  Receipt,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** One line shown in the phone menu. */
  hint: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// Every page, in one place, so the sidebar and the phone menu can't drift apart.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Everyday',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home, hint: 'Your overview' },
      { name: 'Transactions', href: '/dashboard/transactions', icon: Receipt, hint: 'Add, import and edit' },
      { name: 'Accounts', href: '/dashboard/accounts', icon: CreditCard, hint: 'Balances and reconciling' },
      { name: 'Budgets', href: '/dashboard/budgets', icon: PiggyBank, hint: 'Your payday budget month' },
      { name: 'Schedules', href: '/dashboard/schedules', icon: CalendarClock, hint: 'Debit orders and subscriptions' },
    ],
  },
  {
    title: 'Plan',
    items: [
      { name: 'Debts', href: '/dashboard/debts', icon: TrendingDown, hint: 'Payoff plans' },
      { name: 'Goals', href: '/dashboard/goals', icon: Target, hint: 'Savings targets' },
      { name: 'Investments', href: '/dashboard/investments', icon: TrendingUp, hint: 'Holdings and TFSA' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Reports', href: '/dashboard/reports', icon: LineChart, hint: 'Cash flow, net worth, calendar' },
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, hint: 'Categories and trends' },
    ],
  },
  {
    title: 'Setup',
    items: [
      { name: 'Rules', href: '/dashboard/rules', icon: Wand2, hint: 'Automatic categories' },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings, hint: 'Payday, export, account' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** The four pages on the phone's bottom bar; everything else is under More. */
export const BOTTOM_NAV_HREFS = ['/dashboard', '/dashboard/transactions', '/dashboard/budgets', '/dashboard/accounts'];

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // The dashboard is a prefix of every page, so it only matches exactly.
  return href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
