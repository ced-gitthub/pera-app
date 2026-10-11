-- 0009: per-user row caps, so one account (or a runaway import) cannot fill the free 500 MB database for everyone.
-- Limits are ~25x the busiest real user today (2,073 transactions, 8 accounts, 23 categories). Additive: no existing data is touched.
-- A BEFORE INSERT row trigger counts that user's rows (stopping at limit+1, so the check stays cheap). The app maps SQLSTATE PRLIM to a clear message (src/lib/safe.ts).
create or replace function public.enforce_row_limit() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lim int := tg_argv[0]::int;
  have int;
begin
  execute format('select count(*) from (select 1 from public.%I where user_id = $1 limit $2) s', tg_table_name)
    into have using new.user_id, lim + 1;
  if have > lim then
    raise exception 'Row limit reached: at most % % per user.', lim, replace(tg_table_name, '_', ' ') using errcode = 'PRLIM';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_row_limit() from public, anon, authenticated;

drop trigger if exists transactions_row_limit on public.transactions;
create trigger transactions_row_limit before insert on public.transactions for each row execute function public.enforce_row_limit(50000);
drop trigger if exists accounts_row_limit on public.accounts;
create trigger accounts_row_limit before insert on public.accounts for each row execute function public.enforce_row_limit(60);
drop trigger if exists categories_row_limit on public.categories;
create trigger categories_row_limit before insert on public.categories for each row execute function public.enforce_row_limit(150);
drop trigger if exists recurring_row_limit on public.recurring_transactions;
create trigger recurring_row_limit before insert on public.recurring_transactions for each row execute function public.enforce_row_limit(100);
