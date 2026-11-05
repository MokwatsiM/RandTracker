import type { ParsedTransaction, StatementParseResult } from '@/lib/statement-parser';
import { guessMapping, parseCsv, readCsv, type CsvMapping } from './csv';
import { parseOfx } from './ofx';
import { parseQif } from './qif';
import type { StatementFile } from './types';

export type { CsvMapping } from './csv';
export type { ImportRow, StatementFile } from './types';
export { assignImportIds, findPossibleDuplicates } from './dedupe';

export type FileKind = 'pdf' | 'csv' | 'ofx' | 'qif';

export function detectKind(fileName: string, head = ''): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ofx' || ext === 'qfx' || /<OFX>|OFXHEADER/i.test(head)) return 'ofx';
  if (ext === 'qif' || /^!Type:/im.test(head)) return 'qif';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  return null;
}

export interface CsvRead {
  table: string[][];
  mapping: CsvMapping | null;
}

/** Reads a CSV file, using the saved mapping when it still fits the file's columns. */
export function readCsvFile(text: string, saved?: CsvMapping | null): CsvRead {
  const table = readCsv(text);
  const fits =
    saved &&
    table[saved.headerRow] &&
    Math.max(saved.dateColumn, saved.payeeColumn, saved.amountColumn ?? 0, saved.debitColumn ?? 0, saved.creditColumn ?? 0) <
      table[saved.headerRow].length;
  return { table, mapping: fits ? saved : guessMapping(table) };
}

export function parseTextStatement(kind: Exclude<FileKind, 'pdf' | 'csv'>, text: string): StatementFile {
  return kind === 'ofx' ? parseOfx(text) : parseQif(text);
}

export { parseCsv };

/** Turns the FNB PDF parser's result into import rows. */
export function fromPdfResult(result: StatementParseResult): StatementFile {
  return {
    format: 'pdf',
    rows: result.transactions.map((t: ParsedTransaction) => ({
      date: t.date,
      amount: t.type === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount),
      payee: t.description,
      title: t.merchant || undefined,
      notes: t.location ? `Location: ${t.location}` : undefined,
      categoryHint: t.category,
    })),
    closingBalance: result.closingBalance,
    statementDate: result.statementDate,
    accountNumber: result.accountNumber,
    errors: result.errors,
    unparsedLines: result.unparsedLines,
  };
}
