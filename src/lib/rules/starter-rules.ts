import type { RuleDraft } from './types';

interface StarterRule {
  /** Category names to look for, in order; the user's categories come from seed.ts. */
  category: string[];
  subcategory?: string;
  type: 'income' | 'expense';
  /**
   * Text the bank description contains. A space at either end means a word boundary:
   * " pep " matches "PEP 1234 SOWETO" but not "PEPPERTREE".
   */
  payees: string[];
}

// South African merchants. This replaces the merchant list the FNB PDF parser had built
// in, and unlike that list the user can edit or delete any of these.
export const STARTER_RULES: StarterRule[] = [
  { category: ['Groceries', 'Groceries & Food'], subcategory: 'Supermarket', type: 'expense',
    payees: ['checkers', 'pick n pay', ' pnp ', 'woolworths', ' spar ', 'superspar', 'kwikspar', 'shoprite', 'food lover', ' usave ', 'boxer super'] },
  { category: ['Transport & Petrol'], subcategory: 'Petrol', type: 'expense',
    payees: ['engen', ' shell ', 'sasol', 'caltex', 'astron energy', ' bp ', 'bp express', 'totalenergies'] },
  { category: ['Transport & Petrol'], subcategory: 'Uber', type: 'expense',
    payees: [' uber ', 'bolt.eu', ' bolt '] },
  { category: ['Transport & Petrol'], subcategory: 'Tolls', type: 'expense',
    payees: ['sanral', ' e-toll', ' toll plaza'] },
  { category: ['Transport & Petrol'], type: 'expense',
    payees: ['gautrain', 'myciti', 'rea vaya'] },
  { category: ['Eating Out', 'Restaurants & Takeaways'], subcategory: 'Takeaways', type: 'expense',
    // Each entry is longer than " uber ", so this rule counts as more specific and wins.
    payees: ['uber eats', 'mr d food', 'mrdfood'] },
  { category: ['Eating Out', 'Restaurants & Takeaways'], subcategory: 'Fast Food', type: 'expense',
    payees: [' kfc ', 'mcdonald', 'nando', ' steers ', 'wimpy', 'debonairs', 'roman\'s pizza', 'burger king', 'chicken licken', 'fishaways', 'pedros'] },
  { category: ['Eating Out', 'Restaurants & Takeaways'], subcategory: 'Restaurants', type: 'expense',
    payees: [' spur ', 'ocean basket', 'rocomamas', 'mugg & bean', 'col\'cacchio'] },
  { category: ['Eating Out', 'Restaurants & Takeaways'], subcategory: 'Coffee', type: 'expense',
    payees: ['starbucks', 'vida e', 'seattle coffee', 'bootlegger'] },
  { category: ['Airtime & Data'], type: 'expense',
    payees: ['vodacom', ' mtn ', 'cell c', 'telkom', ' rain '] },
  { category: ['Electricity & Utilities'], subcategory: 'Prepaid Electricity', type: 'expense',
    payees: ['eskom', 'prepaid elec', 'city power'] },
  { category: ['Medical Aid & Healthcare', 'Medical Aid & Health'], subcategory: 'Pharmacy', type: 'expense',
    payees: ['dis-chem', 'dischem', 'medirite'] },
  { category: ['Personal Care'], subcategory: 'Toiletries', type: 'expense',
    payees: ['clicks'] },
  { category: ['Insurance'], type: 'expense',
    payees: ['outsurance', 'santam', 'miway', 'king price', 'budget insurance', 'discovery insure'] },
  { category: ['Entertainment'], subcategory: 'Streaming', type: 'expense',
    payees: ['netflix', 'showmax', ' dstv ', 'multichoice', 'spotify', 'youtube', 'disney', 'apple.com/bill', 'deezer'] },
  { category: ['Entertainment'], subcategory: 'Movies', type: 'expense',
    payees: ['ster-kinekor', 'ster kinekor', 'nu metro'] },
  { category: ['Clothing & Fashion', 'Clothing & Personal'], subcategory: 'Clothes', type: 'expense',
    payees: ['mr price', ' pep ', 'ackermans', 'edgars', 'truworths', 'foschini', 'markham', 'cotton on', ' h&m ', ' zara ', 'sportscene', 'totalsports', ' jet '] },
  { category: ['Home & Garden'], type: 'expense',
    payees: ['builders', 'cashbuild', 'leroy merlin', 'game stores', ' game '] },
  { category: ['Salary'], type: 'income',
    payees: [' salary', ' salaris', ' payroll'] },
];

interface CategoryLike {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface SubcategoryLike {
  id: string;
  category_id: string;
  name: string;
}

/**
 * Builds rules for the categories this user has. Rules whose category isn't found are
 * left out, so renamed or deleted categories don't get stray rules.
 */
export function buildStarterRules(categories: CategoryLike[], subcategories: SubcategoryLike[]): RuleDraft[] {
  const drafts: RuleDraft[] = [];

  for (const starter of STARTER_RULES) {
    const category = starter.category
      .map((name) => categories.find((c) => c.type === starter.type && c.name.toLowerCase() === name.toLowerCase()))
      .find(Boolean);
    if (!category) continue;

    const subcategory = starter.subcategory
      ? subcategories.find(
          (s) => s.category_id === category.id && s.name.toLowerCase() === starter.subcategory!.toLowerCase()
        )
      : undefined;

    drafts.push({
      stage: 'default',
      conditions: [
        { field: 'type', op: 'is', value: starter.type },
        { field: 'imported_payee', op: 'contains', value: starter.payees },
      ],
      actions: [
        { field: 'category_id', op: 'set', value: category.id },
        ...(subcategory ? [{ field: 'subcategory_id' as const, op: 'set' as const, value: subcategory.id }] : []),
      ],
      description: `Starter: ${category.name}${subcategory ? ` / ${subcategory.name}` : ''}`,
      sort_order: 0,
      is_auto: false,
      is_enabled: true,
    });
  }

  return drafts;
}
