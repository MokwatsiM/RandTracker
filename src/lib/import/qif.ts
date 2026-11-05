import type { ImportRow, StatementFile } from './types';
import { guessDateOrder, parseAmount, parseDate } from './values';

/** Reads QIF bank and card exports. Investment and category sections are skipped. */
export function parseQif(text: string): StatementFile {
  const result: StatementFile = { format: 'qif', rows: [], errors: [], unparsedLines: [] };
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);

  type Record = { D?: string; T?: string; U?: string; P?: string; M?: string; N?: string };
  const records: Record[] = [];
  let current: Record = {};
  let section = 'bank';

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith('!')) {
      const type = line.toLowerCase();
      section = /!type:(bank|cash|ccard|oth a|oth l)/.test(type) ? 'bank' : type.startsWith('!type') ? 'other' : section;
      continue;
    }
    if (line === '^') {
      if (section === 'bank' && Object.keys(current).length) records.push(current);
      current = {};
      continue;
    }
    const code = line[0] as keyof Record;
    if ('DTUPMN'.includes(code)) current[code] = line.slice(1).trim();
  }
  if (section === 'bank' && Object.keys(current).length) records.push(current);

  const order = guessDateOrder(records.map((r) => r.D ?? ''));
  for (const record of records) {
    const date = parseDate(record.D ?? '', order);
    const amount = parseAmount(record.T ?? record.U);
    const summary = `D${record.D ?? ''} T${record.T ?? record.U ?? ''} P${record.P ?? ''}`;
    if (!date || amount === null) {
      result.unparsedLines!.push({ line: summary, reason: !date ? 'No date this app can read' : 'No amount' });
      continue;
    }
    if (amount === 0) continue;
    const row: ImportRow = { date, amount, payee: record.P || record.M || '(no description)' };
    if (record.M && record.M !== row.payee) row.notes = record.M;
    result.rows.push(row);
  }

  if (records.length === 0) result.errors.push('This file has no transactions in QIF format.');
  return result;
}
