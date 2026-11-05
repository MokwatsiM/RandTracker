-- Schedules: expected transactions such as debit orders, subscriptions and salaries
-- (Phase 2 of ENHANCEMENT_PLAN.md). They replace copying recurring transactions in the
-- browser. The date rules match src/lib/schedules/dates.ts.

-- ---------------------------------------------------------------------------
-- Dates
-- ---------------------------------------------------------------------------

-- South Africa's public holidays, including the Monday after one on a Sunday.
CREATE OR REPLACE FUNCTION public.za_public_holidays(p_year integer)
RETURNS SETOF date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    a int := p_year % 19;
    b int := p_year / 100;
    c int := p_year % 100;
    d int := b / 4;
    e int := b % 4;
    f int := (b + 8) / 25;
    g int := (b - f + 1) / 3;
    h int := (19 * a + b - d - g + 15) % 30;
    i int := c / 4;
    k int := c % 4;
    l int := (32 + 2 * e + 2 * i - h - k) % 7;
    m int := (a + 11 * h + 22 * l) / 451;
    easter date := make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
    fixed date[] := ARRAY[
        make_date(p_year, 1, 1), make_date(p_year, 3, 21), make_date(p_year, 4, 27), make_date(p_year, 5, 1),
        make_date(p_year, 6, 16), make_date(p_year, 8, 9), make_date(p_year, 9, 24), make_date(p_year, 12, 16),
        make_date(p_year, 12, 25), make_date(p_year, 12, 26)];
    all_days date[];
    day date;
    monday date;
BEGIN
    all_days := fixed || ARRAY[easter - 2, easter + 1];
    FOREACH day IN ARRAY fixed LOOP
        IF extract(dow FROM day) = 0 THEN
            monday := day + 1;
            WHILE monday = ANY (all_days) LOOP
                monday := monday + 1;
            END LOOP;
            all_days := all_days || monday;
        END IF;
    END LOOP;
    RETURN QUERY SELECT unnest(all_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_working_day(p_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT extract(dow FROM p_date) NOT IN (0, 6)
       AND p_date NOT IN (SELECT public.za_public_holidays(extract(year FROM p_date)::int));
$$;

CREATE OR REPLACE FUNCTION public.adjust_working_day(p_date date, p_rule text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    result date := p_date;
BEGIN
    IF p_date IS NULL OR p_rule = 'none' THEN
        RETURN p_date;
    END IF;
    WHILE NOT public.is_working_day(result) LOOP
        result := result + CASE WHEN p_rule = 'before' THEN -1 ELSE 1 END;
    END LOOP;
    RETURN result;
END;
$$;

-- Adds months to a start date, keeping its day where the month allows.
CREATE OR REPLACE FUNCTION public.schedule_add_months(p_start date, p_months integer, p_month_end boolean)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
    WITH target AS (
        SELECT (date_trunc('month', p_start) + make_interval(months => p_months))::date AS first_day
    )
    SELECT CASE
               WHEN p_month_end THEN (first_day + interval '1 month' - interval '1 day')::date
               ELSE first_day + (LEAST(extract(day FROM p_start)::int,
                                       extract(day FROM first_day + interval '1 month' - interval '1 day')::int) - 1)
           END
      FROM target;
$$;

-- The occurrence after p_current. Monthly and yearly ones are counted from the start date,
-- so the 31st returns to the 31st after February.
CREATE OR REPLACE FUNCTION public.schedule_next(
    p_frequency text, p_interval integer, p_start date, p_month_end boolean, p_current date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    step int := GREATEST(1, COALESCE(p_interval, 1));
    since int;
BEGIN
    CASE p_frequency
        WHEN 'once' THEN RETURN NULL;
        WHEN 'daily' THEN RETURN p_current + step;
        WHEN 'weekly' THEN RETURN p_current + 7 * step;
        WHEN 'monthly' THEN
            since := (extract(year FROM p_current) - extract(year FROM p_start))::int * 12
                   + (extract(month FROM p_current) - extract(month FROM p_start))::int;
            RETURN public.schedule_add_months(p_start, (floor(since::numeric / step)::int + 1) * step, p_month_end);
        WHEN 'yearly' THEN
            since := floor(((extract(year FROM p_current) - extract(year FROM p_start))::int * 12
                   + (extract(month FROM p_current) - extract(month FROM p_start))::int) / 12.0)::int;
            RETURN public.schedule_add_months(p_start, (floor(since::numeric / step)::int + 1) * step * 12, false);
        ELSE RETURN NULL;
    END CASE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    payee text,
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    transfer_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
    amount bigint NOT NULL CHECK (amount >= 0),
    amount_type text NOT NULL DEFAULT 'exact' CHECK (amount_type IN ('exact', 'approx', 'range')),
    amount_min bigint,
    amount_max bigint,
    frequency text NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'yearly')),
    "interval" integer NOT NULL DEFAULT 1 CHECK ("interval" >= 1),
    start_date date NOT NULL,
    month_end boolean NOT NULL DEFAULT false,
    -- The next occurrence not yet posted or skipped, before weekend adjustment; null when done.
    next_date date,
    end_date date,
    weekend text NOT NULL DEFAULT 'none' CHECK (weekend IN ('none', 'before', 'after')),
    auto_add boolean NOT NULL DEFAULT false,
    is_subscription boolean NOT NULL DEFAULT false,
    debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (type <> 'transfer' OR transfer_account_id IS NOT NULL),
    CHECK (amount_type <> 'range' OR (amount_min IS NOT NULL AND amount_max IS NOT NULL AND amount_min <= amount_max))
);

CREATE INDEX idx_schedules_user_id ON public.schedules (user_id);
CREATE INDEX idx_schedules_due ON public.schedules (next_date) WHERE is_active AND auto_add;

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Schedules post transactions, so they may only use the user's own accounts.
CREATE POLICY "Users can view own schedules" ON public.schedules
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own schedules" ON public.schedules
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
        AND (transfer_account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transfer_account_id AND a.user_id = auth.uid()))
    );
