# Investment Value Auto-Update Fix

## Problem

When you add investment transactions (like monthly interest gains) to an investment, the `current_value` of the investment was **not updating automatically**. This meant:

- Adding an interest transaction of R500 wouldn't increase the portfolio value
- The investment card still showed the old value
- You had to manually update the investment value

## Root Cause

The `investments` table has a `current_value` field that tracks the total value of the investment. However, there was **no database trigger** to automatically recalculate this value when `investment_transactions` were added, updated, or deleted.

The system had:
- ✅ `investment_transactions` table to track contributions, withdrawals, dividends, interest, fees
- ❌ **Missing**: Automatic recalculation of `investments.current_value` based on those transactions

## Solution

Created a **database trigger** that automatically recalculates `investments.current_value` whenever an `investment_transaction` is:
- **Inserted** (new transaction added)
- **Updated** (existing transaction modified)
- **Deleted** (transaction removed)

### How It Works

The trigger function `update_investment_current_value()` **incrementally updates** the current value when transactions are added, updated, or deleted:

**On INSERT** (adding a new transaction):
```
current_value = current_value + transaction_amount  (for contributions, interest, dividends, transfer_in)
current_value = current_value - transaction_amount  (for withdrawals, fees, transfer_out)
```

**On UPDATE** (modifying a transaction):
```
1. Reverse old transaction effect
2. Apply new transaction effect
```

**On DELETE** (removing a transaction):
```
current_value = current_value - transaction_amount  (reverses the original effect)
```

**Example:**

1. Initial investment: R10,000
2. Add monthly interest: R500
3. **Before fix**: Current value stays R10,000 ❌
4. **After fix**: Current value automatically updates to R10,500 ✅

## Implementation Details

### Migration File

[`supabase/migrations/008_auto_update_investment_value.sql`](supabase/migrations/008_auto_update_investment_value.sql)

### Database Function

```sql
CREATE OR REPLACE FUNCTION update_investment_current_value()
RETURNS TRIGGER AS $$
-- Incrementally updates current_value based on transaction type:
-- Adds: contributions, interest, dividends, transfer_in
-- Subtracts: withdrawals, fees, transfer_out
$$
```

### Triggers

Three triggers handle all cases:

1. **`trigger_update_investment_current_value_insert`** - Fires after INSERT
2. **`trigger_update_investment_current_value_update`** - Fires after UPDATE
3. **`trigger_update_investment_current_value_delete`** - Fires after DELETE

## Transaction Types and Their Effect

| Transaction Type | Effect on `current_value` | Example |
|-----------------|---------------------------|---------|
| `contribution` | **+** Increases value | Depositing R1,000 |
| `withdrawal` | **-** Decreases value | Withdrawing R500 |
| `dividend` | **+** Increases value | Dividend payout R200 |
| `interest` | **+** Increases value | Monthly interest R500 |
| `fee` | **-** Decreases value | Admin fee R50 |
| `transfer_in` | **+** Increases value | Transfer from another investment |
| `transfer_out` | **-** Decreases value | Transfer to another investment |
| `rebalance` | **No effect** | Portfolio rebalancing (doesn't change total value) |

## Usage

### Adding Monthly Interest

**Before the fix:**
1. Add investment transaction: Type=Interest, Amount=R500
2. Current value: R10,000 (unchanged) ❌
3. Manual step needed: Edit investment, update current_value to R10,500

**After the fix:**
1. Add investment transaction: Type=Interest, Amount=R500
2. Current value: **R10,500** (automatically updated) ✅
3. No manual steps needed!

### Example Scenario

**Investment Setup:**
- Name: "Discovery TFSA"
- Type: TFSA
- Initial Amount: R10,000
- Current Value: R10,000

**Transactions:**
1. **Month 1**: Add interest transaction of R500
   - Current Value → R10,500 ✅
2. **Month 2**: Add interest transaction of R520
   - Current Value → R11,020 ✅
3. **Month 3**: Withdraw R1,000
   - Current Value → R10,020 ✅
4. **Month 4**: Delete the withdrawal transaction
   - Current Value → R11,020 ✅ (back to Month 2 value)

## Applying the Migration

To enable this fix in your database:

```bash
# Navigate to project directory
cd /Users/motebangmpmokwatsi/Desktop/development/rand_tracker

# Apply the migration (if using Supabase CLI)
supabase db push

# Or apply manually via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste the contents of 008_auto_update_investment_value.sql
# 3. Run the query
```

## Important Note About Existing Investments

**The incremental update approach means:**
- The trigger only updates `current_value` when transactions are added/updated/deleted **after** the trigger is installed
- Existing investments that were manually set up with `current_value` will continue to work correctly
- The trigger adds/subtracts from the **current** value, not recalculating from scratch

**If you need to sync `current_value` with existing transactions:**

You can manually recalculate for specific investments:

```sql
-- Recalculate current_value from initial_amount + all transactions
UPDATE investments
SET current_value = (
    initial_amount
    + COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type = 'contribution'), 0)
    - COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type = 'withdrawal'), 0)
    + COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type IN ('dividend', 'interest')), 0)
    - COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type = 'fee'), 0)
    + COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type = 'transfer_in'), 0)
    - COALESCE((SELECT SUM(amount) FROM investment_transactions WHERE investment_id = investments.id AND type = 'transfer_out'), 0)
)
WHERE id = '<your-investment-id>';
```

**Only run this if:**
- You've been adding transactions but `current_value` wasn't updating
- You want to ensure perfect sync between transactions and current_value
- You're migrating from a manual system to the automated trigger

## Verification

To verify the fix is working:

1. **Check triggers exist:**
```sql
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'investment_transactions'
    AND trigger_name LIKE '%update_investment_current_value%';
```

Expected output:
```
trigger_update_investment_current_value_insert  | INSERT
trigger_update_investment_current_value_update  | UPDATE
trigger_update_investment_current_value_delete  | DELETE
```

2. **Test the functionality:**
```sql
-- Create test investment
INSERT INTO investments (user_id, name, type, initial_amount, current_value)
VALUES (auth.uid(), 'Test Investment', 'tfsa', 1000000, 1000000);  -- R10,000

-- Add interest transaction
INSERT INTO investment_transactions (user_id, investment_id, type, amount, date, description)
VALUES (auth.uid(), <investment_id>, 'interest', 50000, CURRENT_DATE, 'Monthly interest');  -- R500

-- Check current_value
SELECT name, initial_amount / 100.0 as initial, current_value / 100.0 as current
FROM investments
WHERE name = 'Test Investment';

-- Expected: current_value should be R10,500 (1050000 cents)
```

## Related Files

- **Migration**: [`supabase/migrations/008_auto_update_investment_value.sql`](supabase/migrations/008_auto_update_investment_value.sql)
- **Original Migration**: [`supabase/migrations/003_investments_tracking.sql`](supabase/migrations/003_investments_tracking.sql)
- **Schema**: [`src/lib/db/schema.ts`](src/lib/db/schema.ts) (needs Investment interface update)

## Notes

- The trigger runs **automatically** - no code changes needed in the frontend
- Works for all transaction types (insert, update, delete)
- Handles all transaction types correctly (contributions, interest, fees, etc.)
- Prevents manual errors from forgetting to update current_value
- Ensures consistency between `investment_transactions` and `investments.current_value`

---

**Last Updated**: 2026-06-02
**Version**: 1.0.0
**Status**: ✅ Fixed
