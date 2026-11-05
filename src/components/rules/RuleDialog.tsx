'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useDebtStore } from '@/stores/debtStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { ACTION_FIELDS, CONDITION_FIELDS, opsForField } from '@/lib/rules/describe';
import { ruleMatches } from '@/lib/rules/engine';
import type { ActionField, ConditionField, Rule, RuleAction, RuleCondition, RuleDraft, RuleStage } from '@/lib/rules/types';

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: Rule;
  onSave: (draft: RuleDraft) => Promise<void>;
}

// Values are edited as text and converted when saving: amounts in rand become cents,
// and a comma-separated list for "contains" becomes "any of".
interface ConditionForm {
  field: ConditionField;
  op: RuleCondition['op'];
  value: string;
}

interface ActionForm {
  field: ActionField;
  value: string;
}

const STAGES: { value: RuleStage; label: string }[] = [
  { value: 'pre', label: 'First: cleans up names before other rules' },
  { value: 'default', label: 'Normal' },
  { value: 'post', label: 'Last: overrides other rules' },
];

function toConditionForm(c: RuleCondition): ConditionForm {
  const value = Array.isArray(c.value)
    ? c.value.join(',')
    : c.field === 'amount'
      ? String(Number(c.value) / 100)
      : String(c.value);
  return { field: c.field, op: c.op, value };
}

function toActionForm(a: RuleAction): ActionForm {
  const value = Array.isArray(a.value) ? a.value.join(', ') : a.value === null ? '' : String(a.value);
  return { field: a.field, value };
}

function fromConditionForm(c: ConditionForm): RuleCondition | null {
  if (c.value.trim() === '') return null;
  if (c.field === 'amount') {
    const rand = parseFloat(c.value);
    return Number.isFinite(rand) ? { field: c.field, op: c.op, value: Math.round(rand * 100) } : null;
  }
  if ((c.op === 'contains' || c.op === 'does_not_contain') && c.value.includes(',')) {
    const list = c.value.split(',').filter((v) => v.trim() !== '');
    return { field: c.field, op: c.op, value: list };
  }
  return { field: c.field, op: c.op, value: c.value };
}

function fromActionForm(a: ActionForm): RuleAction | null {
  switch (a.field) {
    case 'exclude_from_budget':
      return { field: a.field, op: 'set', value: true };
    case 'notes':
      return a.value.trim() ? { field: a.field, op: 'append', value: a.value.trim() } : null;
    case 'tags': {
      const tags = a.value.split(',').map((t) => t.trim()).filter(Boolean);
      return tags.length ? { field: a.field, op: 'append', value: tags } : null;
    }
    default:
      return a.value.trim() ? { field: a.field, op: 'set', value: a.value.trim() } : null;
  }
}

