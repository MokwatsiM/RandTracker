-- The budget month (Phase 3 of ENHANCEMENT_PLAN.md): money is assigned to categories for
-- each payday cycle, unused money either carries over or goes back to be budgeted again,
-- and overspending comes out of the next cycle. Existing budgets keep working and become
-- the automation settings for their category.

-- ---------------------------------------------------------------------------
-- Payday cycles, matching src/lib/budget/cycles.ts
-- ---------------------------------------------------------------------------

-- Payday in the month p_months after p_date's month, moved to the working day before.
CREATE OR REPLACE FUNCTION public.payday_in_month(p_payday integer, p_date date, p_months integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    WITH m AS (SELECT (date_trunc('month', p_date) + make_interval(months => p_months))::date AS first_day)
    SELECT public.adjust_working_day(
               first_day + (LEAST(p_payday, extract(day FROM first_day + interval '1 month' - interval '1 day')::int) - 1),
               'before')
      FROM m;
$$;

CREATE OR REPLACE FUNCTION public.payday_cycle_start(p_payday integer, p_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT max(c) FROM (SELECT public.payday_in_month(p_payday, p_date, k) AS c FROM generate_series(-1, 2) k) s
     WHERE c <= p_date;
$$;

CREATE OR REPLACE FUNCTION public.payday_cycle_next(p_payday integer, p_start date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT min(c) FROM (SELECT public.payday_in_month(p_payday, p_start, k) AS c FROM generate_series(-1, 2) k) s
     WHERE c > p_start;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.budget_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    cycle_start date NOT NULL,
    amount bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, category_id, cycle_start)
);

ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own allocations" ON public.budget_allocations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own allocations" ON public.budget_allocations
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = auth.uid())
    );
CREATE POLICY "Users can update own allocations" ON public.budget_allocations
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.user_id = auth.uid())
    );
CREATE POLICY "Users can delete own allocations" ON public.budget_allocations
    FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.budget_allocations FROM anon;

CREATE TRIGGER update_budget_allocations_updated_at BEFORE UPDATE ON public.budget_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- How the category's amount is worked out each cycle; read by src/lib/budget/automations.ts.
-- Null means a fixed amount: the budget's amount converted to a monthly cycle.
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS template jsonb;

-- ---------------------------------------------------------------------------
-- A cycle's figures
-- ---------------------------------------------------------------------------

-- Works through every cycle from the user's first transaction or allocation to the one
-- asked for, so carry-over and overspending are right. Per category:
--   available = carried + assigned - spent
-- At the end of a cycle, overspending comes out of the next cycle's money to budget;
-- unused money carries over when the category's budget has rollover on, and otherwise
-- goes back to be budgeted again. Money to budget = what's left after assigning.
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
                   FROM public.transactions
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
