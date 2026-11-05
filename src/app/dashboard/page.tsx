'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GettingStarted, WIDGETS, renderWidget } from '@/components/dashboard/widgets';
import { DEFAULT_LAYOUT, moveItem, resizeItem, toggleItem, visibleLayout, type LayoutItem } from '@/lib/reports/layout';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useUserStore } from '@/stores/userStore';

export default function DashboardPage() {
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const { accounts, loadAccounts } = useAccountStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[]>([]);

  useEffect(() => {
    if (user) {
      loadAccounts(user.id);
      loadTransactions(user.id);
      loadCategories(user.id);
    }
  }, [user, loadAccounts, loadTransactions, loadCategories]);

  if (!user) return null;

  const layout = editing ? draft : visibleLayout(user.dashboard_layout, WIDGETS);
  const hidden = WIDGETS.filter((w) => !layout.some((item) => item.id === w.id));

  const startEditing = () => {
    setDraft(visibleLayout(user.dashboard_layout, WIDGETS));
    setEditing(true);
  };

  const save = () => {
    updateProfile({ dashboard_layout: draft });
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back{user.display_name ? `, ${user.display_name}` : ''}!</p>
        </div>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setDraft(DEFAULT_LAYOUT)}>Reset</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={save}>Save layout</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={startEditing}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Customise
          </Button>
        )}
      </div>

      {editing && hidden.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add a card</CardTitle>
            <CardDescription>Hidden cards. Use the arrows on each card to reorder, and the size button to make it full width.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {hidden.map((w) => (
              <Button key={w.id} size="sm" variant="outline" onClick={() => setDraft(toggleItem(draft, w))}>+ {w.title}</Button>
            ))}
          </CardContent>
        </Card>
      )}

      {transactions.length === 0 && !editing && <GettingStarted hasAccounts={accounts.length > 0} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {layout.map((item, index) => {
          const widget = WIDGETS.find((w) => w.id === item.id)!;
          return (
            <div key={item.id} className={`relative min-w-0 ${item.size === 'full' ? 'lg:col-span-2' : ''} ${editing ? 'rounded-lg outline-dashed outline-2 outline-offset-2 outline-primary/40' : ''}`}>
              {editing && (
                <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md bg-background/90 p-1 shadow">
                  <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setDraft(moveItem(draft, item.id, -1))} aria-label={`Move ${widget.title} up`}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={index === layout.length - 1} onClick={() => setDraft(moveItem(draft, item.id, 1))} aria-label={`Move ${widget.title} down`}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft(resizeItem(draft, item.id))}>{item.size === 'full' ? 'Half' : 'Full'}</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDraft(toggleItem(draft, widget))}>Hide</Button>
                </div>
              )}
              {renderWidget(item.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
