/** One transaction read from a statement file, before rules or duplicate checks. */
export interface ImportRow {
  date: string; // yyyy-MM-dd
  /** Cents. Positive is money in, negative is money out. */
  amount: number;
  /** The bank's description, kept as imported_payee. */
  payee: string;
  /** A cleaner name than the bank's, when the parser knows one (the FNB PDF parser does). */
  title?: string;
  notes?: string;
  /** The bank's own ID for the transaction (OFX FITID), when there is one. */
  bankId?: string;
  /** A category name suggested by the parser, used when no rule sets one. */
  categoryHint?: string;
}

export interface StatementFile {
  format: 'csv' | 'ofx' | 'qif' | 'pdf';
  rows: ImportRow[];
  /** Cents, as at statementDate. */
  closingBalance?: number;
  statementDate?: string;
  accountNumber?: string;
  errors: string[];
  unparsedLines?: { line: string; reason: string }[];
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD';
