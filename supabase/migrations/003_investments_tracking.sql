-- Investment & Savings Tracking Module
-- Supports TFSA, Fixed Deposits, Unit Trusts, ETFs, Stocks, and general savings

-- ============================================================================
-- INVESTMENTS TABLE
-- ============================================================================
CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic Information
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'tfsa',              -- Tax-Free Savings Account
        'unit_trust',        -- Unit Trust
        'etf',              -- Exchange Traded Fund
        'stock',            -- Individual Stock
        'fixed_deposit',    -- Fixed Deposit
        'savings_account',  -- Regular Savings Account
        'retirement_annuity', -- Retirement Annuity
        'other'
    )),
    provider TEXT,          -- e.g., "Satrix", "Allan Gray", "FNB"

    -- Account Linking
    linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

    -- Financial Details
    initial_amount BIGINT NOT NULL DEFAULT 0,      -- Initial investment in cents
    current_value BIGINT NOT NULL DEFAULT 0,       -- Current value in cents
    total_contributions BIGINT DEFAULT 0,          -- Total contributed in cents
    total_withdrawals BIGINT DEFAULT 0,            -- Total withdrawn in cents

    -- Interest/Returns
    interest_rate DECIMAL(5,2),                    -- Annual interest rate %
    is_compound_interest BOOLEAN DEFAULT FALSE,
    compound_frequency TEXT CHECK (compound_frequency IN ('daily', 'monthly', 'quarterly', 'annually')),

    -- TFSA Specific
    is_tfsa BOOLEAN DEFAULT FALSE,
    tfsa_annual_limit BIGINT DEFAULT 3600000,     -- R36,000 in cents (2024 limit)
    tfsa_year_start_date DATE,                     -- When TFSA year starts (usually March 1)
    tfsa_year_end_date DATE,                       -- When TFSA year ends (usually Feb 28/29)
    tfsa_current_year_contribution BIGINT DEFAULT 0, -- Amount contributed this TFSA year
    tfsa_lifetime_contribution BIGINT DEFAULT 0,   -- Total lifetime TFSA contribution
    tfsa_lifetime_limit BIGINT DEFAULT 50000000,   -- R500,000 lifetime limit in cents

    -- Fixed Deposit Specific
    is_fixed_deposit BOOLEAN DEFAULT FALSE,
    fixed_deposit_term_months INTEGER,            -- Term length in months
    fixed_deposit_start_date DATE,
    fixed_deposit_maturity_date DATE,
    fixed_deposit_auto_renew BOOLEAN DEFAULT FALSE,

    -- Performance Tracking
    purchase_price BIGINT,                         -- For stocks/ETFs: purchase price per unit
    current_price BIGINT,                          -- Current price per unit
    units_held DECIMAL(15,4),                      -- Number of units/shares

    -- Metadata
    currency TEXT DEFAULT 'ZAR',
    icon TEXT DEFAULT '📈',
    color TEXT DEFAULT '#10b981',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_tfsa_dates CHECK (
        NOT is_tfsa OR (tfsa_year_start_date IS NOT NULL AND tfsa_year_end_date IS NOT NULL)
    ),
    CONSTRAINT valid_fixed_deposit CHECK (
        NOT is_fixed_deposit OR (
            fixed_deposit_term_months IS NOT NULL AND
            fixed_deposit_start_date IS NOT NULL AND
            fixed_deposit_maturity_date IS NOT NULL
        )
    )
);

-- Enable RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own investments"
    ON investments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investments"
    ON investments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
    ON investments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
    ON investments FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_type ON investments(type);
CREATE INDEX idx_investments_is_tfsa ON investments(is_tfsa) WHERE is_tfsa = TRUE;
CREATE INDEX idx_investments_linked_account ON investments(linked_account_id);

