-- Account and debt balances were recalculated in the browser after every change, by
-- downloading every transaction twice. That got slower with every transaction, and
-- silently wrong past the API's 1,000-row limit. The database now keeps them up to date.
--
-- The rules match the old browser code:
--   account: initial balance, plus income, minus expenses and outgoing transfers,
--            plus incoming transfers; only rows dated today or earlier and not deleted.
--   debt:    total amount minus principal paid (principal_portion, else the amount) by
--            paid expense transactions marked as debt payments, never below zero.
-- "Today" is South African time, so a transaction dated today counts from midnight SAST.
--
-- The functions run with the caller's rights, so row level security limits them to the
-- caller's own rows. Counting another user's transfer is impossible for the same reason.

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_account_id
    ON public.transactions (transfer_account_id) WHERE transfer_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id
    ON public.transactions (debt_id) WHERE debt_id IS NOT NULL;

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
       AND NOT COALESCE(t.is_deleted, FALSE)
       AND t.date <= (now() AT TIME ZONE 'Africa/Johannesburg')::date;
$$;

CREATE OR REPLACE FUNCTION public.recalc_account_balances(p_account_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.accounts a
       SET current_balance = public.account_balance(a.id, a.initial_balance)
     WHERE a.id = ANY (p_account_ids)
       AND a.current_balance IS DISTINCT FROM public.account_balance(a.id, a.initial_balance);
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

-- Statement-level, so a bulk insert of a whole statement recalculates once.
CREATE OR REPLACE FUNCTION public.transactions_refresh_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_accounts uuid[];
    v_debts uuid[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT x) INTO v_accounts
          FROM (SELECT account_id FROM new_rows UNION SELECT transfer_account_id FROM new_rows) s(x) WHERE x IS NOT NULL;
        SELECT array_agg(DISTINCT debt_id) INTO v_debts FROM new_rows WHERE debt_id IS NOT NULL;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT x) INTO v_accounts
          FROM (SELECT account_id FROM old_rows UNION SELECT transfer_account_id FROM old_rows) s(x) WHERE x IS NOT NULL;
        SELECT array_agg(DISTINCT debt_id) INTO v_debts FROM old_rows WHERE debt_id IS NOT NULL;
    ELSE
        SELECT array_agg(DISTINCT x) INTO v_accounts
          FROM (SELECT account_id FROM new_rows UNION SELECT transfer_account_id FROM new_rows
                UNION SELECT account_id FROM old_rows UNION SELECT transfer_account_id FROM old_rows) s(x)
         WHERE x IS NOT NULL;
        SELECT array_agg(DISTINCT x) INTO v_debts
          FROM (SELECT debt_id FROM new_rows UNION SELECT debt_id FROM old_rows) s(x) WHERE x IS NOT NULL;
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

DROP TRIGGER IF EXISTS transactions_refresh_balances_insert ON public.transactions;
DROP TRIGGER IF EXISTS transactions_refresh_balances_update ON public.transactions;
DROP TRIGGER IF EXISTS transactions_refresh_balances_delete ON public.transactions;

CREATE TRIGGER transactions_refresh_balances_insert
    AFTER INSERT ON public.transactions
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION public.transactions_refresh_balances();

CREATE TRIGGER transactions_refresh_balances_update
    AFTER UPDATE ON public.transactions
    REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION public.transactions_refresh_balances();

CREATE TRIGGER transactions_refresh_balances_delete
    AFTER DELETE ON public.transactions
    REFERENCING OLD TABLE AS old_rows
    FOR EACH STATEMENT EXECUTE FUNCTION public.transactions_refresh_balances();

-- The account dialog writes current_balance directly (it resets it to the opening
-- balance on edit). Computing it here keeps it right whatever the app sends.
CREATE OR REPLACE FUNCTION public.accounts_set_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.current_balance := public.account_balance(NEW.id, NEW.initial_balance);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_set_balance ON public.accounts;
CREATE TRIGGER accounts_set_balance
    BEFORE INSERT OR UPDATE OF initial_balance, current_balance ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.accounts_set_balance();

-- Debts are different: their balance can be typed in by hand, and like the old code it
-- is only derived from payments once a payment transaction is linked to the debt.

-- Transactions dated in the future start counting when their date arrives, without any
-- write to trigger a recalculation. The app calls this when it loads accounts.
CREATE OR REPLACE FUNCTION public.refresh_my_balances()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT public.recalc_account_balances(ARRAY(SELECT id FROM public.accounts WHERE user_id = auth.uid()));
    SELECT public.recalc_debt_balances(ARRAY(
        SELECT DISTINCT t.debt_id FROM public.transactions t
         WHERE t.user_id = auth.uid() AND t.debt_id IS NOT NULL AND t.is_debt_payment));
$$;

REVOKE ALL ON FUNCTION public.recalc_account_balances(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalc_debt_balances(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_my_balances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transactions_refresh_balances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounts_set_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.account_balance(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_account_balances(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_debt_balances(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_my_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.transactions_refresh_balances() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounts_set_balance() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_balance(uuid, bigint) TO authenticated, service_role;

-- Bring existing balances in line once.
SELECT public.recalc_account_balances(ARRAY(SELECT id FROM public.accounts));
SELECT public.recalc_debt_balances(ARRAY(
    SELECT DISTINCT debt_id FROM public.transactions WHERE debt_id IS NOT NULL AND is_debt_payment));
