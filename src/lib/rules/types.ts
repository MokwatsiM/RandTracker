export type RuleStage = 'pre' | 'default' | 'post';

export type ConditionField =
  | 'imported_payee'
  | 'title'
  | 'notes'
  | 'account_id'
  | 'category_id'
  | 'type'
  | 'amount'
  | 'date';

export type ConditionOp =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'does_not_contain'
  | 'one_of'
  | 'not_one_of'
  | 'matches'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

/**
 * Text values are compared without case. For `contains` and `does_not_contain` the value
 * can be a list, meaning "any of". Amounts are positive cents; use `type` for direction.
 */
export interface RuleCondition {
  field: ConditionField;
  op: ConditionOp;
  value: string | number | string[];
}

export type ActionField =
  | 'category_id'
  | 'subcategory_id'
  | 'title'
  | 'notes'
  | 'tags'
  | 'exclude_from_budget'
  | 'debt_id';

export type ActionOp = 'set' | 'append' | 'prepend';

export interface RuleAction {
  field: ActionField;
  op: ActionOp;
  value: string | boolean | string[] | null;
}

export interface Rule {
  id: string;
  user_id: string;
  stage: RuleStage;
  conditions: RuleCondition[];
  actions: RuleAction[];
  description?: string | null;
  sort_order: number;
  is_auto: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type RuleDraft = Omit<Rule, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

/** The parts of a transaction rules can read and change. */
export interface RuleSubject {
  imported_payee?: string | null;
  title: string;
  notes?: string | null;
  account_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  tags?: string[] | null;
  exclude_from_budget?: boolean;
  is_debt_payment?: boolean;
  debt_id?: string | null;
}
