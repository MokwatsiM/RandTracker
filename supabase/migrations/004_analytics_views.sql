-- Analytics & Reporting Module
-- Provides comprehensive views for financial analytics and reporting

-- ============================================================================
-- SPENDING BY CATEGORY VIEW
-- ============================================================================
CREATE OR REPLACE VIEW spending_by_category AS
SELECT
    t.user_id,
    c.id as category_id,
    c.name as category_name,
    c.emoji as category_icon,
    c.color as category_color,
    c.type as transaction_type,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_amount,
    AVG(t.amount) as average_amount,
    MIN(t.date) as first_transaction_date,
    MAX(t.date) as last_transaction_date
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.type IN ('income', 'expense')
GROUP BY t.user_id, c.id, c.name, c.emoji, c.color, c.type;

-- Grant access
GRANT SELECT ON spending_by_category TO authenticated;

-- ============================================================================
-- MONTHLY SUMMARY VIEW
-- ============================================================================
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
    t.user_id,
    DATE_TRUNC('month', t.date) as month,
    SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as total_expenses,
    SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) -
    SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as net_income,
    COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_transaction_count,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_transaction_count,
    COUNT(*) as total_transaction_count
FROM transactions t
WHERE t.type IN ('income', 'expense')
GROUP BY t.user_id, DATE_TRUNC('month', t.date);

-- Grant access
GRANT SELECT ON monthly_summary TO authenticated;

-- ============================================================================
-- DAILY BALANCE VIEW
-- ============================================================================
CREATE OR REPLACE VIEW daily_balance AS
WITH date_series AS (
    SELECT
        user_id,
        generate_series(
            MIN(date),
            CURRENT_DATE,
            '1 day'::interval
        )::date as date
    FROM transactions
    GROUP BY user_id
),
daily_changes AS (
    SELECT
        t.user_id,
        t.date,
        SUM(CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            ELSE 0
        END) as daily_change
    FROM transactions t
    WHERE t.type IN ('income', 'expense')
    GROUP BY t.user_id, t.date
)
SELECT
    ds.user_id,
    ds.date,
    COALESCE(dc.daily_change, 0) as daily_change,
    SUM(COALESCE(dc.daily_change, 0)) OVER (
        PARTITION BY ds.user_id
        ORDER BY ds.date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_balance
FROM date_series ds
LEFT JOIN daily_changes dc ON ds.user_id = dc.user_id AND ds.date = dc.date;

-- Grant access
GRANT SELECT ON daily_balance TO authenticated;

-- ============================================================================
-- ACCOUNT BALANCE HISTORY VIEW
-- ============================================================================
CREATE OR REPLACE VIEW account_balance_history AS
SELECT
    a.user_id,
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    a.icon as account_icon,
    a.color as account_color,
    a.initial_balance,
    a.current_balance,
    (a.current_balance - a.initial_balance) as balance_change,
    CASE
        WHEN a.initial_balance != 0
        THEN ((a.current_balance - a.initial_balance)::DECIMAL / ABS(a.initial_balance) * 100)
        ELSE 0
    END as balance_change_percentage
FROM accounts a
WHERE a.is_archived = FALSE;

-- Grant access
GRANT SELECT ON account_balance_history TO authenticated;

-- ============================================================================
-- NET WORTH TRACKING VIEW
-- ============================================================================
CREATE OR REPLACE VIEW net_worth_summary AS
SELECT
    a.user_id,
    -- Assets (positive balances)
    SUM(CASE
        WHEN a.type IN ('cheque', 'savings', 'cash', 'investment') AND a.current_balance > 0
        THEN a.current_balance
        ELSE 0
    END) as total_assets,
    -- Liabilities (debts, loans, credit card balances)
    SUM(CASE
        WHEN a.type IN ('credit_card', 'store_card', 'loan') OR a.current_balance < 0
        THEN ABS(a.current_balance)
        ELSE 0
    END) as total_liabilities,
    -- Net Worth
    SUM(CASE
        WHEN a.type IN ('cheque', 'savings', 'cash', 'investment')
        THEN a.current_balance
        ELSE -ABS(a.current_balance)
    END) as net_worth,
    -- Investment Value
    COALESCE((
        SELECT SUM(i.current_value)
        FROM investments i
        WHERE i.user_id = a.user_id AND i.is_active = TRUE
    ), 0) as total_investments,
    -- Debt Value
    COALESCE((
        SELECT SUM(d.current_balance)
        FROM debts d
        WHERE d.user_id = a.user_id AND d.is_active = TRUE
    ), 0) as total_debt
FROM accounts a
WHERE a.is_archived = FALSE
GROUP BY a.user_id;

-- Grant access
GRANT SELECT ON net_worth_summary TO authenticated;

-- ============================================================================
-- BUDGET PERFORMANCE VIEW
-- ============================================================================
CREATE OR REPLACE VIEW budget_performance AS
SELECT
    b.user_id,
    b.id as budget_id,
    b.name as budget_name,
    b.category_id,
    c.name as category_name,
    c.emoji as category_icon,
    c.color as category_color,
    b.amount as budget_amount,
    b.period,
    b.start_date,
    b.end_date,
    COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.category_id = b.category_id
            AND t.user_id = b.user_id
            AND t.type = 'expense'
            AND t.date >= b.start_date
            AND t.date <= b.end_date
    ), 0) as spent_amount,
    b.amount - COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.category_id = b.category_id
            AND t.user_id = b.user_id
            AND t.type = 'expense'
            AND t.date >= b.start_date
            AND t.date <= b.end_date
    ), 0) as remaining_amount,
    CASE
        WHEN b.amount > 0
        THEN (COALESCE((
            SELECT SUM(t.amount)
            FROM transactions t
            WHERE t.category_id = b.category_id
                AND t.user_id = b.user_id
                AND t.type = 'expense'
                AND t.date >= b.start_date
                AND t.date <= b.end_date
        ), 0)::DECIMAL / b.amount * 100)
        ELSE 0
    END as usage_percentage
