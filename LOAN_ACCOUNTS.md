# Loan Accounts & Liability Accounting

## Overview

Loan accounts (including credit cards and store cards) represent **liabilities** - money you owe. In the Rand Tracker app, these accounts use proper accounting principles to ensure that paying off debt correctly reduces your outstanding balance.

## How Loan Balances Work

### Storage Convention

**Liability accounts store balances as NEGATIVE numbers:**

- Home loan of R900,000 → stored as `-90000000` cents (negative)
- Credit card debt of R5,000 → stored as `-500000` cents (negative)
- Store card balance of R1,200 → stored as `-120000` cents (negative)

**Asset accounts store balances as POSITIVE numbers:**

- Cheque account with R10,000 → stored as `1000000` cents (positive)
- Savings account with R50,000 → stored as `5000000` cents (positive)

### Why Negative Balances?

Using negative balances for liabilities ensures proper accounting:

1. **Net Worth Calculation**: Your total balance correctly subtracts debts
   - Assets: +R10,000 (cheque) + R50,000 (savings) = +R60,000
   - Liabilities: -R900,000 (loan) + -R5,000 (credit card) = -R905,000
   - **Net Worth**: R60,000 - R905,000 = **-R845,000**

2. **Transaction Logic**: Payments work intuitively
   - When you pay R5,000 towards your loan from your cheque account:
     - Cheque account (expense): R10,000 → R5,000 (decreased by payment)
     - Loan account: -R900,000 → -R895,000 (debt reduced by payment)

3. **Progress Tracking**: Easy to see how much you've paid off
   - Original loan: R1,200,000 (stored in `loan_principal`)
   - Current outstanding: -R900,000 (stored in `current_balance`)
   - Amount paid: R1,200,000 - R900,000 = **R300,000**
   - Progress: 25% paid off

## Creating a Loan Account

When you create a loan account, the UI asks for:

- **Account Name**: e.g., "FNB Home Loan"
- **Current Outstanding**: e.g., R900,000 (enter as positive number)
- **Loan Amount**: e.g., R1,200,000 (original loan principal)
- **Interest Rate**: e.g., 11.5%
- **Term**: e.g., 240 months (20 years)
- **Monthly Payment**: e.g., R12,000

**Behind the scenes:**
- You enter: R900,000
- App stores: -R900,000 (automatically converted to negative)
- Display shows: R900,000 (absolute value for clarity)

## Recording Loan Payments

### Correct Method: Expense Transaction

When you make a loan payment, record it as an **EXPENSE** from your cheque account:

```
Type: Expense
Account: FNB Cheque Account
Amount: R5,000
Category: Loan Payment
Date: Today
```

**What happens:**
1. Cheque account balance: R10,000 → R5,000 (money leaves your account)
2. Loan account balance: -R900,000 → -R895,000 (debt reduced)
3. Net worth: Still -R890,000 (no change - you converted one asset to reduce a liability)

### Incorrect Method: Income Transaction

❌ **DO NOT** record loan payments as "income" to the loan account. This would:
- Increase the debt: -R900,000 → -R905,000 (WRONG!)
- Make your loan bigger instead of smaller

## Understanding Transaction Types for Loans

### For Loan Accounts:

1. **Expense Transactions = Loan Payments**
   - Recording an expense on a loan account represents a payment
   - Reduces the negative balance (pays off debt)
   - Example: R5,000 expense on loan account reduces -R900,000 to -R895,000

2. **Income Transactions = Borrowing More (Rare)**
   - Recording income on a loan account represents taking on more debt
   - Increases the negative balance (increases debt)
   - Example: R10,000 income on loan account increases -R900,000 to -R910,000
   - **Use Case**: Refinancing or taking out additional funds from a home loan

3. **Transfers = Moving Money**
   - Not typically used for loan accounts
   - Could represent paying a loan from one account to another

### For Your Cheque Account (Where Payments Come From):

1. **Expense Transaction**
   - This is what you use to record a loan payment
   - Money leaves your cheque account to pay the loan
   - Example: R5,000 expense reduces cheque balance from R10,000 to R5,000

## Examples

### Example 1: Home Loan Setup

**Creating the account:**
- Loan Amount (principal): R1,200,000
- Current Outstanding: R900,000
- Interest Rate: 11.5% per year
- Monthly Payment: R12,000
- Term: 240 months

**What's stored:**
```json
{
  "type": "loan",
  "name": "FNB Home Loan",
  "initial_balance": -90000000,  // -R900,000 in cents
  "current_balance": -90000000,
  "loan_principal": 120000000,   // R1,200,000 in cents (positive)
  "loan_interest_rate": 11.5,
  "monthly_instalment": 1200000, // R12,000 in cents
  "loan_term_months": 240
}
```

