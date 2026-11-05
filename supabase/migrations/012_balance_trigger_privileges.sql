-- Migration 010's trigger ran with the rights of whoever changed the transactions. When
-- a user is deleted, Supabase Auth removes their transactions as its own database role,
-- which may not run the balance functions, so deleting a user failed.
--
-- The trigger now runs with the owner's rights. Row level security no longer limits
-- what it reads, so the balance functions only count transactions that belong to the
-- account's or debt's owner. That keeps another user's transfer from counting.

CREATE OR REPLACE FUNCTION public.account_balance(p_account_id uuid, p_initial_balance bigint)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT p_initial_balance + COALESCE(SUM(
               CASE
                   WHEN t.account_id = p_account_id AND t.type = 'income' THEN t.amount
                   WHEN t.account_id = p_account_id THEN -t.amount
                   ELSE t.amount
               END
           ), 0)::bigint
      FROM public.transactions t
     WHERE (t.account_id = p_account_id OR (t.type = 'transfer' AND t.transfer_account_id = p_account_id))
       AND t.user_id = (SELECT a.user_id FROM public.accounts a WHERE a.id = p_account_id)
       AND NOT COALESCE(t.is_deleted, FALSE)
       AND t.date <= (now() AT TIME ZONE 'Africa/Johannesburg')::date;
$$;

CREATE OR REPLACE FUNCTION public.recalc_debt_balances(p_debt_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    WITH calc AS (
        SELECT d.id,
               GREATEST(0, d.total_amount - COALESCE(SUM(COALESCE(t.principal_portion, t.amount)), 0)) AS balance
        FROM public.debts d
        LEFT JOIN public.transactions t
          ON t.debt_id = d.id
         AND t.user_id = d.user_id
         AND t.is_debt_payment
         AND t.type = 'expense'
         AND COALESCE(t.is_paid, TRUE)
         AND NOT COALESCE(t.is_deleted, FALSE)
         AND t.date <= (now() AT TIME ZONE 'Africa/Johannesburg')::date
        WHERE d.id = ANY (p_debt_ids)
        GROUP BY d.id, d.total_amount
    )
    UPDATE public.debts d
       SET current_balance = calc.balance
      FROM calc
     WHERE d.id = calc.id
       AND d.current_balance IS DISTINCT FROM calc.balance;
$$;

-- Debts only count when the transaction's owner also owns the debt, so nobody can reset
-- someone else's typed-in debt balance by pointing a transaction at it.
CREATE OR REPLACE FUNCTION public.transactions_refresh_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accounts uuid[];
    v_debts uuid[];
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT array_agg(DISTINCT x) INTO v_accounts
          FROM (SELECT account_id FROM new_rows UNION SELECT transfer_account_id FROM new_rows) s(x) WHERE x IS NOT NULL;
        SELECT array_agg(DISTINCT d.id) INTO v_debts
          FROM new_rows r JOIN public.debts d ON d.id = r.debt_id AND d.user_id = r.user_id;
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT array_agg(DISTINCT x) INTO v_accounts
          FROM (SELECT unnest(v_accounts) UNION SELECT account_id FROM old_rows UNION SELECT transfer_account_id FROM old_rows) s(x)
         WHERE x IS NOT NULL;
        SELECT array_agg(DISTINCT x) INTO v_debts
          FROM (SELECT unnest(v_debts)
                UNION SELECT d.id FROM old_rows r JOIN public.debts d ON d.id = r.debt_id AND d.user_id = r.user_id) s(x)
         WHERE x IS NOT NULL;
    END IF;

    IF v_accounts IS NOT NULL THEN
        PERFORM public.recalc_account_balances(v_accounts);
    END IF;
    IF v_debts IS NOT NULL THEN
        PERFORM public.recalc_debt_balances(v_debts);
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.transactions_refresh_balances() FROM PUBLIC, anon, authenticated;