CREATE POLICY "Users can update own schedules" ON public.schedules
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
        AND (transfer_account_id IS NULL OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = transfer_account_id AND a.user_id = auth.uid()))
    );
CREATE POLICY "Users can delete own schedules" ON public.schedules
    FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.schedules FROM anon;

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Which occurrence a transaction is. One transaction per occurrence, including deleted
-- ones, so a posted debit order that was deleted isn't posted again.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS schedule_date date;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_schedule_occurrence ON public.transactions (schedule_id, schedule_date);

-- ---------------------------------------------------------------------------
-- Moving a schedule on
-- ---------------------------------------------------------------------------

-- A transaction linked to an occurrence (posted, approved or imported) moves the schedule
-- past it. Runs with the caller's rights, so nobody can move someone else's schedule.
CREATE OR REPLACE FUNCTION public.transactions_advance_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE public.schedules s
       SET next_date = public.schedule_next(s.frequency, s."interval", s.start_date, s.month_end, n.latest)
      FROM (SELECT schedule_id, max(schedule_date) AS latest
              FROM new_rows
             WHERE schedule_id IS NOT NULL AND schedule_date IS NOT NULL
             GROUP BY schedule_id) n
     WHERE s.id = n.schedule_id
       AND s.next_date IS NOT NULL
       AND s.next_date <= n.latest;
    RETURN NULL;
END;
$$;

CREATE TRIGGER transactions_advance_schedules_insert
    AFTER INSERT ON public.transactions
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION public.transactions_advance_schedules();

CREATE TRIGGER transactions_advance_schedules_update
    AFTER UPDATE ON public.transactions
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION public.transactions_advance_schedules();

