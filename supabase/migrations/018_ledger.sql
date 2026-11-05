-- Ledger features (Phase 4 of ENHANCEMENT_PLAN.md): split transactions, cleared and
-- reconciled status, faster tag filters and saved filters.

-- ---------------------------------------------------------------------------
-- Split transactions
-- ---------------------------------------------------------------------------

-- A split transaction keeps its parts in `splits`: [{category_id, subcategory_id, amount,
-- notes}], amounts in cents adding up to the transaction's amount. The transaction stays
-- one row, so balances and totals don't change; only spending by category reads the
-- parts, through transaction_lines.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS splits jsonb;

CREATE OR REPLACE FUNCTION public.splits_total(p_splits jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(sum((s->>'amount')::bigint), 0) FROM jsonb_array_elements(p_splits) s;
$$;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_splits_valid;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_splits_valid CHECK (
    splits IS NULL
    OR (jsonb_typeof(splits) = 'array' AND jsonb_array_length(splits) >= 2
        AND public.splits_total(splits) = amount)
);

-- One row per category line: each part of a split transaction, or the transaction itself.
CREATE OR REPLACE VIEW public.transaction_lines WITH (security_invoker = true) AS
SELECT t.id AS transaction_id,
       t.user_id,
       t.account_id,
       t.type,
       t.date,
       t.title,
       t.tags,
       t.exclude_from_budget,
       t.is_deleted,
       CASE WHEN s.part IS NULL THEN t.category_id ELSE (s.part->>'category_id')::uuid END AS category_id,
       CASE WHEN s.part IS NULL THEN t.subcategory_id ELSE (s.part->>'subcategory_id')::uuid END AS subcategory_id,
       CASE WHEN s.part IS NULL THEN t.amount ELSE (s.part->>'amount')::bigint END AS amount
  FROM public.transactions t
  LEFT JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(t.splits) = 'array' THEN t.splits END) AS s(part) ON true;

REVOKE ALL ON public.transaction_lines FROM anon;
GRANT SELECT ON public.transaction_lines TO authenticated, service_role;

-- The category reports now count split parts, and no longer count deleted transactions,
-- which they did before.
CREATE OR REPLACE VIEW public.spending_by_category WITH (security_invoker = true) AS
SELECT t.user_id,
       c.id AS category_id,
       c.name AS category_name,
       c.emoji AS category_icon,
       c.color AS category_color,
       c.type AS transaction_type,
       COUNT(DISTINCT t.transaction_id) AS transaction_count,
       SUM(t.amount) AS total_amount,
       AVG(t.amount) AS average_amount,
       MIN(t.date) AS first_transaction_date,
       MAX(t.date) AS last_transaction_date
  FROM public.transaction_lines t
  JOIN public.categories c ON t.category_id = c.id
 WHERE t.type IN ('income', 'expense') AND NOT COALESCE(t.is_deleted, false)
 GROUP BY t.user_id, c.id, c.name, c.emoji, c.color, c.type;

CREATE OR REPLACE VIEW public.budget_performance WITH (security_invoker = true) AS
WITH spent AS (
    SELECT b.id AS budget_id,
           COALESCE((SELECT SUM(t.amount) FROM public.transaction_lines t
                      WHERE t.category_id = b.category_id AND t.user_id = b.user_id AND t.type = 'expense'
                        AND NOT COALESCE(t.is_deleted, false)
                        AND t.date >= b.start_date AND t.date <= b.end_date), 0) AS amount
      FROM public.budgets b
)
SELECT b.user_id,
       b.id AS budget_id,
       b.name AS budget_name,
       b.category_id,
       c.name AS category_name,
       c.emoji AS category_icon,
       c.color AS category_color,
       b.amount AS budget_amount,
       b.period,
       b.start_date,
       b.end_date,
       spent.amount AS spent_amount,
       b.amount - spent.amount AS remaining_amount,
       CASE WHEN b.amount > 0 THEN (spent.amount::DECIMAL / b.amount * 100) ELSE 0 END AS usage_percentage
  FROM public.budgets b
  JOIN public.categories c ON b.category_id = c.id
  JOIN spent ON spent.budget_id = b.id
 WHERE b.is_active = TRUE;

CREATE OR REPLACE VIEW public.top_merchants WITH (security_invoker = true) AS
SELECT t.user_id,
       t.title AS merchant_name,
       c.name AS category_name,
       c.emoji AS category_icon,
       COUNT(DISTINCT t.transaction_id) AS transaction_count,
       SUM(t.amount) AS total_spent,
       AVG(t.amount) AS average_transaction,
       MIN(t.date) AS first_transaction,
       MAX(t.date) AS last_transaction
  FROM public.transaction_lines t
  JOIN public.categories c ON t.category_id = c.id
 WHERE t.type = 'expense' AND NOT COALESCE(t.is_deleted, false)
   AND t.title IS NOT NULL AND t.title != ''
 GROUP BY t.user_id, t.title, c.name, c.emoji;

