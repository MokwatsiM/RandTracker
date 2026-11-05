-- Reports and the configurable dashboard (Phase 5 of ENHANCEMENT_PLAN.md). Each report is
-- worked out here, for the signed-in user only, so the app doesn't add up history itself.

-- Money in and out per calendar month or payday cycle, with the running total. Transfers
-- between accounts are left out, since they don't change what the user has.
CREATE OR REPLACE FUNCTION public.report_cash_flow(p_from date, p_to date, p_by text DEFAULT 'month')
RETURNS TABLE (period_start date, income bigint, expenses bigint, net bigint, cumulative bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH me AS (
        SELECT auth.uid() AS id,
               COALESCE((SELECT payday_date FROM public.user_profiles WHERE id = auth.uid()), 25) AS payday
    ),
    periods AS (
        SELECT DISTINCT
               CASE WHEN p_by = 'cycle' THEN public.payday_cycle_start(me.payday, d::date)
                    ELSE date_trunc('month', d)::date END AS period_start
          FROM me, generate_series(p_from, p_to, interval '1 day') d
    ),
    totals AS (
        SELECT CASE WHEN p_by = 'cycle' THEN public.payday_cycle_start(me.payday, t.date)
                    ELSE date_trunc('month', t.date)::date END AS period_start,
               sum(t.amount) FILTER (WHERE t.type = 'income') AS income,
               sum(t.amount) FILTER (WHERE t.type = 'expense') AS expenses
          FROM public.transactions t, me
         WHERE t.user_id = me.id AND NOT COALESCE(t.is_deleted, false)
           AND t.type IN ('income', 'expense') AND t.date BETWEEN p_from AND p_to
         GROUP BY 1
    )
    SELECT p.period_start,
           COALESCE(t.income, 0)::bigint,
           COALESCE(t.expenses, 0)::bigint,
           (COALESCE(t.income, 0) - COALESCE(t.expenses, 0))::bigint,
           sum(COALESCE(t.income, 0) - COALESCE(t.expenses, 0)) OVER (ORDER BY p.period_start)::bigint
      FROM periods p
      LEFT JOIN totals t USING (period_start)
     ORDER BY p.period_start;
$$;

-- Assets, debts and net worth at the end of each of the last p_months months (today for
-- the current month), from account balances. Card, loan and store card balances are debts.
CREATE OR REPLACE FUNCTION public.report_net_worth(p_months integer DEFAULT 12)
RETURNS TABLE (month_end date, assets bigint, liabilities bigint, net_worth bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH today AS (SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date AS d),
    months AS (
        SELECT LEAST((date_trunc('month', today.d) - make_interval(months => k) + interval '1 month' - interval '1 day')::date, today.d) AS month_end
          FROM today, generate_series(0, GREATEST(p_months, 1) - 1) k
    ),
    balances AS (
        SELECT m.month_end, a.type,
               a.initial_balance + COALESCE((
                   SELECT sum(CASE
                                  WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
                                  WHEN t.account_id = a.id THEN -t.amount
                                  ELSE t.amount
                              END)
                     FROM public.transactions t
                    WHERE (t.account_id = a.id OR (t.type = 'transfer' AND t.transfer_account_id = a.id))
                      AND t.user_id = a.user_id AND NOT COALESCE(t.is_deleted, false)
                      AND t.date <= m.month_end), 0) AS balance
          FROM months m
          JOIN public.accounts a ON a.user_id = auth.uid() AND NOT COALESCE(a.is_archived, false)
    )
    SELECT m.month_end,
           COALESCE(sum(b.balance) FILTER (WHERE b.type NOT IN ('credit_card', 'loan', 'store_card')), 0)::bigint,
           COALESCE(-sum(b.balance) FILTER (WHERE b.type IN ('credit_card', 'loan', 'store_card')), 0)::bigint,
           COALESCE(sum(b.balance), 0)::bigint
      FROM months m
      LEFT JOIN balances b USING (month_end)
     GROUP BY m.month_end
     ORDER BY m.month_end;
$$;

-- Spending per category this payday cycle, last cycle, and the average of the three
-- cycles before this one. Split transactions count each part in its own category.
CREATE OR REPLACE FUNCTION public.report_spending_compared(p_date date)
RETURNS TABLE (category_id uuid, this_cycle bigint, last_cycle bigint, average_3 bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH me AS (
        SELECT COALESCE((SELECT payday_date FROM public.user_profiles WHERE id = auth.uid()), 25) AS payday
    ),
    c AS (
        SELECT public.payday_cycle_start(me.payday, p_date) AS this_start FROM me
    ),
    bounds AS (
        SELECT c.this_start,
               public.payday_cycle_next(me.payday, c.this_start) AS next_start,
               public.payday_cycle_start(me.payday, c.this_start - 1) AS last_start,
               public.payday_cycle_start(me.payday,
                   public.payday_cycle_start(me.payday,
                       public.payday_cycle_start(me.payday, c.this_start - 1) - 1) - 1) AS three_back
          FROM c, me
    )
    SELECT l.category_id,
           COALESCE(sum(l.amount) FILTER (WHERE l.date >= b.this_start AND l.date < b.next_start), 0)::bigint,
           COALESCE(sum(l.amount) FILTER (WHERE l.date >= b.last_start AND l.date < b.this_start), 0)::bigint,
           (COALESCE(sum(l.amount) FILTER (WHERE l.date >= b.three_back AND l.date < b.this_start), 0) / 3)::bigint
      FROM public.transaction_lines l, bounds b
     WHERE l.user_id = auth.uid() AND l.type = 'expense' AND l.category_id IS NOT NULL
       AND NOT COALESCE(l.is_deleted, false) AND NOT COALESCE(l.exclude_from_budget, false)
       AND l.date >= b.three_back AND l.date < b.next_start
     GROUP BY l.category_id;
$$;

REVOKE ALL ON FUNCTION public.report_cash_flow(date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_net_worth(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_spending_compared(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_cash_flow(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_net_worth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_spending_compared(date) TO authenticated;

-- Which cards the dashboard shows, in order, and how wide. Null means the default layout.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dashboard_layout jsonb;