-- Records the next occurrence as a transaction: used to approve a schedule that isn't
-- added automatically. The amount and date can differ from what was expected.
CREATE OR REPLACE FUNCTION public.record_schedule_occurrence(
    p_schedule_id uuid, p_amount bigint DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    s public.schedules;
    new_id uuid;
BEGIN
    SELECT * INTO s FROM public.schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule not found';
    END IF;
    IF s.next_date IS NULL THEN
        RAISE EXCEPTION 'This schedule has no occurrences left';
    END IF;

    INSERT INTO public.transactions (
        user_id, account_id, type, amount, category_id, subcategory_id, title, notes, date,
        transfer_account_id, is_debt_payment, debt_id, is_subscription, is_recurring, is_paid,
        exclude_from_budget, schedule_id, schedule_date)
    VALUES (
        s.user_id, s.account_id, s.type, COALESCE(p_amount, s.amount),
        CASE WHEN s.type = 'transfer' THEN NULL ELSE s.category_id END,
        CASE WHEN s.type = 'transfer' THEN NULL ELSE s.subcategory_id END,
        s.name, s.notes, COALESCE(p_date, public.adjust_working_day(s.next_date, s.weekend)),
        s.transfer_account_id, s.debt_id IS NOT NULL, s.debt_id, s.is_subscription, false, true,
        false, s.id, s.next_date)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.skip_schedule_occurrence(p_schedule_id uuid)
RETURNS date
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.schedules
       SET next_date = public.schedule_next(frequency, "interval", start_date, month_end, next_date)
     WHERE id = p_schedule_id AND next_date IS NOT NULL
    RETURNING next_date;
$$;

-- Posts every due occurrence of schedules set to add automatically. Called nightly by
-- pg_cron for everyone, and by the app for the signed-in user so new schedules don't wait
-- for the night. Returns how many transactions were added.
CREATE OR REPLACE FUNCTION public.post_due_schedules()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
    me uuid := auth.uid();
    s public.schedules;
    occurrence date;
    posted int := 0;
    added int;
    guard int;
BEGIN
    FOR s IN
        SELECT * FROM public.schedules
         WHERE is_active AND auto_add AND next_date IS NOT NULL
           AND (me IS NULL OR user_id = me)
           AND next_date <= today + 7  -- a weekend shift can't move a date more than a few days
         FOR UPDATE SKIP LOCKED
    LOOP
        occurrence := s.next_date;
        guard := 0;
        WHILE occurrence IS NOT NULL
              AND (s.end_date IS NULL OR occurrence <= s.end_date)
              AND public.adjust_working_day(occurrence, s.weekend) <= today
              AND guard < 400 LOOP
            INSERT INTO public.transactions (
                user_id, account_id, type, amount, category_id, subcategory_id, title, notes, date,
                transfer_account_id, is_debt_payment, debt_id, is_subscription, is_recurring, is_paid,
                exclude_from_budget, schedule_id, schedule_date)
            VALUES (
                s.user_id, s.account_id, s.type, s.amount,
                CASE WHEN s.type = 'transfer' THEN NULL ELSE s.category_id END,
                CASE WHEN s.type = 'transfer' THEN NULL ELSE s.subcategory_id END,
                s.name, s.notes, public.adjust_working_day(occurrence, s.weekend),
                s.transfer_account_id, s.debt_id IS NOT NULL, s.debt_id, s.is_subscription, false, true,
                false, s.id, occurrence)
            ON CONFLICT (schedule_id, schedule_date) DO NOTHING;
            GET DIAGNOSTICS added = ROW_COUNT;
            posted := posted + added;
            occurrence := public.schedule_next(s.frequency, s."interval", s.start_date, s.month_end, occurrence);
            guard := guard + 1;
        END LOOP;

        -- Also covers an occurrence that already existed, where the insert was skipped.
        UPDATE public.schedules SET next_date = occurrence WHERE id = s.id AND next_date IS DISTINCT FROM occurrence
           AND (next_date IS NULL OR occurrence IS NULL OR next_date < occurrence);
    END LOOP;
    RETURN posted;
END;
$$;

REVOKE ALL ON FUNCTION public.record_schedule_occurrence(uuid, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.skip_schedule_occurrence(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_due_schedules() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transactions_advance_schedules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_schedule_occurrence(uuid, bigint, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.skip_schedule_occurrence(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_due_schedules() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transactions_advance_schedules() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Existing recurring transactions become schedules
-- ---------------------------------------------------------------------------

-- The old code treated transactions with the same title, amount, category and account as
-- one series and copied the latest forward. Each series becomes an automatic schedule,
-- and its past transactions are linked to it.
DO $$
DECLARE
    series record;
    new_id uuid;
BEGIN
    FOR series IN
        SELECT t.user_id, t.account_id, t.title, t.amount, t.category_id, t.type,
               min(t.date) AS first_date, max(t.date) AS last_date,
               (array_agg(t.id ORDER BY t.date DESC, t.created_at DESC))[1] AS latest_id
          FROM public.transactions t
         WHERE t.is_recurring AND NOT COALESCE(t.is_deleted, false) AND t.schedule_id IS NULL
         GROUP BY t.user_id, t.account_id, t.title, t.amount, t.category_id, t.type
    LOOP
        INSERT INTO public.schedules (
            user_id, name, payee, account_id, type, transfer_account_id, category_id, subcategory_id,
            amount, amount_type, frequency, "interval", start_date, next_date, end_date, weekend,
            auto_add, is_subscription, debt_id, notes)
        SELECT t.user_id, t.title, t.title, t.account_id, t.type, t.transfer_account_id, t.category_id,
               t.subcategory_id, t.amount, 'exact', f.frequency, f.step, series.first_date,
               public.schedule_next(f.frequency, f.step, series.first_date, false, series.last_date),
               t.recurrence_end_date, 'none', true, COALESCE(t.is_subscription, false),
               CASE WHEN t.is_debt_payment THEN t.debt_id END, NULL
          FROM public.transactions t
          CROSS JOIN LATERAL (
              SELECT CASE t.recurrence_frequency
                         WHEN 'daily' THEN 'daily' WHEN 'weekly' THEN 'weekly' WHEN 'biweekly' THEN 'weekly'
                         WHEN 'yearly' THEN 'yearly' WHEN 'custom' THEN 'daily' ELSE 'monthly' END AS frequency,
                     CASE t.recurrence_frequency
                         WHEN 'biweekly' THEN 2 * GREATEST(1, COALESCE(t.recurrence_interval, 1))
                         WHEN 'quarterly' THEN 3 * GREATEST(1, COALESCE(t.recurrence_interval, 1))
                         ELSE GREATEST(1, COALESCE(t.recurrence_interval, 1)) END AS step
          ) f
         WHERE t.id = series.latest_id
           AND (t.type <> 'transfer' OR t.transfer_account_id IS NOT NULL)
        RETURNING id INTO new_id;

        IF new_id IS NOT NULL THEN
            -- Older duplicates on the same date (from two devices copying at once) stay unlinked.
            UPDATE public.transactions t
               SET schedule_id = new_id, schedule_date = t.date
              FROM (SELECT DISTINCT ON (date) id
                      FROM public.transactions
                     WHERE is_recurring AND NOT COALESCE(is_deleted, false) AND schedule_id IS NULL
                       AND user_id = series.user_id AND account_id = series.account_id
                       AND title = series.title AND amount = series.amount AND type = series.type
                       AND category_id IS NOT DISTINCT FROM series.category_id
                     ORDER BY date, created_at) one
             WHERE t.id = one.id;
        END IF;
        new_id := NULL;
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Nightly posting
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 00:15 in South Africa (22:15 UTC). Scheduling the same name again replaces the job.
SELECT cron.schedule('randtracker-post-due-schedules', '15 22 * * *', 'SELECT public.post_due_schedules()');
