import { normaliseText, orderRules, ruleMatches } from './engine';
import type { Rule, RuleCondition, RuleDraft, RuleSubject } from './types';

/** The text a payee is recognised by: the bank's description if imported, else the title. */
export function payeeCondition(subject: Pick<RuleSubject, 'imported_payee' | 'title'>): RuleCondition | null {
  const field = subject.imported_payee ? 'imported_payee' : 'title';
  const value = (subject.imported_payee || subject.title || '').trim();
  return value ? { field, op: 'is', value } : null;
}

function samePayee(a: RuleCondition, b: RuleCondition): boolean {
  return a.field === b.field && a.op === 'is' && b.op === 'is' && normaliseText(String(a.value)) === normaliseText(String(b.value));
}

/** A rule learned for one payee: one "is" condition and one category action. */
export function isLearnedRuleFor(rule: Rule, condition: RuleCondition): boolean {
  return (
    rule.is_auto &&
    rule.stage === 'default' &&
    rule.conditions.length === 1 &&
    samePayee(rule.conditions[0], condition)
  );
}

interface CategorisedTransaction extends Pick<RuleSubject, 'imported_payee' | 'title' | 'type'> {
  category_id?: string | null;
  date: string;
}

/**
 * The category used most often for this payee and type. A tie goes to the most recent
 * one, so a payee recategorised once and once only follows the latest choice.
 */
export function mostCommonCategory(
  transactions: CategorisedTransaction[],
  condition: RuleCondition,
  type: RuleSubject['type']
): string | null {
  const counts = new Map<string, { count: number; latest: string }>();
  for (const t of transactions) {
    if (!t.category_id || t.type !== type) continue;
    const own = payeeCondition(t);
    if (!own || !samePayee(own, condition)) continue;
    const entry = counts.get(t.category_id) ?? { count: 0, latest: '' };
    entry.count += 1;
    if (t.date > entry.latest) entry.latest = t.date;
    counts.set(t.category_id, entry);
  }
  let best: string | null = null;
  let bestEntry = { count: 0, latest: '' };
  for (const [id, entry] of counts) {
    if (entry.count > bestEntry.count || (entry.count === bestEntry.count && entry.latest > bestEntry.latest)) {
      best = id;
      bestEntry = entry;
    }
  }
  return best;
}

export type LearningChange =
  | { kind: 'create'; draft: RuleDraft }
  | { kind: 'update'; ruleId: string; actions: Rule['actions'] };

/**
 * After the user categorises a transaction, works out the learned rule for its payee.
 * `transactions` must already include the change. Returns null when nothing should change:
 * a rule the user wrote already sets the category, or the learned rule already agrees.
 */
export function planCategoryLearning(
  rules: Rule[],
  transactions: CategorisedTransaction[],
  changed: RuleSubject
): LearningChange | null {
  if (changed.type === 'transfer' || !changed.category_id) return null;
  const condition = payeeCondition(changed);
  if (!condition) return null;

  const userRuleSetsCategory = orderRules(rules).some(
    (rule) =>
      !rule.is_auto &&
      rule.actions.some((a) => a.field === 'category_id') &&
      ruleMatches(changed, rule)
  );
  if (userRuleSetsCategory) return null;

  const category = mostCommonCategory(transactions, condition, changed.type) ?? changed.category_id;
  const actions: Rule['actions'] = [{ field: 'category_id', op: 'set', value: category }];
  const existing = rules.find((rule) => isLearnedRuleFor(rule, condition));

  if (existing) {
    const current = existing.actions.find((a) => a.field === 'category_id')?.value;
    return current === category ? null : { kind: 'update', ruleId: existing.id, actions };
  }

  return {
    kind: 'create',
    draft: {
      stage: 'default',
      conditions: [condition],
      actions,
      description: null,
      sort_order: 0,
      is_auto: true,
      is_enabled: true,
    },
  };
}

/**
 * When the title of an imported transaction is changed, a "pre" rule can rename every
 * future transaction from the same bank description. Null when there's nothing to offer.
 */
export function planPayeeRename(
  rules: Rule[],
  subject: Pick<RuleSubject, 'imported_payee'>,
  newTitle: string
): LearningChange | null {
  const payee = subject.imported_payee?.trim();
  const title = newTitle.trim();
  if (!payee || !title || normaliseText(payee) === normaliseText(title)) return null;

  const condition: RuleCondition = { field: 'imported_payee', op: 'is', value: payee };
  const actions: Rule['actions'] = [{ field: 'title', op: 'set', value: title }];
  const existing = rules.find(
    (rule) => rule.stage === 'pre' && rule.conditions.length === 1 && samePayee(rule.conditions[0], condition) &&
      rule.actions.length === 1 && rule.actions[0].field === 'title'
  );

  if (existing) {
    return existing.actions[0].value === title ? null : { kind: 'update', ruleId: existing.id, actions };
  }
  return {
    kind: 'create',
    draft: { stage: 'pre', conditions: [condition], actions, description: null, sort_order: 0, is_auto: false, is_enabled: true },
  };
}