FROM budgets b
INNER JOIN categories c ON b.category_id = c.id
WHERE b.is_active = TRUE;

-- Grant access
GRANT SELECT ON budget_performance TO authenticated;

-- ============================================================================
-- TOP MERCHANTS/PAYEES VIEW
-- ============================================================================
CREATE OR REPLACE VIEW top_merchants AS
SELECT
    t.user_id,
    t.title as merchant_name,
    c.name as category_name,
    c.emoji as category_icon,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_spent,
    AVG(t.amount) as average_transaction,
    MIN(t.date) as first_transaction,
    MAX(t.date) as last_transaction
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.type = 'expense'
    AND t.title IS NOT NULL
    AND t.title != ''
GROUP BY t.user_id, t.title, c.name, c.emoji;

-- Grant access
GRANT SELECT ON top_merchants TO authenticated;

-- ============================================================================
-- INCOME SOURCES VIEW
-- ============================================================================
CREATE OR REPLACE VIEW income_sources AS
SELECT
    t.user_id,
    c.id as category_id,
    c.name as category_name,
    c.emoji as category_icon,
    c.color as category_color,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_income,
    AVG(t.amount) as average_income,
    MIN(t.date) as first_income_date,
    MAX(t.date) as last_income_date
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.type = 'income'
GROUP BY t.user_id, c.id, c.name, c.emoji, c.color;

-- Grant access
GRANT SELECT ON income_sources TO authenticated;