-- ============================================================================
-- INVESTMENT TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE investment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,

    type TEXT NOT NULL CHECK (type IN (
        'contribution',     -- Adding money
        'withdrawal',       -- Taking money out
        'dividend',         -- Dividend payment received
        'interest',         -- Interest payment
        'fee',             -- Management/admin fee
        'rebalance',       -- Portfolio rebalancing
        'transfer_in',     -- Transfer from another investment
        'transfer_out'     -- Transfer to another investment
    )),

    amount BIGINT NOT NULL,                        -- Amount in cents
    units DECIMAL(15,4),                           -- Units/shares bought/sold
    price_per_unit BIGINT,                         -- Price per unit in cents

    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,

    -- For transfers
    related_transaction_id UUID REFERENCES investment_transactions(id) ON DELETE SET NULL,

    -- Link to bank transaction
    bank_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own investment transactions"
    ON investment_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment transactions"
    ON investment_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment transactions"
    ON investment_transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment transactions"
    ON investment_transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_investment_transactions_user_id ON investment_transactions(user_id);
CREATE INDEX idx_investment_transactions_investment_id ON investment_transactions(investment_id);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(date DESC);
CREATE INDEX idx_investment_transactions_type ON investment_transactions(type);

-- ============================================================================
-- INVESTMENT PERFORMANCE SNAPSHOTS TABLE
-- ============================================================================
CREATE TABLE investment_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,

    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    value BIGINT NOT NULL,                         -- Value at snapshot time in cents
    units DECIMAL(15,4),                           -- Units held at snapshot
    price_per_unit BIGINT,                         -- Price per unit at snapshot

    -- Performance metrics
    total_gain_loss BIGINT,                        -- Total gain/loss in cents
    total_gain_loss_percentage DECIMAL(8,4),       -- Gain/loss as percentage

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(investment_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE investment_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own investment snapshots"
    ON investment_performance_snapshots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment snapshots"
    ON investment_performance_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_investment_snapshots_investment_id ON investment_performance_snapshots(investment_id);
CREATE INDEX idx_investment_snapshots_date ON investment_performance_snapshots(snapshot_date DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_investments_updated_at
    BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investment_transactions_updated_at
    BEFORE UPDATE ON investment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS FOR INVESTMENT CALCULATIONS
-- ============================================================================

-- Function to calculate investment performance
CREATE OR REPLACE FUNCTION calculate_investment_performance(investment_uuid UUID)
RETURNS TABLE (
    total_invested BIGINT,
    current_value BIGINT,
    total_gain_loss BIGINT,
    gain_loss_percentage DECIMAL(8,4),
    total_contributions BIGINT,
    total_withdrawals BIGINT,
    total_dividends BIGINT,
    total_fees BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 0)::BIGINT as total_invested,
        i.current_value,
        (i.current_value - COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 0))::BIGINT as total_gain_loss,
        CASE
            WHEN COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 0) > 0
            THEN ((i.current_value - COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 0))::DECIMAL /
                  COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 1) * 100)
            ELSE 0
        END as gain_loss_percentage,
        COALESCE(SUM(CASE WHEN it.type = 'contribution' THEN it.amount ELSE 0 END), 0)::BIGINT as total_contributions,
        COALESCE(SUM(CASE WHEN it.type = 'withdrawal' THEN it.amount ELSE 0 END), 0)::BIGINT as total_withdrawals,
        COALESCE(SUM(CASE WHEN it.type = 'dividend' THEN it.amount ELSE 0 END), 0)::BIGINT as total_dividends,
        COALESCE(SUM(CASE WHEN it.type = 'fee' THEN it.amount ELSE 0 END), 0)::BIGINT as total_fees
    FROM investments i
    LEFT JOIN investment_transactions it ON it.investment_id = i.id
    WHERE i.id = investment_uuid
    GROUP BY i.id, i.current_value;
END;
$$ LANGUAGE plpgsql;

-- Function to update TFSA year contribution when transaction is added
CREATE OR REPLACE FUNCTION update_tfsa_contribution()
RETURNS TRIGGER AS $$
DECLARE
    inv RECORD;
    current_year_total BIGINT;
