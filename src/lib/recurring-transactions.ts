/**
 * Recurring Transactions Service
 * Handles automatic generation of recurring transactions
 */

import { createClient } from '@/lib/supabase/client';
import type { Transaction } from './db/schema';
import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, format, startOfDay } from 'date-fns';

interface RecurringTransaction extends Transaction {
  is_recurring: true;
  recurrence_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  recurrence_interval?: number;
  recurrence_end_date?: string;
  recurrence_day_of_month?: number;
}

/**
 * Calculate the next occurrence date for a recurring transaction
 */
export function calculateNextOccurrence(
  lastDate: Date,
  frequency: string,
  interval: number = 1,
  dayOfMonth?: number
): Date {
  const next = new Date(lastDate);

  switch (frequency) {
    case 'daily':
      return addDays(next, interval);

    case 'weekly':
      return addWeeks(next, interval);

    case 'biweekly':
      return addWeeks(next, 2 * interval);

    case 'monthly':
      // If day_of_month is specified, use it
      if (dayOfMonth) {
        const nextMonth = addMonths(next, interval);
        nextMonth.setDate(Math.min(dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
        return nextMonth;
      }
      return addMonths(next, interval);

    case 'quarterly':
      return addMonths(next, 3 * interval);

    case 'yearly':
      return addYears(next, interval);

    case 'custom':
      return addDays(next, interval);

    default:
      return addMonths(next, 1); // Default to monthly
  }
}

/**
 * Check if a recurring transaction needs new instances
 */
export function shouldGenerateNextInstance(
  transaction: RecurringTransaction,
  latestInstanceDate: Date,
  currentDate: Date = new Date()
): boolean {
  // Check if recurrence has ended
  if (transaction.recurrence_end_date) {
    const endDate = new Date(transaction.recurrence_end_date);
    if (isAfter(currentDate, endDate)) {
      return false;
    }
  }

  // Calculate next occurrence
  const nextOccurrence = calculateNextOccurrence(
    latestInstanceDate,
    transaction.recurrence_frequency,
    transaction.recurrence_interval,
    transaction.recurrence_day_of_month
  );

  // Should generate if next occurrence is today or in the past
  return !isAfter(nextOccurrence, currentDate);
}

/**
 * Generate the next instance of a recurring transaction
 */
export async function generateNextRecurringInstance(
  transaction: RecurringTransaction,
  nextDate: Date,
  userId: string
): Promise<Transaction | null> {
  const supabase = createClient();

  try {
    const newTransaction = {
      user_id: userId,
      account_id: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      category_id: transaction.category_id,
      subcategory_id: transaction.subcategory_id,
      title: transaction.title,
      notes: transaction.notes,
      date: format(nextDate, 'yyyy-MM-dd'),
      time: transaction.time,
      is_recurring: true,
      recurrence_frequency: transaction.recurrence_frequency,
      recurrence_interval: transaction.recurrence_interval,
      recurrence_end_date: transaction.recurrence_end_date,
      recurrence_day_of_month: transaction.recurrence_day_of_month,
      is_subscription: transaction.is_subscription,
      transfer_account_id: transaction.transfer_account_id,
      is_debt_payment: transaction.is_debt_payment,
      debt_id: transaction.debt_id,
      tags: transaction.tags,
      is_paid: false, // New instances start as unpaid
      exclude_from_budget: transaction.exclude_from_budget,
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert([newTransaction])
      .select()
      .single();

    if (error) throw error;

    console.log(`✓ Generated recurring transaction: ${transaction.title} for ${format(nextDate, 'yyyy-MM-dd')}`);
    return data as Transaction;
  } catch (error) {
    console.error('Failed to generate recurring transaction:', error);
    return null;
  }
}

/**
 * Process all recurring transactions for a user
 * Generates missing instances up to the current date
 */
export async function processRecurringTransactions(userId: string): Promise<{
  processed: number;
  generated: number;
  errors: number;
}> {
  const supabase = createClient();
  const today = startOfDay(new Date());

  let processed = 0;
  let generated = 0;
  let errors = 0;

  try {
    // Get all recurring transactions
    const { data: recurringTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .order('date', { ascending: true });

    if (fetchError) throw fetchError;

    if (!recurringTransactions || recurringTransactions.length === 0) {
      console.log('No recurring transactions found');
      return { processed: 0, generated: 0, errors: 0 };
    }

    console.log(`Found ${recurringTransactions.length} recurring transaction(s)`);

    // Group transactions by their base (same title, amount, category)
    const groupedTransactions = new Map<string, Transaction[]>();

    for (const txn of recurringTransactions) {
      const key = `${txn.title}-${txn.amount}-${txn.category_id}-${txn.account_id}`;
      if (!groupedTransactions.has(key)) {
        groupedTransactions.set(key, []);
      }
      groupedTransactions.get(key)!.push(txn as Transaction);
    }

    // Process each group
    for (const [key, instances] of groupedTransactions.entries()) {
      processed++;

      // Sort by date to get the latest instance
      instances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestInstance = instances[0];
      const baseTransaction = instances.find(t => t.recurrence_frequency) || latestInstance;

      // Ensure recurring transaction has required fields
      const recurringTxn = {
        ...baseTransaction,
        is_recurring: true as const,
        recurrence_frequency: baseTransaction.recurrence_frequency || 'monthly',
        recurrence_interval: baseTransaction.recurrence_interval || 1,
        recurrence_end_date: baseTransaction.recurrence_end_date,
        recurrence_day_of_month: baseTransaction.recurrence_day_of_month,
      } as RecurringTransaction;

      let latestDate = new Date(latestInstance.date);
      let iterationCount = 0;
      const MAX_ITERATIONS = 100; // Prevent infinite loops

      // Generate all missing instances up to today
      while (
        shouldGenerateNextInstance(recurringTxn, latestDate, today) &&
        iterationCount < MAX_ITERATIONS
      ) {
        const nextDate = calculateNextOccurrence(
          latestDate,
          recurringTxn.recurrence_frequency,
          recurringTxn.recurrence_interval,
          recurringTxn.recurrence_day_of_month
        );

        // Check if this instance already exists
        const existsCheck = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('title', baseTransaction.title)
          .eq('amount', baseTransaction.amount)
          .eq('category_id', baseTransaction.category_id)
          .eq('date', format(nextDate, 'yyyy-MM-dd'))
          .maybeSingle();

        if (!existsCheck.data) {
          // Generate the instance
          const newInstance = await generateNextRecurringInstance(
            recurringTxn,
            nextDate,
            userId
          );

          if (newInstance) {
            generated++;
          } else {
            errors++;
          }
        } else {
          console.log(`Instance already exists for ${format(nextDate, 'yyyy-MM-dd')}, skipping`);
        }

        latestDate = nextDate;
        iterationCount++;
      }

      if (iterationCount >= MAX_ITERATIONS) {
        console.warn(`Stopped processing ${key} after ${MAX_ITERATIONS} iterations to prevent infinite loop`);
      }
    }

    console.log(`✓ Processed ${processed} recurring transaction(s), generated ${generated} new instance(s)`);
    return { processed, generated, errors };
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
    return { processed, generated, errors: errors + 1 };
  }
}

/**
 * Process recurring transactions for upcoming month
 * Useful for generating future instances in advance
 */
export async function generateUpcomingRecurringTransactions(
  userId: string,
  daysAhead: number = 30
): Promise<number> {
  const supabase = createClient();
  const targetDate = addDays(new Date(), daysAhead);

  let generated = 0;

  try {
    const { data: recurringTransactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_recurring', true);

    if (error) throw error;

    for (const txn of recurringTransactions || []) {
      const recurringTxn = {
        ...txn,
        is_recurring: true as const,
        recurrence_frequency: txn.recurrence_frequency || 'monthly',
        recurrence_interval: txn.recurrence_interval || 1,
        recurrence_end_date: txn.recurrence_end_date,
        recurrence_day_of_month: txn.recurrence_day_of_month,
      } as RecurringTransaction;

      let lastDate = new Date(txn.date);

      while (isBefore(lastDate, targetDate)) {
        const nextDate = calculateNextOccurrence(
          lastDate,
          recurringTxn.recurrence_frequency,
          recurringTxn.recurrence_interval,
          recurringTxn.recurrence_day_of_month
        );

        if (isAfter(nextDate, targetDate)) break;

        // Check if instance exists
        const exists = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('title', txn.title)
          .eq('date', format(nextDate, 'yyyy-MM-dd'))
          .maybeSingle();

        if (!exists.data) {
          await generateNextRecurringInstance(recurringTxn, nextDate, userId);
          generated++;
        }

        lastDate = nextDate;
      }
    }

    return generated;
  } catch (error) {
    console.error('Error generating upcoming recurring transactions:', error);
    return 0;
  }
}
