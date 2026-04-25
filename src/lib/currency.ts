// ZAR currency formatting utilities using dinero.js v2

import { dinero, toDecimal, add, subtract, multiply, toSnapshot } from 'dinero.js';
import { ZAR } from 'dinero.js/currencies';

/**
 * Creates a Dinero object from cents
 * @param cents - Amount in cents (e.g., 12450 for R124.50)
 */
export function fromCents(cents: number) {
  return dinero({ amount: cents, currency: ZAR });
}

/**
 * Formats a Dinero object or cents amount as ZAR string
 * @param value - Dinero object or amount in cents
 * @returns Formatted string like "R 1,234.56"
 */
export function formatZAR(value: any): string {
  const money = typeof value === 'number' ? fromCents(value) : value;
  const decimal = toDecimal(money);

  // Parse the decimal string and format with South African conventions
  const [whole, fraction = '00'] = decimal.split('.');
  const formattedWhole = parseInt(whole).toLocaleString('en-ZA');

  return `R ${formattedWhole}.${fraction.padEnd(2, '0')}`;
}

/**
 * Formats amount without currency symbol
 * @param cents - Amount in cents
 */
export function formatAmount(cents: number): string {
  const money = fromCents(cents);
  const decimal = toDecimal(money);
  const [whole, fraction = '00'] = decimal.split('.');
  const formattedWhole = parseInt(whole).toLocaleString('en-ZA');

  return `${formattedWhole}.${fraction.padEnd(2, '0')}`;
}

/**
 * Parses a ZAR string to cents
 * @param value - String like "R 1,234.56" or "1234.56"
 * @returns Amount in cents
 */
export function parseZAR(value: string): number {
  // Remove R, spaces, and commas
  const cleaned = value.replace(/[R\s,]/g, '');
  const float = parseFloat(cleaned);

  if (isNaN(float)) return 0;

  // Convert to cents
  return Math.round(float * 100);
}

/**
 * Adds two amounts in cents
 */
export function addMoney(a: number, b: number): number {
  const result = add(fromCents(a), fromCents(b));
  return toSnapshot(result).amount;
}

/**
 * Subtracts two amounts in cents
 */
export function subtractMoney(a: number, b: number): number {
  const result = subtract(fromCents(a), fromCents(b));
  return toSnapshot(result).amount;
}

/**
 * Multiplies amount by a factor
 */
export function multiplyMoney(cents: number, factor: number): number {
  const result = multiply(fromCents(cents), { amount: Math.round(factor * 100), scale: 2 });
  return toSnapshot(result).amount;
}

/**
 * Formats amount for display with color coding
 * @param cents - Amount in cents
 * @param type - Transaction type
 * @returns Object with formatted string and color class
 */
export function formatTransactionAmount(cents: number, type: 'income' | 'expense' | 'transfer'): {
  text: string;
  className: string;
} {
  const formatted = formatZAR(cents);

  switch (type) {
    case 'income':
      return { text: `+ ${formatted}`, className: 'text-green-600 dark:text-green-400' };
    case 'expense':
      return { text: `- ${formatted}`, className: 'text-red-600 dark:text-red-400' };
    case 'transfer':
      return { text: formatted, className: 'text-blue-600 dark:text-blue-400' };
    default:
      return { text: formatted, className: '' };
  }
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
