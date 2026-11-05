'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';
import { processRecurringTransactions } from '@/lib/recurring-transactions';
import { useUserStore } from '@/stores/userStore';

interface ProcessingResult {
  processed: number;
  generated: number;
  errors: number;
}

interface RecurringTransactionProcessorProps {
  autoProcess?: boolean;
}

export function RecurringTransactionProcessor({ autoProcess = true }: RecurringTransactionProcessorProps) {
  const user = useUserStore(state => state.user);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const hasAutoProcessed = useRef(false);

  // Auto-process on mount if enabled
  useEffect(() => {
    if (autoProcess && user && !hasAutoProcessed.current && !isProcessing) {
      hasAutoProcessed.current = true;
      handleProcess();
    }
  }, [autoProcess, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProcess = async (manualTrigger = false) => {
    if (!user?.id) {
      setError('You must be logged in to process recurring transactions');
      setShowCard(true);
      return;
    }

    // Show card when manually triggered
    if (manualTrigger) {
      setShowCard(true);
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const processingResult = await processRecurringTransactions(user.id);
      setResult(processingResult);

      // Only show card if transactions were generated or if manually triggered
      if (processingResult.generated > 0 || processingResult.errors > 0 || manualTrigger) {
        setShowCard(true);
      }

      // Trigger a page refresh to show new transactions
      window.dispatchEvent(new CustomEvent('recurring-transactions-processed'));
    } catch (err) {
      console.error('Failed to process recurring transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to process recurring transactions');
      setShowCard(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Recurring Transactions
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            {result && result.generated === 0 && !error
              ? 'All recurring transactions are up to date!'
              : 'Process your recurring transactions to generate any missing instances up to today.'}
          </p>

          {result && (
            <div className="mb-3 p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Processing Complete
                </span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Recurring series processed:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{result.processed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">New instances generated:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{result.generated}</span>
                </div>
                {result.errors > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Errors:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{result.errors}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          <Button
            onClick={() => handleProcess(true)}
            disabled={isProcessing}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Process Recurring Transactions
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
