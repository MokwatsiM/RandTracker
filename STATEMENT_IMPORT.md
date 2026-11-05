# Statement Import Feature

## Overview

The Statement Import feature allows you to automatically import transactions from PDF bank statements, eliminating the need to manually enter each transaction. The system intelligently parses the statement, extracts transaction details, and allows you to review and import them with just a few clicks.

## Supported Banks

Currently supported:
- ✅ **FNB (First National Bank)** - Credit Card statements

Coming soon:
- Standard Bank
- Absa
- Nedbank
- Capitec

## How It Works

### Step 1: Upload Statement

1. Navigate to the **Transactions** page
2. Click the **"Import Statement"** button in the top right
3. Select the account you want to import transactions into
4. Upload your PDF bank statement

### Step 2: Review Parsed Transactions

The system will automatically:
- Extract all transactions from the statement
- Parse transaction dates, merchants, amounts, and locations
- Categorize transactions based on merchant names
- Show you a summary of what was found

You'll see:
- **Account Number** (last 4 digits)
- **Statement Date**
- **Number of transactions found**
- List of all parsed transactions with:
  - Date
  - Merchant name
  - Location
  - Amount (with income/expense indicator)
  - Suggested category

### Step 3: Select Transactions

- **All transactions are selected by default**
- Click on any transaction to toggle selection
- Use "Select All" / "Deselect All" to quickly manage selections
- Only selected transactions will be imported

### Step 4: Import