export function RuleDialog({ open, onOpenChange, rule, onSave }: RuleDialogProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const { categories, subcategories } = useCategoryStore();
  const debts = useDebtStore((s) => s.debts);
  const transactions = useTransactionStore((s) => s.transactions);

  const [stage, setStage] = useState<RuleStage>('default');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<ConditionForm[]>([]);
  const [actions, setActions] = useState<ActionForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage(rule?.stage ?? 'default');
    setDescription(rule?.description ?? '');
    setConditions(rule?.conditions.map(toConditionForm) ?? [{ field: 'imported_payee', op: 'contains', value: '' }]);
    setActions(rule?.actions.map(toActionForm) ?? [{ field: 'category_id', value: '' }]);
    setError(null);
  }, [open, rule]);

  const built = useMemo(() => {
    const c = conditions.map(fromConditionForm);
    const a = actions.map(fromActionForm);
    return { conditions: c.filter((x): x is RuleCondition => !!x), actions: a.filter((x): x is RuleAction => !!x), complete: !c.includes(null) && !a.includes(null) };
  }, [conditions, actions]);

  const matchCount = useMemo(
    () =>
      built.conditions.length
        ? transactions.filter((t) => ruleMatches({ ...t, category_id: t.category_id || null }, { conditions: built.conditions })).length
        : 0,
    [built.conditions, transactions]
  );

  const save = async () => {
    if (!built.complete || built.conditions.length === 0 || built.actions.length === 0) {
      setError('Fill in every condition and action, or remove the empty ones.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        stage,
        conditions: built.conditions,
        actions: built.actions,
        description: description.trim() || null,
        sort_order: rule?.sort_order ?? 0,
        // Editing a learned rule makes it the user's own, so learning won't change it again.
        is_auto: false,
        is_enabled: rule?.is_enabled ?? true,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the rule');
    } finally {
      setSaving(false);
    }
  };

  const choiceOptions = (field: ConditionField | ActionField) => {
    switch (field) {
      case 'type':
        return ['expense', 'income', 'transfer'].map((t) => <option key={t} value={t}>{t}</option>);
      case 'account_id':
        return accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>);
      case 'category_id':
        return categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.type})</option>);
      case 'subcategory_id':
        return subcategories.map((s) => (
          <option key={s.id} value={s.id}>
            {categories.find((c) => c.id === s.category_id)?.name ?? '?'} / {s.name}
          </option>
        ));
      case 'debt_id':
        return debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>);
      default:
        return null;
    }
  };

  const isChoice = (field: string) => ['type', 'account_id', 'category_id', 'subcategory_id', 'debt_id'].includes(field);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit rule' : 'New rule'}</DialogTitle>
          <DialogDescription>
            When every condition matches, the actions run. Rules run on imports and suggest categories when you add a
            transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>If</Label>
            <div className="mt-2 space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
                  <Select
                    value={c.field}
                    onChange={(e) => {
                      const field = e.target.value as ConditionField;
                      const ops = opsForField(field);
                      setConditions(conditions.map((x, j) => (j === i ? { field, op: ops[0].value, value: '' } : x)));
                    }}
                    aria-label="Condition field"
                  >
                    {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                  <Select
                    value={c.op}
                    onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as RuleCondition['op'] } : x)))}
                    aria-label="Condition operator"
                  >
                    {opsForField(c.field).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  {isChoice(c.field) ? (
                    <Select
                      value={c.value}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      aria-label="Condition value"
                    >
                      <option value="">Choose...</option>
                      {choiceOptions(c.field)}
                    </Select>
                  ) : (
                    <Input
                      type={c.field === 'amount' ? 'number' : c.field === 'date' ? 'date' : 'text'}
                      step={c.field === 'amount' ? '0.01' : undefined}
                      value={c.value}
                      placeholder={c.field === 'amount' ? 'Amount in rand' : 'e.g. checkers, pick n pay'}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      aria-label="Condition value"
                    />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setConditions(conditions.filter((_, j) => j !== i))} aria-label="Remove condition">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setConditions([...conditions, { field: 'imported_payee', op: 'contains', value: '' }])}>
                <Plus className="mr-1 h-4 w-4" /> Add condition
              </Button>
              <p className="text-xs text-muted-foreground">
                Separate several words with commas to match any of them. &ldquo;Bank description&rdquo; uses the title for
                transactions you added by hand. Matches {matchCount} of your transactions.
              </p>
            </div>
          </div>

          <div>
            <Label>Then</Label>
            <div className="mt-2 space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.6fr_auto] gap-2">
                  <Select
                    value={a.field}
                    onChange={(e) => setActions(actions.map((x, j) => (j === i ? { field: e.target.value as ActionField, value: '' } : x)))}
                    aria-label="Action"
                  >
                    {ACTION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                  {a.field === 'exclude_from_budget' ? (
                    <p className="self-center text-sm text-muted-foreground">Leaves these out of budgets</p>
                  ) : isChoice(a.field) ? (
                    <Select
                      value={a.value}
                      onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      aria-label="Action value"
                    >
                      <option value="">Choose...</option>
                      {choiceOptions(a.field)}
                    </Select>
                  ) : (
                    <Input
                      value={a.value}
                      placeholder={a.field === 'tags' ? 'e.g. groceries, monthly' : ''}
                      onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      aria-label="Action value"
                    />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setActions(actions.filter((_, j) => j !== i))} aria-label="Remove action">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setActions([...actions, { field: 'title', value: '' }])}>
                <Plus className="mr-1 h-4 w-4" /> Add action
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rule-stage">Runs</Label>
              <Select id="rule-stage" value={stage} onChange={(e) => setStage(e.target.value as RuleStage)}>
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-description">Name (optional)</Label>
              <Input id="rule-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save rule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
