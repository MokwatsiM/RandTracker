-- Rules categorise and clean up transactions automatically, on import and when adding
-- one by hand (Phase 1 of ENHANCEMENT_PLAN.md). conditions and actions are JSON arrays
-- read by src/lib/rules/engine.ts.

CREATE TABLE public.rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    stage text NOT NULL DEFAULT 'default' CHECK (stage IN ('pre', 'default', 'post')),
    conditions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(conditions) = 'array'),
    actions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(actions) = 'array'),
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    -- Created by learning from the user's edits rather than written by them.
    is_auto boolean NOT NULL DEFAULT false,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_user_id ON public.rules (user_id);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules" ON public.rules
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own rules" ON public.rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.rules
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.rules
    FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.rules FROM anon;

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- The bank's own description, kept unchanged so rules can always match it even after
-- the title has been cleaned up.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS imported_payee text;

-- Whether categorising a transaction teaches a rule for that payee.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS rule_learning boolean NOT NULL DEFAULT true;