**Display shows:**
- Outstanding: R900,000 (shown as positive for clarity)
- Original Amount: R1,200,000
- Progress: 25% paid off

### Example 2: Making a Payment

**Transaction:**
- Type: Expense
- From Account: FNB Cheque Account
- Amount: R12,000
- Category: Loan Payment
- Date: 2026-06-05

**Before:**
- Cheque Account: R50,000
- Loan Account: -R900,000

**After:**
- Cheque Account: R38,000 (R50,000 - R12,000)
- Loan Account: -R888,000 (-R900,000 + R12,000 = less debt)

**Note:** The loan balance calculation automatically applies the expense transaction to reduce the debt.

### Example 3: Credit Card Payment

**Credit Card Setup:**
- Current Balance: R5,000 owed
- Credit Limit: R20,000
- Stored as: -R5,000 (negative)

**Making Payment:**
1. Record expense from cheque account:
   - Type: Expense
   - Account: Standard Bank Cheque
   - Amount: R2,000
   - Category: Credit Card Payment

2. Cheque account: R10,000 → R8,000
3. Credit card: -R5,000 → -R3,000 (debt reduced)
4. Available credit: R20,000 - R3,000 = R17,000

### Example 4: Using Credit Card (New Purchase)

**When you make a purchase on your credit card:**

1. Record as income to the credit card account:
   - Type: Income
   - Account: FNB Credit Card
   - Amount: R500
   - Category: Groceries
   - Notes: Woolworths shopping

2. Credit card balance: -R3,000 → -R3,500 (debt increased)
3. Available credit: R17,000 → R16,500

**Why income?** Because the credit card is giving you money/goods on credit, increasing your debt.

## Visual Balance Display

The app displays balances differently for clarity:

### In Account Cards:
- **Loan Accounts**: Show as "R900,000" (absolute value, red text)
- **Credit Cards**: Show as "R5,000" (absolute value, red text)
- **Cheque Accounts**: Show as "R10,000" (regular text)
- **Savings Accounts**: Show as "R50,000" (regular text)

### In Total Balance (Dashboard):
- Correctly calculates: Assets - Liabilities
- Example: R60,000 (assets) - R905,000 (liabilities) = **-R845,000**

## Migration for Existing Accounts

If you created loan accounts before this fix, run the migration:

```bash
# This will convert positive balances to negative for all liability accounts
supabase db push
```

The migration (`007_fix_liability_account_balances.sql`) will:
1. Find all credit card, loan, and store card accounts
2. Convert positive balances to negative
3. Update both `initial_balance` and `current_balance`
4. Add database comments explaining the convention

## Troubleshooting

### My loan balance is increasing when I make payments

**Problem**: You're recording payments as "Income" instead of "Expense"

**Solution**:
1. Delete the incorrect income transaction
2. Create a new expense transaction from your cheque account
3. The loan balance will correctly decrease

### My loan shows a negative balance in the UI

**Problem**: The app is displaying the raw stored value (negative) instead of absolute value

**Solution**: This has been fixed in the AccountCard component. Update to the latest version.

### My total balance doesn't include my loan

**Problem**: The getTotalBalance function might not be subtracting liabilities

**Solution**: This has been fixed in accountStore. The function now correctly:
```typescript
getTotalBalance: () =>
  accounts.reduce((total, account) => {
    if (account.type === 'credit_card' || account.type === 'loan' || account.type === 'store_card') {
      return total - account.current_balance; // Subtracts negative (adds absolute value)
    }
    return total + account.current_balance;
  }, 0)
```

## Summary

**Key Principles:**

1. ✅ Loan balances stored as **negative** numbers
2. ✅ Loan payments recorded as **expenses** from your bank account
3. ✅ UI displays **absolute values** for clarity (R900,000 instead of -R900,000)
4. ✅ Total balance correctly subtracts liabilities from assets
5. ✅ Progress tracking works intuitively (original - current = amount paid)

**Quick Reference:**

| Action | Transaction Type | Account | Result |
|--------|------------------|---------|---------|
| Pay loan | Expense | Cheque Account | Loan balance decreases (towards 0) |
| Borrow more | Income | Loan Account | Loan balance increases (more debt) |
| Use credit card | Income | Credit Card | Card balance increases (more debt) |
| Pay credit card | Expense | Cheque Account | Card balance decreases (towards 0) |

---

**Last Updated**: 2026-06-01
**Version**: 1.0.0
**Related Files**:
- `/src/components/accounts/AccountDialog.tsx`
- `/src/components/accounts/AccountCard.tsx`
- `/src/stores/accountStore.ts`
- `/src/lib/supabase/data.ts`
- `/supabase/migrations/007_fix_liability_account_balances.sql`
