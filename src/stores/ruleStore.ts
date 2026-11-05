import { create } from 'zustand';
import type { Rule, RuleDraft, RuleSubject } from '@/lib/rules/types';
import { planCategoryLearning, planPayeeRename, type LearningChange } from '@/lib/rules/learn';
import { createRuleRecords, deleteRuleRecord, fetchRules, updateRuleRecord } from '@/lib/supabase/data';

interface RuleStore {
  rules: Rule[];
  loadedFor: string | null;
  isLoading: boolean;
  error: string | null;
  loadRules: (userId: string, options?: { force?: boolean }) => Promise<Rule[]>;
  createRules: (userId: string, drafts: RuleDraft[]) => Promise<Rule[]>;
  updateRule: (id: string, updates: Partial<RuleDraft>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  /**
   * Teaches the learned rule for each changed transaction's payee. `transactions` must
   * already include the changes. Returns how many rules were created or updated.
   */
  learnCategories: (
    userId: string,
    changed: RuleSubject[],
    transactions: Parameters<typeof planCategoryLearning>[1]
  ) => Promise<number>;
  /** Plans a rename rule for an imported transaction; null when there's nothing to offer. */
  planRename: (subject: Pick<RuleSubject, 'imported_payee'>, newTitle: string) => LearningChange | null;
  saveChange: (userId: string, change: LearningChange) => Promise<void>;
}

export const useRuleStore = create<RuleStore>((set, get) => ({
  rules: [],
  loadedFor: null,
  isLoading: false,
  error: null,

  loadRules: async (userId, options) => {
    if (!options?.force && get().loadedFor === userId) {
      return get().rules;
    }
    set({ isLoading: true, error: null });
    try {
      const rules = await fetchRules(userId);
      set({ rules, loadedFor: userId, isLoading: false });
      return rules;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return get().rules;
    }
  },

  createRules: async (userId, drafts) => {
    const created = await createRuleRecords(userId, drafts);
    set((state) => ({ rules: [...state.rules, ...created] }));
    return created;
  },

  updateRule: async (id, updates) => {
    const updated = await updateRuleRecord(id, updates);
    set((state) => ({ rules: state.rules.map((rule) => (rule.id === id ? updated : rule)) }));
  },

  deleteRule: async (id) => {
    await deleteRuleRecord(id);
    set((state) => ({ rules: state.rules.filter((rule) => rule.id !== id) }));
  },

  learnCategories: async (userId, changed, transactions) => {
    let count = 0;
    for (const subject of changed) {
      // Planned one at a time against the latest rules, so two rows for the same payee
      // update one learned rule instead of creating two.
      const change = planCategoryLearning(get().rules, transactions, subject);
      if (!change) continue;
      await get().saveChange(userId, change);
      count += 1;
    }
    return count;
  },

  planRename: (subject, newTitle) => planPayeeRename(get().rules, subject, newTitle),

  saveChange: async (userId, change) => {
    if (change.kind === 'create') {
      await get().createRules(userId, [change.draft]);
    } else {
      await get().updateRule(change.ruleId, { actions: change.actions });
    }
  },
}));
