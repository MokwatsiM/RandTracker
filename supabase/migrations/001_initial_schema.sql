-- RandTracker Supabase Database Schema
-- This migration creates all tables with Row Level Security (RLS) enabled

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    currency TEXT DEFAULT 'ZAR',
    timezone TEXT DEFAULT 'Africa/Johannesburg',
    payday_date INTEGER CHECK (payday_date >= 1 AND payday_date <= 31),
    monthly_income INTEGER DEFAULT 0, -- In cents
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cheque', 'savings', 'cash', 'credit_card', 'loan', 'store_card', 'investment')),
    currency TEXT DEFAULT 'ZAR',
    initial_balance BIGINT NOT NULL DEFAULT 0, -- In cents
    current_balance BIGINT NOT NULL DEFAULT 0, -- In cents
    icon TEXT DEFAULT '💳',
    color TEXT DEFAULT '#6366f1',
    group_name TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    -- Credit card specific
    credit_limit BIGINT,
    statement_day INTEGER CHECK (statement_day >= 1 AND statement_day <= 31),
    payment_due_day INTEGER CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
    interest_rate DECIMAL(5,2),
    minimum_payment_percentage DECIMAL(5,2),

    -- Loan specific
    loan_principal BIGINT,
    loan_interest_rate DECIMAL(5,2),
    loan_term_months INTEGER,
    monthly_instalment BIGINT,
    loan_start_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own accounts"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
    ON accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_is_primary ON accounts(is_primary) WHERE is_primary = TRUE;

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    emoji TEXT,
    color TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own and default categories"
    ON categories FOR SELECT
    USING (auth.uid() = user_id OR is_default = TRUE);

CREATE POLICY "Users can create own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);

-- ============================================================================
-- SUBCATEGORIES TABLE
-- ============================================================================
CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view subcategories of their categories"
    ON subcategories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM categories
            WHERE categories.id = subcategories.category_id
            AND (categories.user_id = auth.uid() OR categories.is_default = TRUE)
        )
    );

CREATE POLICY "Users can manage subcategories of their categories"
    ON subcategories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM categories
            WHERE categories.id = subcategories.category_id
            AND categories.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount BIGINT NOT NULL, -- In cents, always positive
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    date DATE NOT NULL,
    time TIME,

    -- Recurring
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    recurrence_interval INTEGER,
    recurrence_end_date DATE,
    recurrence_day_of_month INTEGER,
    is_subscription BOOLEAN DEFAULT FALSE,

    -- Transfer specific
    transfer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

    -- Debt specific
    is_debt_payment BOOLEAN DEFAULT FALSE,
    debt_id UUID,
    principal_portion BIGINT,
    interest_portion BIGINT,

    -- Metadata
    attachment_url TEXT,
    tags TEXT[],
    is_paid BOOLEAN DEFAULT TRUE,
    exclude_from_budget BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_recurring ON transactions(is_recurring) WHERE is_recurring = TRUE;

-- ============================================================================
-- BUDGETS TABLE
-- ============================================================================
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL, -- In cents
    period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly', 'custom')),
    start_date DATE NOT NULL,
    end_date DATE,
    rollover_unused BOOLEAN DEFAULT FALSE,
    alert_threshold INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own budgets"
    ON budgets FOR ALL
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
CREATE INDEX idx_budgets_period ON budgets(period);

-- ============================================================================
-- DEBTS TABLE (For debt management)
-- ============================================================================
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    total_amount BIGINT NOT NULL, -- In cents
    current_balance BIGINT NOT NULL,
    interest_rate DECIMAL(5,2),
    minimum_payment BIGINT,
    payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31),
    payoff_strategy TEXT CHECK (payoff_strategy IN ('snowball', 'avalanche', 'custom')),
    priority_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own debts"
    ON debts FOR ALL
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_account_id ON debts(account_id);

-- ============================================================================
-- GOALS TABLE (Savings goals)
-- ============================================================================
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    target_amount BIGINT NOT NULL, -- In cents
    current_amount BIGINT DEFAULT 0,
    target_date DATE,
    icon TEXT DEFAULT '🎯',
    color TEXT DEFAULT '#10b981',
    is_achieved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own goals"
    ON goals FOR ALL
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_account_id ON goals(account_id);

-- ============================================================================
-- SYNC QUEUE TABLE (For offline sync)
-- ============================================================================
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own sync queue"
    ON sync_queue FOR ALL
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX idx_sync_queue_synced ON sync_queue(synced_at) WHERE synced_at IS NULL;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- DEFAULT CATEGORIES (South African context)
-- ============================================================================

-- Insert default expense categories
INSERT INTO categories (id, user_id, name, type, emoji, is_default, sort_order) VALUES
    (uuid_generate_v4(), NULL, 'Groceries & Food', 'expense', '🛒', TRUE, 1),
    (uuid_generate_v4(), NULL, 'Transport & Petrol', 'expense', '🚗', TRUE, 2),
    (uuid_generate_v4(), NULL, 'Airtime & Data', 'expense', '📱', TRUE, 3),
    (uuid_generate_v4(), NULL, 'Electricity & Utilities', 'expense', '💡', TRUE, 4),
    (uuid_generate_v4(), NULL, 'Medical Aid & Health', 'expense', '🏥', TRUE, 5),
    (uuid_generate_v4(), NULL, 'Insurance', 'expense', '🛡️', TRUE, 6),
    (uuid_generate_v4(), NULL, 'Rent & Bond', 'expense', '🏠', TRUE, 7),
    (uuid_generate_v4(), NULL, 'Entertainment', 'expense', '🎬', TRUE, 8),
    (uuid_generate_v4(), NULL, 'Clothing & Personal', 'expense', '👔', TRUE, 9),
    (uuid_generate_v4(), NULL, 'Education & School', 'expense', '📚', TRUE, 10),
    (uuid_generate_v4(), NULL, 'Restaurants & Takeaways', 'expense', '🍕', TRUE, 11),
    (uuid_generate_v4(), NULL, 'Subscriptions (DSTV, Netflix)', 'expense', '📺', TRUE, 12),
    (uuid_generate_v4(), NULL, 'Donations & Gifts', 'expense', '🎁', TRUE, 13),
    (uuid_generate_v4(), NULL, 'Savings & Investments', 'expense', '💰', TRUE, 14),
    (uuid_generate_v4(), NULL, 'Debt Payments', 'expense', '💳', TRUE, 15),
    (uuid_generate_v4(), NULL, 'Other Expenses', 'expense', '📦', TRUE, 16);

-- Insert default income categories
INSERT INTO categories (id, user_id, name, type, emoji, is_default, sort_order) VALUES
    (uuid_generate_v4(), NULL, 'Salary', 'income', '💵', TRUE, 1),
    (uuid_generate_v4(), NULL, 'Freelance Work', 'income', '💼', TRUE, 2),
    (uuid_generate_v4(), NULL, 'Business Income', 'income', '🏢', TRUE, 3),
    (uuid_generate_v4(), NULL, 'Investment Returns', 'income', '📈', TRUE, 4),
    (uuid_generate_v4(), NULL, 'Rental Income', 'income', '🏘️', TRUE, 5),
    (uuid_generate_v4(), NULL, 'Other Income', 'income', '💸', TRUE, 6);
