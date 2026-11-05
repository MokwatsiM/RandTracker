import type { Rule, RuleAction, RuleCondition, RuleStage, RuleSubject } from './types';

const STAGES: RuleStage[] = ['pre', 'default', 'post'];

export interface ApplyOptions {
  /** Category id to its type. A rule never puts an expense category on income, or the reverse. */
  categoryTypes?: Map<string, 'income' | 'expense'>;
}

export interface ApplyResult<T extends RuleSubject> {
  subject: T;
  /** Ids of the rules whose actions ran, in order. */
  applied: string[];
}

/**
 * Lower case, single spaces, and a space at each end, so a value like " pep " matches the
 * word PEP but not "pepper".
 */
export function normaliseText(value: string | null | undefined): string {
  return ` ${(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()} `;
}

function asList(value: RuleCondition['value']): string[] {
  return (Array.isArray(value) ? value : [String(value)]).filter((v) => v.trim() !== '');
}

// Text conditions on the bank's description fall back to the title for transactions
// entered by hand, so the same rules help both.
function fieldValue(subject: RuleSubject, field: RuleCondition['field']): string | number | null {
  switch (field) {
    case 'imported_payee':
      return subject.imported_payee || subject.title;
    case 'title':
      return subject.title;
    case 'notes':
      return subject.notes ?? '';
    case 'account_id':
      return subject.account_id;
    case 'category_id':
      return subject.category_id ?? '';
    case 'type':
      return subject.type;
    case 'amount':
      return Math.abs(subject.amount);
    case 'date':
      return subject.date;
  }
}

export function conditionMatches(subject: RuleSubject, condition: RuleCondition): boolean {
  const actual = fieldValue(subject, condition.field);

  if (condition.field === 'amount') {
    const amount = Number(actual);
    const target = Number(condition.value);
    if (!Number.isFinite(target)) return false;
    switch (condition.op) {
      case 'is': return amount === target;
      case 'is_not': return amount !== target;
      case 'gt': return amount > target;
      case 'gte': return amount >= target;
      case 'lt': return amount < target;
      case 'lte': return amount <= target;
      default: return false;
    }
  }

  const text = String(actual ?? '');

  if (condition.field === 'date') {
    const target = String(condition.value);
    switch (condition.op) {
      case 'is': return text === target;
      case 'is_not': return text !== target;
      case 'gt': return text > target;
      case 'gte': return text >= target;
      case 'lt': return text < target;
      case 'lte': return text <= target;
      default: return false;
    }
  }

  const haystack = normaliseText(text);
  const values = asList(condition.value);
  const equalsAny = () => values.some((v) => normaliseText(v) === haystack);
  // Strip the padding from the value unless the user typed spaces on purpose.
  const containsAny = () =>
    values.some((v) => {
      const needle = v.toLowerCase().replace(/\s+/g, ' ');
      return needle.trim() !== '' && haystack.includes(needle);
    });

  switch (condition.op) {
    case 'is':
    case 'one_of':
      return equalsAny();
    case 'is_not':
    case 'not_one_of':
      return !equalsAny();
    case 'contains':
      return containsAny();
    case 'does_not_contain':
      return !containsAny();
    case 'matches':
      return values.some((pattern) => {
        try {
          return new RegExp(pattern, 'i').test(text);
        } catch {
          return false;
        }
      });
    default:
      return false;
  }
}

export function ruleMatches(subject: RuleSubject, rule: Pick<Rule, 'conditions'>): boolean {
  return rule.conditions.length > 0 && rule.conditions.every((c) => conditionMatches(subject, c));
}

const OP_WEIGHT: Record<RuleCondition['op'], number> = {
  is: 10,
  one_of: 8,
  matches: 5,
  contains: 3,
  gt: 2,
  gte: 2,
  lt: 2,
  lte: 2,
  is_not: 1,
  not_one_of: 1,
  does_not_contain: 1,
};

/**
 * Within a stage, rules run from least to most specific, so the most specific one runs
 * last and its changes win. Longer text in a `contains` counts as more specific, so a rule
 * for "uber eats" beats one for "uber".
 */
export function specificity(rule: Pick<Rule, 'conditions'>): number {
  return rule.conditions.reduce((score, c) => {
    let weight = OP_WEIGHT[c.op] ?? 0;
    if (c.op === 'contains' || c.op === 'is') {
      const shortest = Math.min(...asList(c.value).map((v) => v.trim().length));
      weight += Number.isFinite(shortest) ? Math.min(shortest, 50) / 100 : 0;
    }
    return score + weight;
  }, 0);
}

export function orderRules<R extends Rule>(rules: R[]): R[] {
  return STAGES.flatMap((stage) =>
    rules
      .filter((rule) => rule.is_enabled && rule.stage === stage)
      .sort(
        (a, b) =>
          specificity(a) - specificity(b) ||
          a.sort_order - b.sort_order ||
          a.created_at.localeCompare(b.created_at)
      )
  );
}

function applyAction<T extends RuleSubject>(subject: T, action: RuleAction, options: ApplyOptions): T | null {
  const next = { ...subject };
  switch (action.field) {
    case 'category_id': {
      const id = action.value ? String(action.value) : null;
      const categoryType = id ? options.categoryTypes?.get(id) : undefined;
      if (id && categoryType && subject.type !== 'transfer' && categoryType !== subject.type) {
        return null;
      }
      if (id !== subject.category_id) {
        next.subcategory_id = null;
      }
      next.category_id = id;
      return next;
    }
    case 'subcategory_id':
      next.subcategory_id = action.value ? String(action.value) : null;
      return next;
    case 'title': {
      const value = String(action.value ?? '');
      if (action.op === 'append') next.title = `${subject.title}${value}`;
      else if (action.op === 'prepend') next.title = `${value}${subject.title}`;
      else if (value.trim()) next.title = value;
      return next;
    }
    case 'notes': {
      const value = String(action.value ?? '');
      const current = subject.notes ?? '';
      if (action.op === 'append') next.notes = current ? `${current} ${value}` : value;
      else if (action.op === 'prepend') next.notes = current ? `${value} ${current}` : value;
      else next.notes = value;
      return next;
    }
    case 'tags': {
      const value = (Array.isArray(action.value) ? action.value : String(action.value ?? '').split(','))
        .map((tag) => tag.trim())
        .filter(Boolean);
      next.tags = action.op === 'set' ? value : [...new Set([...(subject.tags ?? []), ...value])];
      return next;
    }
    case 'exclude_from_budget':
      next.exclude_from_budget = action.value === true || action.value === 'true';
      return next;
    case 'debt_id':
      if (subject.type !== 'expense') return null;
      next.debt_id = action.value ? String(action.value) : null;
      next.is_debt_payment = Boolean(action.value);
      return next;
  }
}

/** Runs every enabled rule, by stage then specificity, against one transaction. */
export function applyRules<T extends RuleSubject>(
  subject: T,
  rules: Rule[],
  options: ApplyOptions = {}
): ApplyResult<T> {
  let current = subject;
  const applied: string[] = [];

  for (const rule of orderRules(rules)) {
    if (!ruleMatches(current, rule)) continue;
    let changedAny = false;
    for (const action of rule.actions) {
      const next = applyAction(current, action, options);
      if (next) {
        current = next;
        changedAny = true;
      }
    }
    if (changedAny) applied.push(rule.id);
  }

  return { subject: current, applied };
}
