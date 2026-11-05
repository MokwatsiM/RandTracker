-- Views run with their owner's rights by default, which skips row level security, and
-- none of these filter by user. Without this, any signed-in user could read every
-- user's figures. security_invoker makes them apply the caller's RLS on the base tables.
ALTER VIEW public.investment_summary SET (security_invoker = true);
ALTER VIEW public.tfsa_limits SET (security_invoker = true);
ALTER VIEW public.spending_by_category SET (security_invoker = true);
ALTER VIEW public.monthly_summary SET (security_invoker = true);
ALTER VIEW public.daily_balance SET (security_invoker = true);
ALTER VIEW public.account_balance_history SET (security_invoker = true);
ALTER VIEW public.net_worth_summary SET (security_invoker = true);
ALTER VIEW public.budget_performance SET (security_invoker = true);
ALTER VIEW public.top_merchants SET (security_invoker = true);
ALTER VIEW public.income_sources SET (security_invoker = true);
ALTER VIEW public.debt_payoff_projection SET (security_invoker = true);

REVOKE ALL ON
  public.investment_summary, public.tfsa_limits, public.spending_by_category,
  public.monthly_summary, public.daily_balance, public.account_balance_history,
  public.net_worth_summary, public.budget_performance, public.top_merchants,
  public.income_sources, public.debt_payoff_projection
FROM anon;
