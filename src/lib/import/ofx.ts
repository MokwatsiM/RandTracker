import type { ImportRow, StatementFile } from './types';
import { parseAmount, parseDate } from './values';

// OFX 1.x is SGML, where closing tags are optional; OFX 2 is XML. Reading each tag's value
// up to the next "<" or line end handles both.
function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, 'i'));
  const value = m?.[1].trim();
  return value ? decodeEntities(value) : undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Reads OFX and QFX files, keeping each transaction's FITID as its import ID. */
export function parseOfx(text: string): StatementFile {
  const result: StatementFile = { format: 'ofx', rows: [], errors: [], unparsedLines: [] };
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);

  for (const block of blocks) {
    const date = parseDate(tag(block, 'DTPOSTED') ?? '');
    const amount = parseAmount(tag(block, 'TRNAMT'));
    const name = tag(block, 'NAME');
    const memo = tag(block, 'MEMO');
    const line = block.replace(/\s+/g, ' ').trim().slice(0, 160);

    if (!date || amount === null) {
      result.unparsedLines!.push({ line, reason: !date ? 'No posting date' : 'No amount' });
      continue;
    }
    if (amount === 0) continue;

    const payee = name || memo || tag(block, 'TRNTYPE') || '(no description)';
    const row: ImportRow = { date, amount, payee };
    if (memo && memo !== payee) row.notes = memo;
    const fitId = tag(block, 'FITID');
    if (fitId) row.bankId = fitId;
    result.rows.push(row);
  }

  const ledger = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[1];
  if (ledger) {
    const balance = parseAmount(tag(ledger, 'BALAMT'));
    if (balance !== null) result.closingBalance = balance;
    result.statementDate = parseDate(tag(ledger, 'DTASOF') ?? '') ?? undefined;
  }
  result.accountNumber = tag(text, 'ACCTID');

  if (blocks.length === 0) result.errors.push('This file has no transactions in OFX format.');
  return result;
}
