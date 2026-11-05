'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatZAR } from '@/lib/currency';
import { clearedBalance, signedAmount } from '@/lib/ledger/ledger';
import { reconcileAccount } from '@/lib/supabase/data';
import type { Account, Transaction } from '@/lib/db/schema';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useToastStore } from '@/stores/toastStore';

const LIABILITIES: Account['type'][] = ['credit_card', 'loan', 'store_card'];

/**
 * Matches the account against a bank statement: tick what the statement shows until the
 * cleared balance equals the statement's, then lock those transactions in.
 */
export function ReconcilePanel({ account, transactions }: { account: Account; transactions: Transaction[] }) {
  const { updateTransactions, loadTransactions } = useTransactionStore();
  const loadAccounts = useAccountStore((s) => s.loadAccounts);
  const showToast = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const isLiability = LIABILITIES.includes(account.type);

  const cleared = clearedBalance(account, transactions);
  // Statements for cards and loans show what's owed as a positive number; balances here are negative.
  const typed = statement.trim() === '' ? null : Math.round(parseFloat(statement) * 100);
  const target = typed === null || !Number.isFinite(typed) ? null : isLiability ? -Math.abs(typed) : typed;
  const difference = target === null ? null : target - cleared;

  const open_items = useMemo(
    () =>
      transactions
        .filter((t) => !t.is_deleted && !t.reconciled && signedAmount(t, account.id) !== null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions, account.id]
  );

  const toggle = async (t: Transaction) => {
    setBusy(true);
    try {
      await updateTransactions([{ ...t, cleared: !t.cleared }]);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (target === null) return;
    setBusy(true);
    try {
      const locked = await reconcileAccount(account.id, target);
      await Promise.all([loadTransactions(account.user_id, { force: true }), loadAccounts(account.user_id)]);
      showToast(`Reconciled: ${locked} transaction${locked === 1 ? '' : 's'} locked in.`);
      setOpen(false);
      setStatement('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to reconcile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Reconcile</CardTitle>
          <CardDescription>
            {account.last_reconciled_at
              ? `Last reconciled ${new Date(account.last_reconciled_at).toLocaleDateString('en-ZA')} at ${formatZAR(account.last_reconciled_balance ?? 0)}.`
              : 'Check this account against a bank statement.'}{' '}
            Cleared balance: {formatZAR(cleared)}.
          </CardDescription>
        </div>
        {!open && <Button variant="outline" onClick={() => setOpen(true)}>Reconcile</Button>}
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              {isLiability ? 'Amount owed on the statement (R)' : 'Statement closing balance (R)'}
              <Input type="number" step="0.01" value={statement} onChange={(e) => setStatement(e.target.value)} className="mt-1 w-48" />
            </label>
            {difference !== null && (
              <p className={`pb-2 text-sm font-medium ${difference === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {difference === 0 ? 'Cleared transactions match the statement.' : `Difference: ${formatZAR(difference)}`}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Tick each transaction the statement shows.</p>
          <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
            {open_items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Everything is reconciled.</p>
            ) : (
              open_items.map((t) => {
                const amount = signedAmount(t, account.id)!;
                return (
                  <label key={t.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm">
                    <input type="checkbox" checked={!!t.cleared} disabled={busy} onChange={() => void toggle(t)} />
                    <span className="w-24 text-muted-foreground">{t.date}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.cleared && <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />}
                    <span className={amount >= 0 ? 'text-green-600' : 'text-red-600'}>{formatZAR(amount)}</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void finish()} disabled={busy || difference !== 0}>Finish and lock in</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
