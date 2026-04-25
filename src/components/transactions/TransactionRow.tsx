'use client';

import { Edit, Trash2, ArrowUpRight, ArrowDownRight, Repeat, Clock } from 'lucide-react';
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
}

export function TransactionRow({
  transaction,
  category,
  account,
  toAccount,
  onEdit,
  onDelete
}: TransactionRowProps) {
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const isFutureTransaction = isFuture(parseISO(transaction.date));

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-accent/50 rounded-lg transition-colors border-b last:border-0">
      {/* Left: Icon + Details */}
      <div className="flex items-center gap-3 flex-1">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                : `${category?.icon || ''} ${category?.name || 'Uncategorized'}`
              }
            </p>
            {transaction.subcategory_id && (
              <span className="text-xs text-muted-foreground">
                • {transaction.subcategory_id}
              </span>
            )}
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={isFutureTransaction ? 'text-amber-600 dark:text-amber-400' : ''}>
              {format(new Date(transaction.date), 'MMM dd, yyyy')}
            </span>
            <span>•</span>
            <span>{account?.name || 'Unknown Account'}</span>
            {transaction.title && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">{transaction.title}</span>
              </>
            )}
            {isFutureTransaction && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 text-xs">Not affecting balance yet</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Amount + Actions */}
      <div className="flex items-center gap-4">
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
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(transaction)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Edit transaction"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(transaction)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 rounded-md transition-colors"
            aria-label="Delete transaction"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
