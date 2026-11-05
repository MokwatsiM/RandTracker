-- Deleting a user deletes their schedules, which clears schedule_id on their transactions
-- as Supabase Auth's own database role. Migration 015's trigger then ran with that role,
-- which may not touch schedules, so deleting a user failed (as with migration 012).
--
-- The trigger now runs with the owner's rights. It only moves a schedule on for a
-- transaction belonging to the schedule's owner, so nobody can move someone else's
-- schedule by linking a transaction to it.
CREATE OR REPLACE FUNCTION public.transactions_advance_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.schedules s
       SET next_date = public.schedule_next(s.frequency, s."interval", s.start_date, s.month_end, n.latest)
      FROM (SELECT schedule_id, user_id, max(schedule_date) AS latest
              FROM new_rows
             WHERE schedule_id IS NOT NULL AND schedule_date IS NOT NULL
             GROUP BY schedule_id, user_id) n
     WHERE s.id = n.schedule_id
       AND s.user_id = n.user_id
       AND s.next_date IS NOT NULL
       AND s.next_date <= n.latest;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.transactions_advance_schedules() FROM PUBLIC, anon, authenticated;