Click **"Import N Transactions"** to add them to your account. The system will:
- Create transactions in your selected account
- Mark them as paid (since they're from a statement)
- Match categories based on merchant names
- Add location information in the notes field
- Tag them as "Imported from statement"

## Example Statement Parsing

Given this transaction in your FNB statement:
```
03 May  Paystack *Bubbles S    Midrand ZA    600.00
```

The parser will extract:
- **Date**: 2026-05-03
- **Merchant**: Paystack *Bubbles S
- **Location**: Midrand
- **Amount**: R600.00 (expense)
- **Category**: Payment (auto-detected)

## Automatic Categorization

The system intelligently categorizes transactions based on merchant names:

| Merchant Pattern | Auto Category |
|------------------|---------------|
| PnP, Pick n Pay, Checkers, Woolworths, Spar | **Groceries** |
| Engen, Shell, BP, Total, Sasol | **Fuel** |
| Gautrain, Uber, Bolt | **Transport** |
| Spotify, Netflix, DSTV, Showmax | **Entertainment** |
| Amazon, Google, Microsoft, AWS, Hostinger | **Technology** |
| Paystack, "Pay In" | **Payment** |

If no automatic match is found, the system will use your default category for that transaction type (income/expense).

## Handling Credits and Payments

The parser correctly identifies:
- **Credits** (marked with "Cr" in statement) → Imported as **income**
- **Debits** (regular transactions) → Imported as **expenses**
- **Payments received** → Imported as income with "Payment" category
- **Refunds** → Imported as income

Example from your statement:
```
02 May  1in Pay In Eb - Pick N P  Ay Vodsqlyc6  2 987.59Cr
```
This would be imported as **income** of R2,987.59.

## Duplicate Detection

Before importing, you should check if transactions already exist in your account to avoid duplicates. The system does not automatically detect duplicates yet, but this is planned for a future update.

**Best Practice**: Filter your transaction list by date range matching the statement before importing to visually check for duplicates.

## Troubleshooting

### "Unsupported bank statement format"

**Solution**: Currently, only FNB credit card statements are supported. Make sure you're uploading an FNB statement. Support for more banks is coming soon.

### "Failed to parse statement"

**Possible causes**:
1. **Scanned PDF**: The statement might be a scanned image rather than text-based PDF
2. **Encrypted PDF**: Some banks password-protect statements
3. **Wrong format**: Ensure it's a transaction statement, not a summary or other document

**Solution**: Try downloading the statement again from your bank's portal, ensuring it's a text-based PDF.

### Some transactions not imported

**Possible causes**:
1. **Date parsing issues**: Transactions from previous years might have incorrect dates
2. **Format variations**: Different transaction types might have different formats
3. **Multi-line transactions**: Foreign currency transactions with amounts on multiple lines
4. **Parsing errors**: Listed in the "Parsing Warnings" section

**Solution**:
1. Check the "Unparsed Transactions" section in the import dialog
2. Review the original line and reason why it couldn't be parsed
3. After importing successful transactions, manually add the unparsed ones using the "Add Transaction" button
4. Copy the details from the unparsed line shown in the dialog

**Manual Workaround**:
If you see unparsed transactions:
1. Import all successfully parsed transactions first
2. Note down the details from the "Unparsed Transactions" section
3. Click "Add Transaction" on the Transactions page
4. Manually enter the date, merchant, amount from the unparsed line
5. Assign the appropriate category

### Wrong categories assigned

**Solution**: After importing, you can edit any transaction to change its category:
1. Click on the transaction in your transaction list
2. Select the correct category
3. Save the changes

### Amounts in wrong currency

**Issue**: All amounts are assumed to be in ZAR (South African Rand).

**Solution**: For foreign currency transactions, the parser will show the foreign amount in the notes. You may need to manually adjust the amount or create separate transactions.

## Best Practices

### 1. Import Regularly

Import your statements monthly when you receive them to keep your records up-to-date and avoid large backlogs.

### 2. Review Before Importing

Always review the parsed transactions before importing. Check that:
- Dates are correct
- Amounts match the statement
- Categories make sense
- No duplicates exist

### 3. Check Your Balance

After importing, verify that your account balance in the app matches the closing balance on your statement.

### 4. Organize by Statement

Consider adding a note or tag to indicate which statement the transactions came from:
- "May 2026 Statement"
- "Statement #036"

This helps with reconciliation later.

### 5. Handle Foreign Transactions

For transactions in foreign currency, the parser extracts the foreign amount:
```
12 May  Www.Hostinger.Com  Larnaca CY  1 277.06
        Foreign Amount: 75.49
```

The ZAR amount (R1,277.06) is used, but the foreign amount (75.49 EUR) is noted.

## Technical Details

### Supported PDF Types

- ✅ Text-based PDFs (searchable, copyable text)
- ❌ Scanned/Image PDFs (will be supported in future with OCR)
- ❌ Password-protected PDFs

### Data Extraction

The parser uses pattern matching to extract:
1. **Account number** from header
2. **Statement date** from header
3. **Opening/Closing balances** from summary
4. **Transactions** using regex patterns for date + description + amount

### Category Matching

When importing, the system:
1. Checks the suggested category from parsing
2. Tries to match it to your existing categories (exact match first, then partial)
3. Falls back to your default category for that transaction type if no match found

### Data Privacy

- **All processing happens on your server** - PDFs are not sent to external services
- **Temporary storage** - Uploaded PDFs are processed in memory and not saved to disk
- **Your data** - Extracted transaction data belongs to you and is stored in your Supabase database

## API Endpoint

### `POST /api/statements/upload`

Upload and parse a bank statement PDF.

**Request** (multipart/form-data):
```
file: PDF file
accountId: Account ID to import into
```

**Response**:
```json
{
  "success": true,
  "accountNumber": "4480080454752000",
  "statementDate": "28 May 2026",
  "openingBalance": 217385,
  "closingBalance": -1052,
  "transactions": [
    {
      "date": "2026-04-28",
      "description": "Pnp Crp Southdowns Pretoria ZA",
      "merchant": "Pnp Crp Southdowns",
      "location": "Pretoria",
      "amount": 34638,
      "type": "expense",
      "category": "Groceries",
      "rawText": "28 Apr Pnp Crp Southdowns Pretoria ZA 346.38"
    }
  ],
  "errors": [],
  "transactionCount": 25
}
```

## Parser Utility Functions

### `parseStatement(text: string)`

Main parsing function that detects the bank and routes to the appropriate parser.

```typescript
import { parseStatement } from '@/lib/statement-parser';

const result = parseStatement(pdfText);
console.log(`Found ${result.transactions.length} transactions`);
```

### `matchCategory(parsedCategory, existingCategories)`

Matches a parsed category string to your existing categories.

```typescript
import { matchCategory } from '@/lib/statement-parser';

const categoryId = matchCategory('Groceries', userCategories);
```

## Future Enhancements

### Planned Features

- [ ] Support for more banks (Standard Bank, Absa, Nedbank, Capitec)
- [ ] Automatic duplicate detection and merging
- [ ] OCR support for scanned PDF statements
- [ ] Bulk import (multiple statements at once)
- [ ] Statement reconciliation (match imported vs manual transactions)
- [ ] Import history tracking
- [ ] Custom parsing rules (user-defined patterns)
- [ ] Excel/CSV statement import
- [ ] Bank API integration (automatic fetching)

### Contributing Parser Support

If you'd like to add support for your bank's statement format:

1. Provide sample statements (with sensitive data redacted)
2. Document the statement structure
3. Create a parser function following the FNB example
4. Submit a pull request

## Examples

### Example 1: FNB Credit Card Statement

**Statement Info**:
- Account: FNB Private Clients Credit Card
- Statement Date: 28 May 2026
- Transactions: 25
- Period: April 28 - May 26, 2026

**Sample Transactions**:
```
28 Apr  Pnp Crp Southdowns         Pretoria ZA      346.38
01 May  Pnp Hpr Centurion          Brakfontein ZA  3478.43
02 May  Amazon Web Services        Cape Town ZA     300.63
03 May  Paystack *Bubbles S        Midrand ZA       600.00
05 May  Spotifyza                  Cape Town ZA     119.99
16 May  Engen Big Bird South       Crowthorne ZA    500.00
```

**Parsing Result**:
- ✅ 25 transactions extracted
- ✅ All amounts correctly parsed
- ✅ All dates converted to ISO format
- ✅ Categories auto-assigned (Groceries, Technology, Entertainment, Fuel)
- ✅ Locations extracted

**Import Result**:
- 25 transactions created
- All marked as "paid"
- Tagged as "Imported from statement"
- Account balance updated

---

**Last Updated**: 2026-06-01
**Version**: 1.0.0
**Supported Banks**: FNB Credit Cards
