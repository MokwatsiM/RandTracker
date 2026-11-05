-- Each imported row gets an ID: the bank's own (OFX FITID) or one built from its date,
-- amount, description and position. The unique index stops the same row being imported
-- twice into an account, including rows that were imported and later deleted.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS imported_id text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_account_imported_id
    ON public.transactions (account_id, imported_id);

-- Remembered CSV column mapping and formats, per account.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS import_settings jsonb;