-- ============================================================================
-- DEBT PAYOFF PROJECTION VIEW
-- ============================================================================
CREATE OR REPLACE VIEW debt_payoff_projection AS
SELECT
    d.user_id,
    d.id as debt_id,
    d.name as debt_name,
    d.current_balance,
    d.minimum_payment,
    d.interest_rate,
    CASE
        WHEN d.minimum_payment > 0 AND d.interest_rate > 0
        THEN CEIL(
            (LN(d.minimum_payment) - LN(d.minimum_payment - (d.current_balance * (d.interest_rate / 100 / 12))))
            / LN(1 + (d.interest_rate / 100 / 12))
        )
        WHEN d.minimum_payment > 0
        THEN CEIL(d.current_balance::DECIMAL / d.minimum_payment)
        ELSE NULL
    END as months_to_payoff,
    CASE
        WHEN d.minimum_payment > 0
        THEN (d.minimum_payment * CEIL(
            CASE
                WHEN d.interest_rate > 0
                THEN (LN(d.minimum_payment) - LN(d.minimum_payment - (d.current_balance * (d.interest_rate / 100 / 12))))
                    / LN(1 + (d.interest_rate / 100 / 12))
                ELSE d.current_balance::DECIMAL / d.minimum_payment
            END
        )) - d.current_balance
        ELSE 0
    END as total_interest_to_pay
FROM debts d
WHERE d.is_active = TRUE
    AND d.current_balance > 0;

-- Grant access
GRANT SELECT ON debt_payoff_projection TO authenticated;

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get spending trend for a specific period
CREATE OR REPLACE FUNCTION get_spending_trend(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_interval TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
    period TIMESTAMP,
    income BIGINT,
    expenses BIGINT,
    net BIGINT,
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC(p_interval, t.date::TIMESTAMP) as period,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::BIGINT as income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)::BIGINT as expenses,
        (SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) -
         SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END))::BIGINT as net,
        COUNT(*)::BIGINT as transaction_count
    FROM transactions t
    WHERE t.user_id = p_user_id
        AND t.date >= p_start_date
        AND t.date <= p_end_date
        AND t.type IN ('income', 'expense')
    GROUP BY DATE_TRUNC(p_interval, t.date::TIMESTAMP)
    ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- Function to get category breakdown for a period
CREATE OR REPLACE FUNCTION get_category_breakdown(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_type TEXT DEFAULT 'expense' -- 'income' or 'expense'
)
RETURNS TABLE (
    category_id UUID,
    category_name TEXT,
    category_icon TEXT,
    category_color TEXT,
    total_amount BIGINT,
    transaction_count BIGINT,
    percentage DECIMAL(5,2)
) AS $$
DECLARE
    total_sum BIGINT;
BEGIN
    -- Get total for percentage calculation
    SELECT SUM(t.amount) INTO total_sum
    FROM transactions t
    WHERE t.user_id = p_user_id
        AND t.date >= p_start_date
        AND t.date <= p_end_date
        AND t.type = p_type;

    IF total_sum IS NULL OR total_sum = 0 THEN
        total_sum := 1; -- Avoid division by zero
    END IF;

    RETURN QUERY
    SELECT
        c.id as category_id,
        c.name as category_name,
        c.emoji as category_icon,
        c.color as category_color,
        SUM(t.amount)::BIGINT as total_amount,
        COUNT(t.id)::BIGINT as transaction_count,
        (SUM(t.amount)::DECIMAL / total_sum * 100)::DECIMAL(5,2) as percentage
    FROM transactions t
    INNER JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = p_user_id
        AND t.date >= p_start_date
        AND t.date <= p_end_date
        AND t.type = p_type
    GROUP BY c.id, c.name, c.emoji, c.color
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate savings rate
CREATE OR REPLACE FUNCTION calculate_savings_rate(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_income BIGINT,
    total_expenses BIGINT,
    total_saved BIGINT,
    savings_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::BIGINT as total_income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)::BIGINT as total_expenses,
        (SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) -
         SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END))::BIGINT as total_saved,
        CASE
            WHEN SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) > 0
            THEN ((SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) -
                   SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END))::DECIMAL /
                  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) * 100)::DECIMAL(5,2)
            ELSE 0
        END as savings_rate
    FROM transactions t
    WHERE t.user_id = p_user_id
        AND t.date >= p_start_date
        AND t.date <= p_end_date
        AND t.type IN ('income', 'expense');
END;
$$ LANGUAGE plpgsql;
