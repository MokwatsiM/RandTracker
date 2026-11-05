-- Migration: Auto-update investment current_value when transactions are added/updated/deleted
-- This ensures the current_value stays in sync with investment_transactions

-- ============================================================================
-- FUNCTION: Update Investment Current Value Incrementally
-- ============================================================================
CREATE OR REPLACE FUNCTION update_investment_current_value()
RETURNS TRIGGER AS $$
DECLARE
    inv RECORD;
    value_change BIGINT;
    old_value_change BIGINT;
BEGIN
    -- Determine which investment_id to use
    DECLARE
        target_investment_id UUID;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            target_investment_id := OLD.investment_id;
        ELSE
            target_investment_id := NEW.investment_id;
        END IF;

        -- Get the investment
        SELECT * INTO inv FROM investments WHERE id = target_investment_id;

        IF NOT FOUND THEN
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Calculate the value change based on transaction type
        -- For INSERT/UPDATE, calculate new transaction's effect
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            CASE NEW.type
                WHEN 'contribution' THEN value_change := NEW.amount;
                WHEN 'dividend' THEN value_change := NEW.amount;
                WHEN 'interest' THEN value_change := NEW.amount;
                WHEN 'transfer_in' THEN value_change := NEW.amount;
                WHEN 'withdrawal' THEN value_change := -NEW.amount;
                WHEN 'fee' THEN value_change := -NEW.amount;
                WHEN 'transfer_out' THEN value_change := -NEW.amount;
                ELSE value_change := 0;
            END CASE;
        ELSE
            value_change := 0;
        END IF;

        -- For UPDATE, subtract the old transaction's effect first
        IF TG_OP = 'UPDATE' THEN
            CASE OLD.type
                WHEN 'contribution' THEN old_value_change := OLD.amount;
                WHEN 'dividend' THEN old_value_change := OLD.amount;
                WHEN 'interest' THEN old_value_change := OLD.amount;
                WHEN 'transfer_in' THEN old_value_change := OLD.amount;
                WHEN 'withdrawal' THEN old_value_change := -OLD.amount;
                WHEN 'fee' THEN old_value_change := -OLD.amount;
                WHEN 'transfer_out' THEN old_value_change := -OLD.amount;
                ELSE old_value_change := 0;
            END CASE;
            value_change := value_change - old_value_change;
        END IF;

        -- For DELETE, reverse the transaction's effect
        IF TG_OP = 'DELETE' THEN
            CASE OLD.type
                WHEN 'contribution' THEN value_change := -OLD.amount;
                WHEN 'dividend' THEN value_change := -OLD.amount;
                WHEN 'interest' THEN value_change := -OLD.amount;
                WHEN 'transfer_in' THEN value_change := -OLD.amount;
                WHEN 'withdrawal' THEN value_change := OLD.amount;
                WHEN 'fee' THEN value_change := OLD.amount;
                WHEN 'transfer_out' THEN value_change := OLD.amount;
                ELSE value_change := 0;
            END CASE;
        END IF;

        -- Update the investment's current_value incrementally
        UPDATE investments
        SET
            current_value = current_value + value_change,
            updated_at = NOW()
        WHERE id = target_investment_id;

    END;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Apply on INSERT, UPDATE, DELETE of investment_transactions
-- ============================================================================

-- Trigger on INSERT
CREATE TRIGGER trigger_update_investment_current_value_insert
    AFTER INSERT ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_investment_current_value();

-- Trigger on UPDATE
CREATE TRIGGER trigger_update_investment_current_value_update
    AFTER UPDATE ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_investment_current_value();

-- Trigger on DELETE
CREATE TRIGGER trigger_update_investment_current_value_delete
    AFTER DELETE ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_investment_current_value();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION update_investment_current_value() IS
'Automatically updates investments.current_value incrementally when investment_transactions are added, updated, or deleted.
Triggered on INSERT, UPDATE, or DELETE of investment_transactions.
Increases for: contributions, dividends, interest, transfer_in
Decreases for: withdrawals, fees, transfer_out';
