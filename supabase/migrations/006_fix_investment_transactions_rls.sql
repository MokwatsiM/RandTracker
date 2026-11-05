-- Fix Investment Transactions RLS Policies
-- This migration ensures the RLS policies work correctly with auth.uid()

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can create own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can update own investment transactions" ON investment_transactions;
DROP POLICY IF EXISTS "Users can delete own investment transactions" ON investment_transactions;

-- Recreate policies with proper checks
CREATE POLICY "Users can view own investment transactions"
    ON investment_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment transactions"
    ON investment_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment transactions"
    ON investment_transactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment transactions"
    ON investment_transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Add a helper function to debug RLS issues (optional)
CREATE OR REPLACE FUNCTION check_investment_transaction_access()
RETURNS TABLE (
    current_user_id UUID,
    has_session BOOLEAN,
    can_insert BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        auth.uid() as current_user_id,
        (auth.uid() IS NOT NULL) as has_session,
        (auth.uid() IS NOT NULL) as can_insert;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_investment_transaction_access() TO authenticated;

COMMENT ON FUNCTION check_investment_transaction_access() IS 'Helper function to debug investment transaction RLS issues';
