-- Migration: Fix liability account balances to be stored as negative values
-- This ensures proper accounting: paying off debt reduces the negative balance

-- Update existing liability accounts (credit cards, loans, store cards) to have negative balances
-- Only update accounts where the balance is currently positive
UPDATE accounts
SET
  initial_balance = -ABS(initial_balance),
  current_balance = -ABS(current_balance),
  updated_at = NOW()
WHERE
  type IN ('credit_card', 'loan', 'store_card')
  AND (initial_balance > 0 OR current_balance > 0);

-- Add a comment explaining the accounting logic
COMMENT ON COLUMN accounts.initial_balance IS 'Balance in cents. For liability accounts (credit_card, loan, store_card), stored as negative values to represent debt.';
COMMENT ON COLUMN accounts.current_balance IS 'Current balance in cents. For liability accounts (credit_card, loan, store_card), stored as negative values to represent debt. Paying off debt (expense transactions) reduces this negative balance towards zero.';
