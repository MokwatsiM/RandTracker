-- Add term_months field to debts table
-- This allows tracking the loan/debt term for payoff calculations

ALTER TABLE debts ADD COLUMN IF NOT EXISTS term_months INTEGER;

COMMENT ON COLUMN debts.term_months IS 'Original term of the debt/loan in months';

-- Update existing debts linked to loan accounts to populate term_months
UPDATE debts d
SET term_months = a.loan_term_months
FROM accounts a
WHERE d.account_id = a.id
    AND a.type = 'loan'
    AND a.loan_term_months IS NOT NULL
    AND d.term_months IS NULL;
