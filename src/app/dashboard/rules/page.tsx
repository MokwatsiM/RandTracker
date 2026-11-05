'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Sparkles, Wand2, Pencil, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RuleDialog } from '@/components/rules/RuleDialog';
import { useUserStore } from '@/stores/userStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { applyRules } from '@/lib/rules/engine';
import { describeAction, describeCondition, type NameLookup } from '@/lib/rules/describe';
import { buildStarterRules } from '@/lib/rules/starter-rules';
import type { Rule, RuleDraft } from '@/lib/rules/types';
import type { Transaction } from '@/lib/db/schema';

const STAGE_LABEL = { pre: 'Runs first', default: '', post: 'Runs last' } as const;

export default function RulesPage() {
  const user = useUserStore((s) => s.user);
  const { rules, isLoading, loadRules, createRules, updateRule, deleteRule } = useRuleStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { categories, subcategories, loadCategories } = useCategoryStore();
  const { debts, loadDebts } = useDebtStore();
  const { transactions, loadTransactions, updateTransactions } = useTransactionStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | undefined>();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadRules(user.id);
    void loadAccounts(user.id);
    void loadCategories(user.id);
    void loadDebts(user.id);
    void loadTransactions(user.id);
  }, [user, loadRules, loadAccounts, loadCategories, loadDebts, loadTransactions]);

  const names: NameLookup = useMemo(
    () => ({
      account: (id) => accounts.find((a) => a.id === id)?.name,
      category: (id) => categories.find((c) => c.id === id)?.name,
      subcategory: (id) => subcategories.find((s) => s.id === id)?.name,
      debt: (id) => debts.find((d) => d.id === id)?.name,
    }),
    [accounts, categories, subcategories, debts]
  );

  const ownRules = rules.filter((r) => !r.is_auto);
  const learnedRules = rules.filter((r) => r.is_auto);
  const hasStarter = rules.some((r) => r.description?.startsWith('Starter:'));
  const categoryTypes = useMemo(() => new Map(categories.map((c) => [c.id, c.type])), [categories]);

  /** Transactions this rule would change, with the change made. */
  const changesFor = (rule: Rule): Transaction[] =>
    transactions.flatMap((t) => {
      const { subject } = applyRules({ ...t, category_id: t.category_id || null }, [rule], { categoryTypes });
      const next: Transaction = {
        ...t,
        category_id: subject.category_id ?? '',
        subcategory_id: subject.subcategory_id ?? undefined,
        title: subject.title,
        notes: subject.notes ?? undefined,
        tags: subject.tags ?? undefined,
        exclude_from_budget: subject.exclude_from_budget ?? t.exclude_from_budget,
        is_debt_payment: subject.is_debt_payment ?? t.is_debt_payment,
        debt_id: subject.debt_id ?? undefined,
      };
      const changed = (['category_id', 'subcategory_id', 'title', 'notes', 'exclude_from_budget', 'is_debt_payment', 'debt_id'] as const).some(
        (k) => (next[k] ?? null) !== (t[k] ?? null)
      ) || JSON.stringify(next.tags ?? []) !== JSON.stringify(t.tags ?? []);
      return changed ? [next] : [];
    });

  const applyToExisting = async (rule: Rule) => {
    const changes = changesFor(rule);
    if (changes.length === 0) {
      alert('No existing transactions would change.');
      return;
    }
    if (!window.confirm(`Change ${changes.length} existing transaction${changes.length === 1 ? '' : 's'}?`)) return;
    setBusy(rule.id);
    try {
      await updateTransactions(changes);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update transactions');
    } finally {
      setBusy(null);
    }
  };

  const addStarterRules = async () => {
    if (!user) return;
    const drafts = buildStarterRules(categories, subcategories);
    if (drafts.length === 0) {
      alert("None of the starter rules' categories exist in your categories.");
      return;
    }
    setBusy('starter');
    try {
      await createRules(user.id, drafts);
    } finally {
      setBusy(null);
    }
  };

  const save = async (draft: RuleDraft) => {
    if (!user) return;
    if (editing) await updateRule(editing.id, draft);
    else await createRules(user.id, [draft]);
  };

  const remove = async (rule: Rule) => {
    if (window.confirm('Delete this rule? Transactions it already changed stay as they are.')) {
      await deleteRule(rule.id);
    }
  };

  const ruleRow = (rule: Rule) => (
    <div key={rule.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center ${rule.is_enabled ? '' : 'opacity-60'}`}>
      <div className="min-w-0 flex-1 text-sm">
        {rule.description && <p className="font-medium">{rule.description}</p>}
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">If </span>
          {rule.conditions.map((c) => describeCondition(c, names)).join(' and ')}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Then </span>
          {rule.actions.map((a) => describeAction(a, names)).join(', ')}
        </p>
        <div className="mt-1 flex gap-1">
          {STAGE_LABEL[rule.stage] && <Badge variant="secondary">{STAGE_LABEL[rule.stage]}</Badge>}
          {!rule.is_enabled && <Badge variant="outline">Off</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <label className="flex items-center gap-1 px-2 text-sm">
          <input
            type="checkbox"
            checked={rule.is_enabled}
            onChange={(e) => void updateRule(rule.id, { is_enabled: e.target.checked })}
          />
          On
        </label>
        <Button variant="ghost" size="sm" onClick={() => void applyToExisting(rule)} disabled={busy !== null} title="Apply to existing transactions">
          <Play className="h-4 w-4" />
          <span className="sr-only">Apply to existing transactions</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(rule); setDialogOpen(true); }} title="Edit">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void remove(rule)} title="Delete">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="container max-w-5xl mx-auto p-0 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Rules</h1>
          <p className="text-muted-foreground mt-1">Categorise and clean up transactions automatically</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasStarter && (
            <Button variant="outline" onClick={() => void addStarterRules()} disabled={busy !== null}>
              <Sparkles className="mr-2 h-4 w-4" />
              {busy === 'starter' ? 'Adding...' : 'Add South African starter rules'}
            </Button>
          )}
          <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New rule
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your rules</CardTitle>
          <CardDescription>
            Rules run on every import, and suggest a category when you add a transaction. Use the play button to apply a
            rule to transactions you already have.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && rules.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Loading rules...</p>
          ) : ownRules.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No rules yet. Add the starter rules for common South African shops, or create your own.
            </p>
          ) : (
            <div className="divide-y">{ownRules.map(ruleRow)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Learned from your changes
          </CardTitle>
          <CardDescription>
            When you change a transaction&apos;s category, RandTracker remembers it for that payee. Editing a learned rule
            makes it one of your rules. You can turn learning off in{' '}
            <Link href="/dashboard/settings" className="underline">Settings</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {learnedRules.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing learned yet.</p>
          ) : (
            <div className="divide-y">{learnedRules.map(ruleRow)}</div>
          )}
        </CardContent>
      </Card>

      <RuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editing} onSave={save} />
    </div>
  );
}
