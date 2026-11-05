'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatZAR } from '@/lib/currency';
import { addDays, upcomingOccurrences } from '@/lib/schedules/dates';
import type { Schedule } from '@/lib/schedules/types';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useUserStore } from '@/stores/userStore';
import { useAccountStore } from '@/stores/accountStore';

export function formatScheduleAmount(s: Pick<Schedule, 'amount' | 'amount_type' | 'amount_min' | 'amount_max'>): string {
  if (s.amount_type === 'range') return `${formatZAR(s.amount_min ?? 0)} – ${formatZAR(s.amount_max ?? 0)}`;
  return `${s.amount_type === 'approx' ? '≈ ' : ''}${formatZAR(s.amount)}`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function relativeDay(date: string, today: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${-days} days ago`;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

interface UpcomingSchedulesProps {
  /** How many days ahead to show. */
  days: number;
  /** Show at most this many upcoming items (items waiting for approval are always shown). */
  limit?: number;
}

/**
 * Schedules waiting for approval, with approve and skip buttons, then what's coming up.
 * Automatic ones that are due are posted by SchedulePoster, so they never wait here.
 */
export function UpcomingSchedules({ days, limit }: UpcomingSchedulesProps) {
  const user = useUserStore((s) => s.user);
  const schedules = useScheduleStore((s) => s.schedules);
  const recordOccurrence = useScheduleStore((s) => s.recordOccurrence);
  const skipOccurrence = useScheduleStore((s) => s.skipOccurrence);
  const accounts = useAccountStore((s) => s.accounts);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const today = todayIso();
  const { waiting, upcoming } = useMemo(() => {
    const waiting: { schedule: Schedule; date: string }[] = [];
    const upcoming: { schedule: Schedule; date: string; key: string }[] = [];
    for (const s of schedules) {
      if (!s.is_active) continue;
      for (const [i, o] of upcomingOccurrences(s, addDays(today, days), 40).entries()) {
        if (i === 0 && !s.auto_add && o.date <= today) waiting.push({ schedule: s, date: o.date });
        else if (o.date >= today) upcoming.push({ schedule: s, date: o.date, key: `${s.id}|${o.scheduleDate}` });
      }
    }
    waiting.sort((a, b) => a.date.localeCompare(b.date));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    return { waiting, upcoming: limit ? upcoming.slice(0, limit) : upcoming };
  }, [schedules, today, days, limit]);

  const account = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';

  const approve = async (s: Schedule) => {
    if (!user) return;
    const typed = amounts[s.id];
    const amount = typed ? Math.round(parseFloat(typed) * 100) : undefined;
    setBusy(s.id);
    try {
      await recordOccurrence(user.id, s.id, amount && amount > 0 ? amount : undefined);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to record the payment');
    } finally {
      setBusy(null);
    }
  };

  const skip = async (s: Schedule) => {
    if (!user) return;
    setBusy(s.id);
    try {
      await skipOccurrence(user.id, s.id);
    } finally {
      setBusy(null);
    }
  };

  if (waiting.length === 0 && upcoming.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing due in the next {days} days. <Link href="/dashboard/schedules" className="underline">Add a schedule</Link> for
        debit orders and subscriptions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {waiting.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Waiting for you</p>
          {waiting.map(({ schedule: s, date }) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {relativeDay(date, today)} · {account(s.account_id)} · expected {formatScheduleAmount(s)}
                </p>
              </div>
              {s.amount_type !== 'exact' && (
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 w-24 sm:w-28"
                  placeholder={(s.amount / 100).toFixed(2)}
                  value={amounts[s.id] ?? ''}
                  onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })}
                  aria-label={`Actual amount for ${s.name}`}
                />
              )}
              <Button size="sm" onClick={() => void approve(s)} disabled={busy !== null}>
                <Check className="mr-1 h-4 w-4" /> Record
              </Button>
              <Button size="sm" variant="outline" onClick={() => void skip(s)} disabled={busy !== null}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="divide-y rounded-lg border">
          {upcoming.map(({ schedule: s, date, key }) => (
            <div key={key} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {relativeDay(date, today)} · {account(s.account_id)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!s.auto_add && <Badge variant="outline" className="hidden sm:inline-flex">Asks first</Badge>}
                <span className={`whitespace-nowrap ${s.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {s.type === 'income' ? '+' : '-'}
                  {formatScheduleAmount(s)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
