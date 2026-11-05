'use client';

import { Edit, Trash2, ArrowUpRight, ArrowDownRight, Repeat, Clock, CheckCircle2, Lock, Split } from 'lucide-react';
import { formatZAR } from '@/lib/currency';
import { format, isFuture, parseISO } from 'date-fns';
import type { Transaction, Category, Account } from '@/lib/db/schema';

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  subcategoryName?: string;
  /** Category names for the parts of a split transaction. */
  splitNames?: string[];
  /** Running balance after this transaction, shown on an account's page. */
  balance?: number;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export function TransactionRow({
  transaction,
  category,
  account,
  toAccount,
  onEdit,
  onDelete,
  subcategoryName,
  splitNames,
  balance,
  selected,
  onSelect,
}: TransactionRowProps) {
  const isSplit = Boolean(transaction.splits?.length);
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const isFutureTransaction = isFuture(parseISO(transaction.date));

  return (
    <div
      className="flex items-center justify-between gap-2 py-3 px-2 sm:px-4 hover:bg-accent/50 rounded-lg transition-colors border-b last:border-0 cursor-pointer sm:cursor-default"
      onClick={(e) => {
        // On phones the whole row opens the transaction; buttons and the checkbox keep their own job.
        if (window.matchMedia('(max-width: 639px)').matches && !(e.target as HTMLElement).closest('button, input, a')) onEdit(transaction);
      }}
    >
      {/* Left: Icon + Details */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onSelect && (
          <input
            type="checkbox"
            className="h-4 w-4 flex-shrink-0"
            checked={!!selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select ${transaction.title}`}
          />
        )}
        <div
          className={`hidden sm:flex w-10 h-10 flex-shrink-0 rounded-full items-center justify-center ${
            isIncome
              ? 'bg-green-100 dark:bg-green-950'
              : isTransfer
              ? 'bg-blue-100 dark:bg-blue-950'
              : 'bg-red-100 dark:bg-red-950'
          }`}
        >
          {isIncome ? (
            <ArrowDownRight className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : isTransfer ? (
            <ArrowUpRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">
              {isTransfer
                ? `Transfer to ${toAccount?.name || 'Unknown Account'}`
                : isSplit
                ? `Split: ${(splitNames ?? []).join(', ')}`
                : `${category?.icon || ''} ${category?.name || 'Uncategorized'}`
              }
            </p>
            {isSplit && <Split className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Split" />}
            {!isSplit && subcategoryName && (
              <span className="text-xs text-muted-foreground">
                • {subcategoryName}
              </span>
            )}
            {transaction.reconciled ? (
              <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Reconciled" />
            ) : transaction.cleared ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" aria-label="Cleared" />
            ) : null}
            {transaction.is_recurring && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                <Repeat className="h-3 w-3" />
                Recurring
              </span>
            )}
            {isFutureTransaction && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                <Clock className="h-3 w-3" />
                Scheduled
              </span>
            )}
          </div>
          {/* On phones the title replaces the category line's details, which matter less. */}
          {transaction.title && <p className="truncate text-sm sm:hidden">{transaction.title}</p>}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground min-w-0">
            <span className={`flex-shrink-0 whitespace-nowrap ${isFutureTransaction ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              <span className="sm:hidden">{format(new Date(transaction.date), 'd MMM')}</span>
              <span className="hidden sm:inline">{format(new Date(transaction.date), 'd MMM yyyy')}</span>
            </span>
            <span className="flex-shrink-0">•</span>
            <span className="truncate">{account?.name || 'Unknown Account'}</span>
            {transaction.title && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline truncate max-w-[200px]">{transaction.title}</span>
              </>
            )}
            {isFutureTransaction && (
              <>
                <span>•</span>
                <span className="hidden sm:inline text-amber-600 dark:text-amber-400 text-xs">Not affecting balance yet</span>
              </>
            )}
          </div>
          {transaction.tags && transaction.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {transaction.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Amount + Actions */}
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="text-right">
          <p className={`font-semibold ${
            isIncome
              ? 'text-green-600 dark:text-green-400'
              : isTransfer
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isIncome ? '+' : isTransfer ? '' : '-'}{formatZAR(transaction.amount)}
          </p>
          {balance !== undefined && <p className="text-xs text-muted-foreground">{formatZAR(balance)}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-0.5 sm:gap-1">
          <button
            onClick={() => onEdit(transaction)}
            className="hidden sm:block p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Edit transaction"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(transaction)}
            className="p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 rounded-md transition-colors"
            aria-label="Delete transaction"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
