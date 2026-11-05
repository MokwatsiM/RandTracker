'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { useUserStore } from '@/stores/userStore';
import type { ParsedTransaction } from '@/lib/statement-parser';
import { matchCategory } from '@/lib/statement-parser';
import { formatZAR } from '@/lib/currency';

interface StatementUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UnparsedLine {
  line: string;
  dateStr?: string;
  reason: string;
}

interface ParseResult {
  accountNumber?: string;
  statementDate?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: ParsedTransaction[];
  errors: string[];
  unparsedLines: UnparsedLine[];
  transactionCount: number;
}

export function StatementUploadDialog({ open, onOpenChange }: StatementUploadDialogProps) {
  const user = useUserStore(state => state.user);
  const accounts = useAccountStore(state => state.accounts);
  const categories = useCategoryStore(state => state.categories);
  const createTransactions = useTransactionStore(state => state.createTransactions);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParseResult(null);
      setSelectedTransactions(new Set());
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedAccountId) {
      alert('Please select an account and upload a PDF file');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', selectedAccountId);

      const response = await fetch('/api/statements/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload statement');
      }

      setParseResult(result);

      // Select all transactions by default
      const allIndices = new Set<number>(result.transactions.map((_: any, i: number) => i));
      setSelectedTransactions(allIndices);

    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload statement');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult || !user || !selectedAccountId) return;

    setImporting(true);

    try {
      let skipped = 0;
      const rows: Parameters<typeof createTransactions>[0] = [];

      for (const index of selectedTransactions) {
        const txn = parseResult.transactions[index];

        // Match category
        const categoryId = txn.category
          ? matchCategory(txn.category, categories)
          : undefined;

        // Use default category if no match found
        const finalCategoryId = categoryId || categories.find(c => c.type === txn.type)?.id;

        if (!finalCategoryId) {
          console.warn(`No category found for transaction: ${txn.description}`);
          skipped++;
          continue;
        }

        rows.push({
          user_id: user.id,
          account_id: selectedAccountId,
          type: txn.type,
          amount: Math.abs(txn.amount),
          category_id: finalCategoryId,
          title: txn.merchant || txn.description,
          notes: txn.location ? `Location: ${txn.location}\n\nImported from statement` : 'Imported from statement',
          date: txn.date,
          is_paid: true,
          is_recurring: false,
          is_subscription: false,
          is_debt_payment: false,
          exclude_from_budget: false,
        });
      }

      // Saved together: if anything fails, nothing is imported, so the import can simply be retried.
      const imported = await createTransactions(rows);

      alert(`Import complete!\n\nImported: ${imported.length}\nSkipped: ${skipped}`);

      // Reset state
      setFile(null);
      setParseResult(null);
      setSelectedTransactions(new Set());
      onOpenChange(false);

    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import transactions. Nothing was saved, so you can try again.');
    } finally {
      setImporting(false);
    }
  };

  const toggleTransaction = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAll = () => {
    if (selectedTransactions.size === parseResult?.transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      const allIndices = new Set(parseResult?.transactions.map((_, i) => i));
      setSelectedTransactions(allIndices);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a PDF statement to automatically import transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Account */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Account</label>
            <Select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={!!parseResult}
            >
              <option value="">Choose an account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name} ({account.type})
                </option>
              ))}
            </Select>
          </div>

          {/* Step 2: Upload File */}
          {!parseResult && (
            <div>
              <label className="text-sm font-medium mb-2 block">Upload Statement (PDF)</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="statement-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="statement-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">PDF files only</p>
                </label>
              </div>

              {file && (
                <div className="mt-4">
                  <Button onClick={handleUpload} disabled={uploading || !selectedAccountId}>
                    {uploading ? 'Processing...' : 'Parse Statement'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review Transactions */}
          {parseResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Statement Parsed Successfully
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {parseResult.accountNumber && (
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Account: </span>
                          <span className="font-medium">****{parseResult.accountNumber.slice(-4)}</span>
                        </div>
                      )}
                      {parseResult.statementDate && (
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Statement Date: </span>
                          <span className="font-medium">{parseResult.statementDate}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Transactions Found: </span>
                        <span className="font-medium">{parseResult.transactionCount}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 dark:text-blue-300">Selected: </span>
                        <span className="font-medium">{selectedTransactions.size}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                        Parsing Warnings
                      </h3>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                        {parseResult.unparsedLines && parseResult.unparsedLines.length > 0
                          ? `${parseResult.unparsedLines.length} transaction(s) couldn't be automatically parsed. You can skip them or manually parse the line below.`
                          : 'Some lines had minor parsing issues but transactions were extracted.'}
                      </p>
                      {parseResult.errors.length <= 5 && (
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                          {parseResult.errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      )}
                      {parseResult.errors.length > 5 && (
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          {parseResult.errors.length} warnings - see unparsed lines below to fix them manually.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Unparsed Lines - Manual Edit */}
              {parseResult.unparsedLines && parseResult.unparsedLines.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                        Unparsed Transactions ({parseResult.unparsedLines.length})
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                        These lines couldn't be automatically parsed. You can skip them or manually add these transactions after import.
                      </p>
                      <div className="space-y-2">
                        {parseResult.unparsedLines.map((unparsed, idx) => (
                          <div key={idx} className="bg-white dark:bg-gray-900 rounded p-3 border border-orange-200 dark:border-orange-800">
                            <div className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                              Line: {unparsed.line}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400">
                              Reason: {unparsed.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-orange-600 dark:text-orange-400">
                        💡 Tip: After importing the successful transactions, you can manually add these using the "Add Transaction" button.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Transactions to Import</h3>
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selectedTransactions.size === parseResult.transactions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-lg max-h-96 overflow-y-auto">
                  {parseResult.transactions.map((txn, index) => (
                    <div
                      key={index}
                      className={`border-b border-gray-200 dark:border-gray-800 last:border-b-0 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 ${
                        selectedTransactions.has(index) ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => toggleTransaction(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {selectedTransactions.has(index) ? (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <div className="h-5 w-5 border-2 border-gray-300 dark:border-gray-700 rounded" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {txn.merchant || txn.description}
                              </p>
                              {txn.location && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {txn.location}
                                </p>
                              )}
                              {txn.category && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  {txn.category}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-medium ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {txn.type === 'income' ? '+' : '-'}{formatZAR(Math.abs(txn.amount))}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {txn.date}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setParseResult(null);
                    setSelectedTransactions(new Set());
                  }}
                  disabled={importing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || selectedTransactions.size === 0}
                >
                  {importing ? 'Importing...' : `Import ${selectedTransactions.size} Transaction${selectedTransactions.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
