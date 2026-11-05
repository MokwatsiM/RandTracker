import { describe, expect, it } from 'vitest';
import { applyRules, conditionMatches, orderRules, ruleMatches } from './engine';
import { mostCommonCategory, planCategoryLearning, planPayeeRename } from './learn';
import { buildStarterRules } from './starter-rules';
import type { Rule, RuleSubject } from './types';

let nextId = 0;
function rule(partial: Partial<Rule>): Rule {
  nextId += 1;
  return {
    id: `r${nextId}`,
    user_id: 'u',
    stage: 'default',
    conditions: [],
    actions: [],
    sort_order: 0,
    is_auto: false,
    is_enabled: true,
    created_at: `2026-01-01T00:00:${String(nextId).padStart(2, '0')}Z`,
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

const base: RuleSubject = {
  imported_payee: 'CHECKERS HYPER 1234 SANDTON',
  title: 'CHECKERS HYPER 1234 SANDTON',
  account_id: 'acc',
  type: 'expense',
  amount: 45_000,
  date: '2026-11-05',
};

describe('conditions', () => {
  it('compares text without case and accepts a list for contains', () => {
    expect(conditionMatches(base, { field: 'imported_payee', op: 'contains', value: 'checkers' })).toBe(true);
    expect(conditionMatches(base, { field: 'imported_payee', op: 'contains', value: ['woolworths', 'hyper'] })).toBe(true);
    expect(conditionMatches(base, { field: 'imported_payee', op: 'does_not_contain', value: ['woolworths'] })).toBe(true);
    expect(conditionMatches(base, { field: 'imported_payee', op: 'is', value: 'checkers hyper 1234  sandton' })).toBe(true);
  });

  it('treats spaces at the ends of a value as word boundaries', () => {
    const pep = { ...base, imported_payee: 'PEP 4471 SOWETO' };
    const pepper = { ...base, imported_payee: 'PEPPERTREE GRILL' };
    const condition = { field: 'imported_payee' as const, op: 'contains' as const, value: ' pep ' };
    expect(conditionMatches(pep, condition)).toBe(true);
    expect(conditionMatches(pepper, condition)).toBe(false);
  });

  it('falls back to the title for transactions entered by hand', () => {
    const manual = { ...base, imported_payee: null, title: 'Woolworths Food' };
    expect(conditionMatches(manual, { field: 'imported_payee', op: 'contains', value: 'woolworths' })).toBe(true);
  });

  it('compares amounts in cents, ignoring sign', () => {
    expect(conditionMatches({ ...base, amount: -45_000 }, { field: 'amount', op: 'gte', value: 45_000 })).toBe(true);
    expect(conditionMatches(base, { field: 'amount', op: 'lt', value: 45_000 })).toBe(false);
  });

  it('treats a bad pattern as no match instead of throwing', () => {
    expect(conditionMatches(base, { field: 'title', op: 'matches', value: '([' })).toBe(false);
    expect(conditionMatches(base, { field: 'title', op: 'matches', value: '^checkers.*\\d{4}' })).toBe(true);
  });

  it('never matches a rule without conditions', () => {
    expect(ruleMatches(base, { conditions: [] })).toBe(false);
  });
});

describe('applying rules', () => {
  const categoryTypes = new Map<string, 'income' | 'expense'>([
    ['groceries', 'expense'],
    ['salary', 'income'],
    ['takeaways', 'expense'],
    ['transport', 'expense'],
  ]);

  it('runs pre, then default, then post, so later stages win', () => {
    const rules = [
      rule({ stage: 'post', conditions: [{ field: 'type', op: 'is', value: 'expense' }], actions: [{ field: 'notes', op: 'append', value: '(post)' }] }),
      rule({ stage: 'pre', conditions: [{ field: 'imported_payee', op: 'contains', value: 'checkers' }], actions: [{ field: 'title', op: 'set', value: 'Checkers' }] }),
      rule({ conditions: [{ field: 'title', op: 'is', value: 'Checkers' }], actions: [{ field: 'category_id', op: 'set', value: 'groceries' }] }),
    ];
    const { subject, applied } = applyRules(base, rules, { categoryTypes });
    expect(subject.title).toBe('Checkers');
    expect(subject.category_id).toBe('groceries');
    expect(subject.notes).toBe('(post)');
    expect(applied).toEqual([rules[1].id, rules[2].id, rules[0].id]);
  });

  it('lets the more specific rule win within a stage', () => {
    const uber = rule({ conditions: [{ field: 'imported_payee', op: 'contains', value: ' uber ' }], actions: [{ field: 'category_id', op: 'set', value: 'transport' }] });
    const eats = rule({ conditions: [{ field: 'imported_payee', op: 'contains', value: ['uber eats', 'mrdfood'] }], actions: [{ field: 'category_id', op: 'set', value: 'takeaways' }] });
    const exact = rule({ conditions: [{ field: 'imported_payee', op: 'is', value: 'UBER TRIP HELP.UBER.COM' }], actions: [{ field: 'notes', op: 'set', value: 'exact' }] });
    for (const order of [[uber, eats], [eats, uber]]) {
      expect(applyRules({ ...base, imported_payee: 'UBER EATS SA' }, order, { categoryTypes }).subject.category_id).toBe('takeaways');
      expect(applyRules({ ...base, imported_payee: 'UBER TRIP HELP.UBER.COM' }, order, { categoryTypes }).subject.category_id).toBe('transport');
    }
    expect(orderRules([exact, uber]).map((r) => r.id)).toEqual([uber.id, exact.id]);
  });

  it('skips disabled rules', () => {
    const r = rule({ is_enabled: false, conditions: [{ field: 'type', op: 'is', value: 'expense' }], actions: [{ field: 'category_id', op: 'set', value: 'groceries' }] });
    expect(applyRules(base, [r]).subject.category_id).toBeUndefined();
  });

  it("won't put an income category on an expense", () => {
    const r = rule({ conditions: [{ field: 'type', op: 'is', value: 'expense' }], actions: [{ field: 'category_id', op: 'set', value: 'salary' }] });
    const result = applyRules(base, [r], { categoryTypes });
    expect(result.subject.category_id).toBeUndefined();
    expect(result.applied).toEqual([]);
  });

  it('clears the subcategory when the category changes, unless the rule sets one', () => {
    const withSub = { ...base, category_id: 'transport', subcategory_id: 'petrol' };
    const onlyCategory = rule({ conditions: [{ field: 'type', op: 'is', value: 'expense' }], actions: [{ field: 'category_id', op: 'set', value: 'groceries' }] });
    expect(applyRules(withSub, [onlyCategory]).subject.subcategory_id).toBeNull();
    const both = rule({ conditions: [{ field: 'type', op: 'is', value: 'expense' }], actions: [{ field: 'category_id', op: 'set', value: 'groceries' }, { field: 'subcategory_id', op: 'set', value: 'supermarket' }] });
    expect(applyRules(withSub, [both]).subject.subcategory_id).toBe('supermarket');
  });

  it('adds tags without duplicates and marks debt payments', () => {
    const r = rule({
      conditions: [{ field: 'type', op: 'is', value: 'expense' }],
      actions: [{ field: 'tags', op: 'append', value: 'food, monthly' }, { field: 'debt_id', op: 'set', value: 'car' }],
    });
    const { subject } = applyRules({ ...base, tags: ['monthly'] }, [r]);
    expect(subject.tags).toEqual(['monthly', 'food']);
    expect(subject.is_debt_payment).toBe(true);
    expect(subject.debt_id).toBe('car');
  });
});

describe('learning', () => {
  const history = [
    { imported_payee: 'SPAR NORTHCLIFF', title: 'Spar', type: 'expense' as const, category_id: 'groceries', date: '2026-10-01' },
    { imported_payee: 'SPAR NORTHCLIFF', title: 'Spar', type: 'expense' as const, category_id: 'groceries', date: '2026-10-08' },
    { imported_payee: 'SPAR NORTHCLIFF', title: 'Spar', type: 'expense' as const, category_id: 'eating_out', date: '2026-10-15' },
  ];

  it('picks the most common category for a payee', () => {
    expect(mostCommonCategory(history, { field: 'imported_payee', op: 'is', value: 'spar northcliff' }, 'expense')).toBe('groceries');
  });

  it('creates a learned rule, then updates it only when the answer changes', () => {
    const changed = { ...base, imported_payee: 'SPAR NORTHCLIFF', title: 'Spar', category_id: 'groceries' };
    const first = planCategoryLearning([], history, changed);
    expect(first?.kind).toBe('create');
    if (first?.kind !== 'create') return;
    expect(first.draft.is_auto).toBe(true);
    expect(first.draft.conditions).toEqual([{ field: 'imported_payee', op: 'is', value: 'SPAR NORTHCLIFF' }]);

    const learned = rule({ ...first.draft });
    expect(planCategoryLearning([learned], history, changed)).toBeNull();

    const moreEatingOut = [...history, ...[1, 2].map((i) => ({ ...history[2], date: `2026-11-0${i}` }))];
    const update = planCategoryLearning([learned], moreEatingOut, { ...changed, category_id: 'eating_out' });
    expect(update).toEqual({ kind: 'update', ruleId: learned.id, actions: [{ field: 'category_id', op: 'set', value: 'eating_out' }] });
  });

  it("doesn't learn when a rule the user wrote already sets the category", () => {
    const own = rule({ conditions: [{ field: 'imported_payee', op: 'contains', value: 'spar' }], actions: [{ field: 'category_id', op: 'set', value: 'groceries' }] });
    expect(planCategoryLearning([own], history, { ...base, imported_payee: 'SPAR NORTHCLIFF', category_id: 'eating_out' })).toBeNull();
  });

  it('offers a rename rule only for imported transactions whose title changed', () => {
    expect(planPayeeRename([], { imported_payee: null }, 'Spar')).toBeNull();
    expect(planPayeeRename([], { imported_payee: 'Spar' }, 'spar')).toBeNull();
    const plan = planPayeeRename([], { imported_payee: 'SPAR NORTHCLIFF 0042' }, 'Spar');
    expect(plan?.kind === 'create' && plan.draft.stage).toBe('pre');
  });
});

describe('starter rules', () => {
  const categories = [
    { id: 'g', name: 'Groceries', type: 'expense' as const },
    { id: 't', name: 'Transport & Petrol', type: 'expense' as const },
    { id: 'e', name: 'Eating Out', type: 'expense' as const },
    { id: 's', name: 'Salary', type: 'income' as const },
  ];
  const subcategories = [
    { id: 'g1', category_id: 'g', name: 'Supermarket' },
    { id: 't1', category_id: 't', name: 'Uber' },
    { id: 'e1', category_id: 'e', name: 'Takeaways' },
  ];
  const rules = buildStarterRules(categories, subcategories).map((draft) => rule(draft));
  const categoryTypes = new Map(categories.map((c) => [c.id, c.type]));
  const run = (payee: string, type: RuleSubject['type'] = 'expense') =>
    applyRules({ ...base, type, imported_payee: payee, title: payee }, rules, { categoryTypes }).subject;

  it('only includes rules for categories the user has', () => {
    expect(rules.every((r) => ['g', 't', 'e', 's'].includes(String(r.actions[0].value)))).toBe(true);
  });

  it('categorises common South African merchants', () => {
    expect(run('PNP FAMILY ROSEBANK')).toMatchObject({ category_id: 'g', subcategory_id: 'g1' });
    expect(run('ENGEN QUICKSHOP N1')).toMatchObject({ category_id: 't' });
    expect(run('UBER EATS SA')).toMatchObject({ category_id: 'e', subcategory_id: 'e1' });
    expect(run('UBER *TRIP')).toMatchObject({ category_id: 't', subcategory_id: 't1' });
    expect(run('ACME LTD SALARY', 'income')).toMatchObject({ category_id: 's' });
    expect(run('ACME LTD SALARY', 'expense').category_id).toBeUndefined();
    expect(run('UNKNOWN SHOP').category_id).toBeUndefined();
  });
});
