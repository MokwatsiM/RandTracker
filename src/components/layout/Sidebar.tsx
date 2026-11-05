'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, isActive } from './navigation';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b">
          <span className="text-2xl font-bold text-primary">RandTracker</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <item.icon className={cn('mr-3 flex-shrink-0 h-5 w-5', active ? 'text-primary-foreground' : 'text-muted-foreground')} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
