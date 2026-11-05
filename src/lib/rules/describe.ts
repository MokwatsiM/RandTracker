import type { ActionField, ConditionField, ConditionOp, RuleAction, RuleCondition } from './types';

export const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'imported_payee', label: 'Bank description' },
  { value: 'title', label: 'Title' },
  { value: 'notes', label: 'Notes' },
  { value: 'amount', label: 'Amount' },
  { value: 'type', label: 'Type' },
  { value: 'account_id', label: 'Account' },
  { value: 'category_id', label: 'Category' },
  { value: 'date', label: 'Date' },
];

export const TEXT_OPS: { value: ConditionOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'does_not_contain', label: "doesn't contain" },
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'matches', label: 'matches pattern' },
];

export const NUMBER_OPS: { value: ConditionOp; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'gt', label: 'is more than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is at most' },
];

export const CHOICE_OPS: { value: ConditionOp; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
];

export function opsForField(field: ConditionField) {
  if (field === 'amount' || field === 'date') return NUMBER_OPS;
  if (field === 'type' || field === 'account_id' || field === 'category_id') return CHOICE_OPS;
  return TEXT_OPS;
}

export const ACTION_FIELDS: { value: ActionField; label: string }[] = [
  { value: 'category_id', label: 'Set category' },
  { value: 'subcategory_id', label: 'Set subcategory' },
  { value: 'title', label: 'Set title' },
  { value: 'notes', label: 'Add to notes' },
  { value: 'tags', label: 'Add tags' },
  { value: 'exclude_from_budget', label: 'Exclude from budget' },
  { value: 'debt_id', label: 'Mark as payment for debt' },
];

export interface NameLookup {
  account: (id: string) => string | undefined;
  category: (id: string) => string | undefined;
  subcategory: (id: string) => string | undefined;
  debt: (id: string) => string | undefined;
}

const formatRand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

function describeValue(field: ConditionField | ActionField, value: unknown, names: NameLookup): string {
  if (Array.isArray(value)) {
    return value.map((v) => `“${String(v).trim()}”`).join(', ');
  }
  switch (field) {
    case 'amount': return formatRand(Number(value));
    case 'account_id': return names.account(String(value)) ?? 'an account';
    case 'category_id': return names.category(String(value)) ?? 'a deleted category';
    case 'subcategory_id': return names.subcategory(String(value)) ?? 'a deleted subcategory';
    case 'debt_id': return names.debt(String(value)) ?? 'a deleted debt';
    case 'type': return String(value);
    default: return `“${String(value)}”`;
  }
}

export function describeCondition(condition: RuleCondition, names: NameLookup): string {
  const field = CONDITION_FIELDS.find((f) => f.value === condition.field)?.label ?? condition.field;
  const op = [...TEXT_OPS, ...NUMBER_OPS].find((o) => o.value === condition.op)?.label ?? condition.op;
  const anyOf = Array.isArray(condition.value) && condition.value.length > 1 ? ' any of' : '';
  return `${field} ${op}${anyOf} ${describeValue(condition.field, condition.value, names)}`;
}

export function describeAction(action: RuleAction, names: NameLookup): string {
  switch (action.field) {
    case 'category_id': return `category → ${describeValue('category_id', action.value, names)}`;
    case 'subcategory_id': return `subcategory → ${describeValue('subcategory_id', action.value, names)}`;
    case 'title': return `title → “${String(action.value)}”`;
    case 'notes': return `add note “${String(action.value)}”`;
    case 'tags': return `tags + ${Array.isArray(action.value) ? action.value.join(', ') : String(action.value)}`;
    case 'exclude_from_budget': return action.value ? 'exclude from budget' : 'include in budget';
    case 'debt_id': return `payment for ${describeValue('debt_id', action.value, names)}`;
  }
}
