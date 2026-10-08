-- Applied to the live project via the Supabase connector (verified with a 9-check role-switching test).
alter function public.sum_expense(date, date, uuid, uuid) set search_path = public;
alter function public.recurring_occurrence(public.recurring_transactions, int) set search_path = public;
alter function public.run_recurring(date) set search_path = public;
alter function public.touch() set search_path = public;
alter function public.period_summary(date, date) set search_path = public;
alter function public.account_balances() set search_path = public;
alter function public.monthly_summary(int) set search_path = public;
alter function public.account_spending(date, date) set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch() from public, anon, authenticated;
revoke execute on function public.sum_expense(date, date, uuid, uuid), public.recurring_occurrence(public.recurring_transactions, int), public.run_recurring(date), public.period_summary(date, date), public.account_balances(), public.monthly_summary(int), public.account_spending(date, date) from public, anon;
grant execute on function public.sum_expense(date, date, uuid, uuid), public.recurring_occurrence(public.recurring_transactions, int), public.run_recurring(date), public.period_summary(date, date), public.account_balances(), public.monthly_summary(int), public.account_spending(date, date) to authenticated;
