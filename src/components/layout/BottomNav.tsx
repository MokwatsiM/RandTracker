'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_NAV_ITEMS, BOTTOM_NAV_HREFS, NAV_GROUPS, isActive } from './navigation';

/**
 * The phone's navigation: four main pages on the bottom bar, and a More sheet with every
 * page, grouped as in the sidebar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const main = BOTTOM_NAV_HREFS.map((href) => ALL_NAV_ITEMS.find((i) => i.href === href)!);
  // More is highlighted when the current page is one of the pages it holds.
  const onMorePage = !main.some((item) => isActive(pathname, item.href));

  // Close the sheet after navigating, and with the Escape key.
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="All pages">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl animate-slide-up">
            <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-3">
              <span className="text-lg font-semibold">RandTracker</span>
              <button onClick={() => setMoreOpen(false)} className="rounded-md p-2 hover:bg-accent" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 px-4 pt-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                            active ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                          )}
                        >
                          <item.icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{item.name}</span>
                            <span className="block text-xs text-muted-foreground">{item.hint}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={() => void signOut()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <div className="grid h-16 grid-cols-5">
          {main.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center justify-center gap-1 transition-colors', active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.name === 'Dashboard' ? 'Home' : item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn('flex flex-col items-center justify-center gap-1 transition-colors', onMorePage ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            aria-label="More pages"
            aria-expanded={moreOpen}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
