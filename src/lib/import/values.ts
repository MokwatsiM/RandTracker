import type { DateOrder } from './types';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  // Afrikaans, used by some South African bank exports.
  mei: 5, okt: 10, des: 12,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string | null {
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads the dates South African banks export: 2026-11-05, 2026/11/05, 20261105,
 * 05/11/2026, 5 Nov 2026, 05-Nov-26 and QIF's 11/05'26. Numeric day and month are read in
 * the given order, which defaults to day first.
 */
export function parseDate(raw: string, order: DateOrder = 'DMY'): string | null {
  const text = raw.trim().replace(/'/g, '/');
  if (!text) return null;

  let m = text.match(/^(\d{4})(\d{2})(\d{2})/); // 20261105, OFX
  if (m) return toIso(+m[1], +m[2], +m[3]);

  m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  m = text.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{2,4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    return month ? toIso(+m[3], month, +m[1]) : null;
  }

  m = text.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})/); // Nov 5, 2026
  if (m) {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
    return month ? toIso(+m[3], month, +m[2]) : null;
  }

  m = text.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})/);
  if (m) {
    const [a, b, year] = [+m[1], +m[2], +m[3]];
    return order === 'MDY' ? toIso(year, a, b) : toIso(year, b, a);
  }

  return null;
}

/**
 * Picks day-first or month-first for numeric dates like 05/11/2026 by looking for a part
 * above 12. Falls back to day first, the South African convention.
 */
export function guessDateOrder(samples: string[]): DateOrder {
  for (const sample of samples) {
    const m = sample.trim().match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s']\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) return 'DMY';
    if (+m[2] > 12) return 'MDY';
  }
  return 'DMY';
}

/**
 * Reads an amount to cents: "R 1 234,56", "-1,234.56", "(123.45)", "123.45 Cr", "50.00Dr".
 * Returns null for text that isn't a number, including an empty cell.
 */
export function parseAmount(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw * 100) : null;

  let text = raw.trim();
  if (!text) return null;

  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (/\s*(dr|db)\.?$/i.test(text)) {
    sign = -sign;
    text = text.replace(/\s*(dr|db)\.?$/i, '');
  } else if (/\s*cr\.?$/i.test(text)) {
    text = text.replace(/\s*cr\.?$/i, '');
  }
  if (text.includes('-')) {
    sign = -sign;
    text = text.replace('-', '');
  }
  text = text.replace(/^\+/, '').replace(/[R$€£\s ]|ZAR/gi, '');
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  // The last separator followed by one or two digits is the decimal point.
  const decimal = text.match(/[.,](\d{1,2})$/);
  let whole = text;
  let fraction = '0';
  if (decimal) {
    whole = text.slice(0, -decimal[0].length);
    fraction = decimal[1];
  }
  whole = whole.replace(/[.,]/g, '');
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isFinite(cents) ? sign * cents : null;
}
