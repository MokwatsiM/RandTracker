/**
 * Statement Parser
 * Parses bank/credit card statements and extracts transactions
 */

import { format } from 'date-fns';

export interface ParsedTransaction {
  date: string; // ISO format
  description: string;
  merchant?: string;
  location?: string;
  amount: number; // In cents, positive for expenses, negative for credits
  type: 'expense' | 'income';
  category?: string;
  rawText: string;
}

export interface UnparsedLine {
  line: string;
  dateStr?: string;
  reason: string;
}

export interface StatementParseResult {
  accountNumber?: string;
  statementDate?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: ParsedTransaction[];
  errors: string[];
  unparsedLines: UnparsedLine[];
}

/**
 * Parse FNB credit card statement
 */
export function parseFNBCreditCardStatement(text: string): StatementParseResult {
  const result: StatementParseResult = {
    transactions: [],
    errors: [],
    unparsedLines: [],
  };

  try {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Extract account number
    const accountMatch = text.match(/CREDIT CARD (\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/);
    if (accountMatch) {
      result.accountNumber = accountMatch[1].replace(/\s/g, '');
    }

    // Extract statement date
    const statementDateMatch = text.match(/Statement Date\s+(\d{1,2}\s+\w+\s+\d{4})/);
    if (statementDateMatch) {
      result.statementDate = statementDateMatch[1];
    }

    // Extract opening balance
    const openingMatch = text.match(/Opening Balance\s+([\d\s,]+\.?\d*)/);
    if (openingMatch) {
      result.openingBalance = parseAmount(openingMatch[1]);
    }

    // Extract closing balance
    const closingMatch = text.match(/Closing Balance\s+([\d\s,]+\.?\d*)Cr?/);
    if (closingMatch) {
      result.closingBalance = parseAmount(closingMatch[1]);
    }

    // Get year from statement date
    let currentYear = new Date().getFullYear();
    if (result.statementDate) {
      const yearMatch = result.statementDate.match(/\d{4}/);
      if (yearMatch) {
        currentYear = parseInt(yearMatch[0]);
      }
    }

    // Parse transactions - FNB format has date, description, then amount in columns
    // Pattern: DD MMM Description Location ZA Amount [Cr]
    // The amount is at the end of the line, separated by whitespace

    // First, let's find transaction lines by looking for date pattern at start
    const datePattern = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(datePattern);

      if (dateMatch) {
        try {
          const dateStr = dateMatch[1];
          let restOfLine = dateMatch[2].trim();

          // Skip certain lines that aren't transactions
          if (restOfLine.includes('Opening Balance') ||
              restOfLine.includes('Card Total') ||
              restOfLine.includes('Closing Balance') ||
              restOfLine.startsWith('#')) {
            continue;
          }

          // Extract amount from the end of the line
          // Handle cases where spaces might be missing: "MidrandZA13.00" or "Midrand ZA 13.00"
          // Pattern: description, then optional space, then country code (ZA/CY/etc), then amount with decimal

          // First, try to match with country code and amount (amount directly follows country code)
          let amountMatch = restOfLine.match(/(.*?)(ZA|CY|US|GB|eZA)([\d\s,]+\.\d{2})(Cr)?$/i);

          // If that doesn't work, try with space between country and amount
          if (!amountMatch) {
            amountMatch = restOfLine.match(/(.*?)(?:\s+)?(ZA|CY|US|GB|eZA)(?:\s+)([\d\s,]+\.\d{2})(Cr)?$/i);
          }

          // If still no match, try without country code
          if (!amountMatch) {
            amountMatch = restOfLine.match(/(.*?)([\d\s,]+\.\d{2})(Cr)?$/);
          }

          // Track multi-line transaction info
          let foreignAmountLine = '';
          let actualAmountLine = '';

          // If STILL no match, check if it's a multi-line transaction (foreign currency)
          // The amount might be on the next line(s)
          if (!amountMatch && i + 1 < lines.length) {
            // Look ahead at the next 1-3 lines for "Foreign Amount:" pattern
            for (let j = 1; j <= 3 && (i + j) < lines.length; j++) {
              const nextLine = lines[i + j];

              // Check if this line has "Foreign Amount:"
              if (nextLine.includes('Foreign Amount:')) {
                foreignAmountLine = nextLine;
                // The line after this should have the actual ZAR amount
                if (i + j + 1 < lines.length) {
                  actualAmountLine = lines[i + j + 1];
                }
                break;
              }

              // Or check if this line directly has location + amount
              // Handle various formats: "Location ZA 123.45" or "Addis Ababa 170.14"
              const multiLineMatch = nextLine.match(/([A-Za-z\s]+?)(?:\s+(ZA|CY|US|GB))?\s+([\d\s,]+\.\d{2})/i);
              if (multiLineMatch && multiLineMatch[3]) {
                actualAmountLine = nextLine;
                break;
              }
            }

            // If we found the amount on a subsequent line, use it
            if (actualAmountLine) {
              const multiMatch = actualAmountLine.match(/(.+?)\s+(ZA|CY|US|GB|eZA)?\s*([\d\s,]+\.\d{2})(Cr)?$/i);
              if (multiMatch) {
                // Combine the description from original line with location from amount line
                const locationPart = multiMatch[1] ? multiMatch[1].trim() : '';
                restOfLine = `${restOfLine} ${locationPart}`.trim();

                // Create a pseudo-match for the amount
                amountMatch = ['', restOfLine, multiMatch[2] || '', multiMatch[3], multiMatch[4] || ''];
              }
            }
          }

          if (amountMatch) {
            let description = amountMatch[1].trim();

            // Determine which groups contain what based on match
            let countryCode: string | null = null;
            let amountStr: string;
            let isCredit: boolean;

            // Check if group 2 looks like a country code (2-3 letters)
            if (amountMatch[2] && /^[A-Z]{2,3}$/i.test(amountMatch[2])) {
              // Has country code
              countryCode = amountMatch[2];
              amountStr = amountMatch[3].trim();
              isCredit = !!amountMatch[4];
            } else {
              // No country code
              amountStr = amountMatch[2].trim();
              isCredit = !!amountMatch[3];
            }

            // Parse date
            const date = parseDateString(dateStr, currentYear);

            // Parse amount
            const amount = parseAmount(amountStr);
            const isIncome = isCredit;

            // Clean up description and extract merchant/location
            let merchant = description;
            let location = '';

            // If country code was found but attached to location, try to split it
            // e.g., "Pnp Crp SouthdownsPretoriaZA" -> "Pnp Crp Southdowns" + "Pretoria"
            if (countryCode) {
              // Remove the country code if it's still in the description
              merchant = merchant.replace(new RegExp(`${countryCode}$`, 'i'), '').trim();
            }

            // Try to extract location from description
            // Pattern 1: "Merchant Location" where Location is capitalized words
            const locationMatch1 = merchant.match(/^(.+?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+(?:\s+[a-z]+)?)*)\s*$/);
            if (locationMatch1 && locationMatch1[2].length > 2) {
              const potentialLocation = locationMatch1[2].trim();
              // Only use as location if it looks like a place name (not a merchant name)
              if (!potentialLocation.toLowerCase().includes('mall') &&
                  !potentialLocation.toLowerCase().includes('store')) {
                merchant = locationMatch1[1].trim();
                location = potentialLocation;
              }
            }

            // Pattern 2: Handle cases where location is concatenated without space
            // e.g., "MerchantLocation" -> "Merchant" + "Location"
            // Look for capital letter in middle of word as split point
            if (!location) {
              const concatMatch = merchant.match(/^(.+?)([A-Z][a-z]+(?:[A-Z][a-z]+)*)$/);
              if (concatMatch && concatMatch[2].length > 3) {
                merchant = concatMatch[1].trim();
                location = concatMatch[2].trim();
              }
            }

            // Skip payment-related entries that are just reversals
            if (merchant.toLowerCase().includes('slow entry fee rv') ||
                merchant.toLowerCase().includes('slow lounge entry')) {
              continue;
            }

            // Try to categorize based on merchant
            const category = categorizeMerchant(merchant);

            // Add note about foreign currency if this was a multi-line transaction
            let notes = '';
            if (actualAmountLine && foreignAmountLine) {
              const foreignAmountMatch = foreignAmountLine.match(/Foreign Amount:\s*([\d.]+)/);
              if (foreignAmountMatch) {
                notes = `Foreign currency transaction. Original amount: ${foreignAmountMatch[1]}`;
              }
            }

            result.transactions.push({
              date,
              description: notes ? `${description} (Foreign Currency)` : description,
              merchant,
              location,
              amount: isIncome ? -amount : amount,
              type: isIncome ? 'income' : 'expense',
              category,
              rawText: line,
            });
          } else {
            // Could be a multi-line transaction or special format
            // Add to unparsed lines for manual editing
            result.unparsedLines.push({
              line: line,
              dateStr: dateStr,
              reason: 'Could not extract amount from transaction line',
            });
            result.errors.push(`Could not parse amount from line: ${line.substring(0, 80)}...`);
          }
        } catch (err) {
          result.errors.push(`Failed to parse transaction: ${line.substring(0, 80)}... Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }
    }

    // Sort transactions by date
    result.transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`✓ Parsed ${result.transactions.length} transactions from FNB statement`);

  } catch (error) {
    result.errors.push(`Failed to parse statement: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Parse amount string to cents
 */
function parseAmount(amountStr: string): number {
  // Remove spaces and commas
  const cleaned = amountStr.replace(/[\s,]/g, '');
  const float = parseFloat(cleaned);
  return Math.round(float * 100); // Convert to cents
}

/**
 * Parse date string like "28 Apr" with year
 */
function parseDateString(dateStr: string, year: number): string {
  const months: { [key: string]: number } = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  const parts = dateStr.trim().split(/\s+/);
  const day = parseInt(parts[0]);
  const monthStr = parts[1];
  const month = months[monthStr];

  if (month === undefined) {
    throw new Error(`Invalid month: ${monthStr}`);
  }

  const date = new Date(year, month, day);
  return format(date, 'yyyy-MM-dd');
}

/**
 * Categorize merchant based on name
 */
function categorizeMerchant(merchant: string): string | undefined {
  const lower = merchant.toLowerCase();

  // Groceries
  if (lower.includes('pnp') || lower.includes('pick n pay') || lower.includes('checkers') ||
      lower.includes('woolworths') || lower.includes('spar')) {
    return 'Groceries';
  }

  // Fuel
  if (lower.includes('engen') || lower.includes('shell') || lower.includes('bp') ||
      lower.includes('total') || lower.includes('sasol')) {
    return 'Fuel';
  }

  // Transport
  if (lower.includes('gautrain') || lower.includes('uber') || lower.includes('bolt')) {
    return 'Transport';
  }

  // Entertainment
  if (lower.includes('spotify') || lower.includes('netflix') || lower.includes('dstv') ||
      lower.includes('showmax')) {
    return 'Entertainment';
  }

  // Tech/Cloud
  if (lower.includes('amazon') || lower.includes('google') || lower.includes('microsoft') ||
      lower.includes('hostinger') || lower.includes('aws')) {
    return 'Technology';
  }

  // Payments
  if (lower.includes('paystack') || lower.includes('payment') || lower.includes('pay in')) {
    return 'Payment';
  }

  return undefined;
}

/**
 * Generic statement parser - tries to detect bank and parse accordingly
 */
export function parseStatement(text: string): StatementParseResult {
  // Detect bank type
  if (text.includes('FNB') || text.includes('First National Bank')) {
    return parseFNBCreditCardStatement(text);
  }

  // Add more bank parsers here
  // if (text.includes('Standard Bank')) return parseStandardBankStatement(text);
  // if (text.includes('Absa')) return parseAbsaStatement(text);
  // if (text.includes('Nedbank')) return parseNedbankStatement(text);
  // if (text.includes('Capitec')) return parseCapitecStatement(text);

  return {
    transactions: [],
    errors: ['Unsupported bank statement format. Currently supported: FNB Credit Card statements.'],
    unparsedLines: [],
  };
}

/**
 * Parse PDF text content
 * This is a helper that should be called after extracting text from PDF
 */
export async function parsePDFStatement(pdfText: string): Promise<StatementParseResult> {
  return parseStatement(pdfText);
}

/**
 * Match parsed transaction to existing category
 */
export function matchCategory(
  parsedCategory: string | undefined,
  existingCategories: Array<{ id: string; name: string; type: 'income' | 'expense' }>
): string | undefined {
  if (!parsedCategory) return undefined;

  // Try exact match first
  const exactMatch = existingCategories.find(
    cat => cat.name.toLowerCase() === parsedCategory.toLowerCase()
  );
  if (exactMatch) return exactMatch.id;

  // Try partial match
  const partialMatch = existingCategories.find(
    cat => cat.name.toLowerCase().includes(parsedCategory.toLowerCase()) ||
           parsedCategory.toLowerCase().includes(cat.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.id;

  return undefined;
}