CREATE OR REPLACE VIEW public.income_sources WITH (security_invoker = true) AS
SELECT t.user_id,
       c.id AS category_id,
       c.name AS category_name,
       c.emoji AS category_icon,
       c.color AS category_color,
       COUNT(DISTINCT t.transaction_id) AS transaction_count,
       SUM(t.amount) AS total_income,
       AVG(t.amount) AS average_income,
       MIN(t.date) AS first_income_date,
       MAX(t.date) AS last_income_date
  FROM public.transaction_lines t
  JOIN public.categories c ON t.category_id = c.id
 WHERE t.type = 'income' AND NOT COALESCE(t.is_deleted, false)
 GROUP BY t.user_id, c.id, c.name, c.emoji, c.color;

CREATE OR REPLACE FUNCTION public.get_category_breakdown(
    p_user_id uuid, p_start_date date, p_end_date date, p_type text DEFAULT 'expense')
RETURNS TABLE (category_id uuid, category_name text, category_icon text, category_color text,
               total_amount bigint, transaction_count bigint, percentage decimal(5,2))
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    total_sum bigint;
BEGIN
    SELECT SUM(t.amount) INTO total_sum
      FROM public.transaction_lines t
     WHERE t.user_id = p_user_id AND t.date >= p_start_date AND t.date <= p_end_date
       AND t.type = p_type AND NOT COALESCE(t.is_deleted, false);
    IF total_sum IS NULL OR total_sum = 0 THEN
        total_sum := 1;
    END IF;

    RETURN QUERY
    SELECT c.id, c.name, c.emoji, c.color,
           SUM(t.amount)::bigint AS total_amount,
           COUNT(DISTINCT t.transaction_id)::bigint,
           (SUM(t.amount)::decimal / total_sum * 100)::decimal(5,2)
      FROM public.transaction_lines t
      JOIN public.categories c ON t.category_id = c.id
     WHERE t.user_id = p_user_id AND t.date >= p_start_date AND t.date <= p_end_date
       AND t.type = p_type AND NOT COALESCE(t.is_deleted, false)
     GROUP BY c.id, c.name, c.emoji, c.color
     ORDER BY total_amount DESC;
END;
$$;