BEGIN
    -- Get the investment details
    SELECT * INTO inv FROM investments WHERE id = NEW.investment_id;

    -- Only process if it's a TFSA and transaction is a contribution
    IF inv.is_tfsa AND NEW.type = 'contribution' THEN
        -- Calculate current year contributions
        SELECT COALESCE(SUM(amount), 0) INTO current_year_total
        FROM investment_transactions
        WHERE investment_id = NEW.investment_id
            AND type = 'contribution'
            AND date >= inv.tfsa_year_start_date
            AND date <= inv.tfsa_year_end_date;

        -- Update the investment
        UPDATE investments
        SET
            tfsa_current_year_contribution = current_year_total,
            tfsa_lifetime_contribution = tfsa_lifetime_contribution + NEW.amount,
            total_contributions = total_contributions + NEW.amount
        WHERE id = NEW.investment_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tfsa_contribution
    AFTER INSERT ON investment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_tfsa_contribution();

-- Function to create daily performance snapshot
CREATE OR REPLACE FUNCTION create_investment_snapshot(investment_uuid UUID)
RETURNS VOID AS $$
DECLARE
    inv RECORD;
    perf RECORD;
BEGIN
    -- Get investment details
    SELECT * INTO inv FROM investments WHERE id = investment_uuid;

    -- Calculate performance
    SELECT * INTO perf FROM calculate_investment_performance(investment_uuid);

    -- Insert snapshot (will skip if already exists for today)
    INSERT INTO investment_performance_snapshots (
        user_id,
        investment_id,
        snapshot_date,
        value,
        units,
        price_per_unit,
        total_gain_loss,
        total_gain_loss_percentage
    ) VALUES (
        inv.user_id,
        investment_uuid,
        CURRENT_DATE,
        inv.current_value,
        inv.units_held,
        inv.current_price,
        perf.total_gain_loss,
        perf.gain_loss_percentage
    )
    ON CONFLICT (investment_id, snapshot_date)
    DO UPDATE SET
        value = EXCLUDED.value,
        units = EXCLUDED.units,
        price_per_unit = EXCLUDED.price_per_unit,
        total_gain_loss = EXCLUDED.total_gain_loss,
        total_gain_loss_percentage = EXCLUDED.total_gain_loss_percentage;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- View for investment summary
CREATE OR REPLACE VIEW investment_summary AS
SELECT
    i.id,
    i.user_id,
    i.name,
    i.type,
    i.provider,
    i.is_tfsa,
    i.is_fixed_deposit,
    perf.total_invested,
    perf.current_value,
    perf.total_gain_loss,
    perf.gain_loss_percentage,
    perf.total_contributions,
    perf.total_withdrawals,
    perf.total_dividends,
    perf.total_fees
FROM investments i
CROSS JOIN LATERAL calculate_investment_performance(i.id) perf
WHERE i.is_active = TRUE;

-- Grant access to view
GRANT SELECT ON investment_summary TO authenticated;

-- View for TFSA limit tracking
CREATE OR REPLACE VIEW tfsa_limits AS
SELECT
    i.id,
    i.user_id,
    i.name,
    i.tfsa_annual_limit,
    i.tfsa_current_year_contribution,
    (i.tfsa_annual_limit - i.tfsa_current_year_contribution) as tfsa_remaining_this_year,
    i.tfsa_lifetime_limit,
    i.tfsa_lifetime_contribution,
    (i.tfsa_lifetime_limit - i.tfsa_lifetime_contribution) as tfsa_remaining_lifetime,
    i.tfsa_year_start_date,
    i.tfsa_year_end_date,
    CASE
        WHEN i.tfsa_current_year_contribution >= i.tfsa_annual_limit THEN TRUE
        ELSE FALSE
    END as tfsa_year_limit_reached,
    CASE
        WHEN i.tfsa_lifetime_contribution >= i.tfsa_lifetime_limit THEN TRUE
        ELSE FALSE
    END as tfsa_lifetime_limit_reached
FROM investments i
WHERE i.is_tfsa = TRUE AND i.is_active = TRUE;

-- Grant access to view
GRANT SELECT ON tfsa_limits TO authenticated;
