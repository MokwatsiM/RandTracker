import { create } from 'zustand';
import type { Schedule, ScheduleDraft } from '@/lib/schedules/types';
import {
  createScheduleRecord,
  deleteScheduleRecord,
  fetchSchedules,
  postDueSchedules,
  recordScheduleOccurrence,
  skipScheduleOccurrence,
  updateScheduleRecord,
} from '@/lib/supabase/data';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useDebtStore } from '@/stores/debtStore';

interface ScheduleStore {
  schedules: Schedule[];
  loadedFor: string | null;
  isLoading: boolean;
  error: string | null;
  /** The user whose due schedules were posted this session, so it only happens once. */
  postedFor: string | null;
  loadSchedules: (userId: string, options?: { force?: boolean }) => Promise<Schedule[]>;
  createSchedule: (userId: string, draft: ScheduleDraft) => Promise<Schedule>;
  updateSchedule: (id: string, updates: Partial<ScheduleDraft>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  /** Approves the next occurrence, optionally with a different amount or date. */
  recordOccurrence: (userId: string, id: string, amount?: number, date?: string) => Promise<void>;
  skipOccurrence: (userId: string, id: string) => Promise<void>;
  /** Posts due automatic schedules once per session, then refreshes what changed. */
  postDue: (userId: string) => Promise<number>;
}

// Recording or posting adds transactions and moves schedules on in the database, so
// everything those touch is read again.
async function refreshAfterPosting(userId: string) {
  await Promise.all([
    useTransactionStore.getState().loadTransactions(userId, { force: true }),
    useAccountStore.getState().loadAccounts(userId),
    useDebtStore.getState().loadDebts(userId),
    useScheduleStore.getState().loadSchedules(userId, { force: true }),
  ]);
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  loadedFor: null,
  isLoading: false,
  error: null,
  postedFor: null,

  loadSchedules: async (userId, options) => {
    if (!options?.force && get().loadedFor === userId) {
      return get().schedules;
    }
    set({ isLoading: true, error: null });
    try {
      const schedules = await fetchSchedules(userId);
      set({ schedules, loadedFor: userId, isLoading: false });
      return schedules;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return get().schedules;
    }
  },

  createSchedule: async (userId, draft) => {
    const created = await createScheduleRecord(userId, draft);
    set((state) => ({ schedules: [...state.schedules, created] }));
    return created;
  },

  updateSchedule: async (id, updates) => {
    const updated = await updateScheduleRecord(id, updates);
    set((state) => ({ schedules: state.schedules.map((s) => (s.id === id ? updated : s)) }));
  },

  deleteSchedule: async (id) => {
    await deleteScheduleRecord(id);
    set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) }));
  },

  recordOccurrence: async (userId, id, amount, date) => {
    await recordScheduleOccurrence(id, amount, date);
    await refreshAfterPosting(userId);
  },

  skipOccurrence: async (userId, id) => {
    await skipScheduleOccurrence(id);
    await get().loadSchedules(userId, { force: true });
  },

  postDue: async (userId) => {
    if (get().postedFor === userId) return 0;
    set({ postedFor: userId });
    const posted = await postDueSchedules();
    if (posted > 0) await refreshAfterPosting(userId);
    return posted;
  },
}));