-- The budget month counts split parts too.
CREATE OR REPLACE FUNCTION public.budget_month(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    me uuid := auth.uid();
    payday int;
    target date;
    c date;
    e date;
    first_activity date;
    carry jsonb := '{}';
    pool bigint := 0;
    income bigint;
    assigned_total bigint;
    cats jsonb;
    overspent_prev bigint := 0;
    r record;
    guard int := 0;
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not signed in';
    END IF;

    SELECT COALESCE(payday_date, 25) INTO payday FROM public.user_profiles WHERE id = me;
    payday := COALESCE(payday, 25);
    target := public.payday_cycle_start(payday, p_date);

    SELECT LEAST(
               (SELECT min(date) FROM public.transactions WHERE user_id = me AND NOT COALESCE(is_deleted, false)),
               (SELECT min(cycle_start) FROM public.budget_allocations WHERE user_id = me))
      INTO first_activity;
    c := public.payday_cycle_start(payday, LEAST(COALESCE(first_activity, target), target));

    LOOP
        e := public.payday_cycle_next(payday, c) - 1;

        SELECT COALESCE(sum(amount), 0) INTO income
          FROM public.transactions
         WHERE user_id = me AND type = 'income' AND NOT COALESCE(is_deleted, false)
           AND NOT COALESCE(exclude_from_budget, false) AND date BETWEEN c AND e;

        WITH spent AS (
                 SELECT category_id, sum(amount) AS s
                   FROM public.transaction_lines
                  WHERE user_id = me AND type = 'expense' AND category_id IS NOT NULL
                    AND NOT COALESCE(is_deleted, false) AND NOT COALESCE(exclude_from_budget, false)
                    AND date BETWEEN c AND e
                  GROUP BY category_id),
             alloc AS (
                 SELECT category_id, amount AS a FROM public.budget_allocations WHERE user_id = me AND cycle_start = c),
             carried AS (
                 SELECT key::uuid AS category_id, value::bigint AS cv FROM jsonb_each_text(carry)),
             ids AS (
                 SELECT category_id FROM spent UNION SELECT category_id FROM alloc UNION SELECT category_id FROM carried),
             cat_rows AS (
                 SELECT ids.category_id,
                        COALESCE(alloc.a, 0) AS assigned,
                        COALESCE(spent.s, 0) AS spent,
                        COALESCE(carried.cv, 0) AS carried,
                        COALESCE(carried.cv, 0) + COALESCE(alloc.a, 0) - COALESCE(spent.s, 0) AS available,
                        COALESCE((SELECT bool_or(b.rollover_unused) FROM public.budgets b
                                   WHERE b.user_id = me AND b.category_id = ids.category_id
                                     AND COALESCE(b.is_active, true)), false) AS rollover
                   FROM ids
                   LEFT JOIN spent USING (category_id)
                   LEFT JOIN alloc USING (category_id)
                   LEFT JOIN carried USING (category_id))
        SELECT COALESCE(jsonb_agg(to_jsonb(cat_rows)), '[]'::jsonb), COALESCE(sum(assigned), 0)
          INTO cats, assigned_total
          FROM cat_rows;

        pool := pool + income - assigned_total;

        IF c >= target OR guard > 600 THEN
            RETURN jsonb_build_object(
                'cycle_start', c,
                'cycle_end', e,
                'payday', payday,
                'income', income,
                'assigned', assigned_total,
                'to_budget', pool,
                'overspent_last_cycle', overspent_prev,
                'categories', cats);
        END IF;

        carry := '{}';
        overspent_prev := 0;
        FOR r IN SELECT * FROM jsonb_to_recordset(cats) AS x(category_id uuid, available bigint, rollover boolean) LOOP
            IF r.available < 0 THEN
                pool := pool + r.available;
                overspent_prev := overspent_prev - r.available;
            ELSIF r.rollover THEN
                IF r.available <> 0 THEN
                    carry := carry || jsonb_build_object(r.category_id::text, r.available);
                END IF;
            ELSE
                pool := pool + r.available;
            END IF;
        END LOOP;

        c := e + 1;
        guard := guard + 1;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.budget_month(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_month(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cleared and reconciled
-- ---------------------------------------------------------------------------

-- Cleared: the bank has shown it. Reconciled: locked in after matching a statement.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cleared boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;
-- Imported rows came from the bank, so they're cleared already.
UPDATE public.transactions SET cleared = true WHERE imported_id IS NOT NULL AND NOT cleared;

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_reconciled_balance bigint;

-- The account's balance counting only cleared transactions, in cents.
CREATE OR REPLACE FUNCTION public.cleared_balance(p_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT a.initial_balance + COALESCE(SUM(
               CASE
                   WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
                   WHEN t.account_id = a.id THEN -t.amount
                   ELSE t.amount
               END), 0)::bigint
      FROM public.accounts a
      LEFT JOIN public.transactions t
        ON (t.account_id = a.id OR (t.type = 'transfer' AND t.transfer_account_id = a.id))
       AND t.user_id = a.user_id AND t.cleared AND NOT COALESCE(t.is_deleted, false)
     WHERE a.id = p_account_id
     GROUP BY a.id, a.initial_balance;
$$;

-- Locks in cleared transactions once their total matches the statement. Fails if it
-- doesn't, so nothing is half reconciled. Returns how many transactions were locked.
CREATE OR REPLACE FUNCTION public.reconcile_account(p_account_id uuid, p_statement_balance bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_cleared bigint := public.cleared_balance(p_account_id);
    locked int;
BEGIN
    IF v_cleared IS NULL THEN
        RAISE EXCEPTION 'Account not found';
    END IF;
    IF v_cleared <> p_statement_balance THEN
        RAISE EXCEPTION 'Cleared transactions come to %, not the statement''s %', v_cleared, p_statement_balance;
    END IF;

    UPDATE public.transactions
       SET reconciled = true
     WHERE (account_id = p_account_id OR transfer_account_id = p_account_id)
       AND cleared AND NOT reconciled AND NOT COALESCE(is_deleted, false);
    GET DIAGNOSTICS locked = ROW_COUNT;

    UPDATE public.accounts
       SET last_reconciled_at = now(), last_reconciled_balance = p_statement_balance
     WHERE id = p_account_id;
    RETURN locked;
END;
$$;

REVOKE ALL ON FUNCTION public.cleared_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reconcile_account(uuid, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.splits_total(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleared_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_account(uuid, bigint) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tags and saved filters
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_tags ON public.transactions USING gin (tags);

-- Named transaction filters, saved per user.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS saved_filters jsonb NOT NULL DEFAULT '[]';
