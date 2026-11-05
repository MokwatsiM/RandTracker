import type { DateOrder, ImportRow, StatementFile } from './types';
import { guessDateOrder, parseAmount, parseDate } from './values';

/** How to read a CSV export. Saved per account so the next import needs no setup. */
export interface CsvMapping {
  headerRow: number; // index of the header line; data starts on the next line
  dateColumn: number;
  payeeColumn: number;
  notesColumn?: number;
  /** One signed amount column... */
  amountColumn?: number;
  /** ...or separate money out and money in columns. */
  debitColumn?: number;
  creditColumn?: number;
  balanceColumn?: number;
  dateOrder: DateOrder;
  /** Some banks show money out as positive in a single column. */
  invertAmounts?: boolean;
}

/** Splits CSV text into rows, handling quotes, escaped quotes and commas, semicolons or tabs. */
export function readCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLines = clean.split(/\r?\n/).slice(0, 20).join('\n');
  const delimiter = [',', ';', '\t']
    .map((d) => ({ d, count: firstLines.split(d).length }))
    .sort((a, b) => b.count - a.count)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

const HEADER_WORDS = {
  date: /^(transaction |posting |value )?date$|^datum$|^date posted$/i,
  payee: /description|details|narrative|payee|merchant|beskrywing/i,
  payeeFallback: /reference|transaction$/i,
  notes: /^(reference|notes?|memo|remarks?)$/i,
  amount: /^(amount|bedrag|value|amount \(zar\)|transaction amount)$/i,
  debit: /debit|money out|withdrawal|uitbetaling/i,
  credit: /credit|money in|deposit|inbetaling/i,
  balance: /balance|saldo/i,
};

function findColumn(header: string[], pattern: RegExp, skip: number[] = []): number | undefined {
  const index = header.findIndex((h, i) => !skip.includes(i) && pattern.test(h.trim()));
  return index >= 0 ? index : undefined;
}

/**
 * Guesses the mapping from the header row, which may sit below a few lines of account
 * details (FNB exports start that way). Returns null when no header can be found, so the
 * user can map the columns by hand.
 */
export function guessMapping(rows: string[][]): CsvMapping | null {
  for (let headerRow = 0; headerRow < Math.min(rows.length, 30); headerRow++) {
    const header = rows[headerRow];
    const dateColumn = findColumn(header, HEADER_WORDS.date) ?? findColumn(header, /date/i);
    if (dateColumn === undefined) continue;

    const amountColumn = findColumn(header, HEADER_WORDS.amount);
    const debitColumn = amountColumn === undefined ? findColumn(header, HEADER_WORDS.debit) : undefined;
    const creditColumn = amountColumn === undefined ? findColumn(header, HEADER_WORDS.credit, debitColumn === undefined ? [] : [debitColumn]) : undefined;
    if (amountColumn === undefined && (debitColumn === undefined || creditColumn === undefined)) continue;

    const used = [dateColumn, amountColumn, debitColumn, creditColumn].filter((c): c is number => c !== undefined);
    const payeeColumn = findColumn(header, HEADER_WORDS.payee, used) ?? findColumn(header, HEADER_WORDS.payeeFallback, used);
    if (payeeColumn === undefined) continue;
    const notesColumn = findColumn(header, HEADER_WORDS.notes, [...used, payeeColumn]);
    const balanceColumn = findColumn(header, HEADER_WORDS.balance, [...used, payeeColumn]);

    const samples = rows.slice(headerRow + 1, headerRow + 40).map((r) => r[dateColumn] ?? '');
    return {
      headerRow,
      dateColumn,
      payeeColumn,
      notesColumn,
      amountColumn,
      debitColumn,
      creditColumn,
      balanceColumn,
      dateOrder: guessDateOrder(samples),
    };
  }
  return null;
}

export function parseCsv(rows: string[][], mapping: CsvMapping): StatementFile {
  const result: StatementFile = { format: 'csv', rows: [], errors: [], unparsedLines: [] };
  let latest: { date: string; balance: number } | undefined;

  for (const cells of rows.slice(mapping.headerRow + 1)) {
    const line = cells.join(', ');
    const date = parseDate(cells[mapping.dateColumn] ?? '', mapping.dateOrder);
    if (!date) {
      result.unparsedLines!.push({ line, reason: 'No date this app can read' });
      continue;
    }

    let amount: number | null;
    if (mapping.amountColumn !== undefined) {
      amount = parseAmount(cells[mapping.amountColumn]);
      if (amount !== null && mapping.invertAmounts) amount = -amount;
    } else {
      const out = parseAmount(cells[mapping.debitColumn ?? -1]);
      const into = parseAmount(cells[mapping.creditColumn ?? -1]);
      amount = out === null && into === null ? null : Math.abs(into ?? 0) - Math.abs(out ?? 0);
    }
    if (amount === null || amount === 0) {
      result.unparsedLines!.push({ line, reason: amount === 0 ? 'Amount is zero' : 'No amount this app can read' });
      continue;
    }

    const payee = (cells[mapping.payeeColumn] ?? '').trim();
    const row: ImportRow = { date, amount, payee: payee || '(no description)' };
    const notes = mapping.notesColumn !== undefined ? cells[mapping.notesColumn]?.trim() : '';
    if (notes && notes !== payee) row.notes = notes;
    result.rows.push(row);

    const balance = mapping.balanceColumn !== undefined ? parseAmount(cells[mapping.balanceColumn]) : null;
    // The balance on the latest date; on a tie the row that comes last in the file.
    if (balance !== null && (!latest || date >= latest.date)) latest = { date, balance };
  }

  if (latest) {
    result.closingBalance = latest.balance;
    result.statementDate = latest.date;
  }
  if (result.rows.length === 0) result.errors.push('No transactions were found with this column mapping.');
  return result;
}
