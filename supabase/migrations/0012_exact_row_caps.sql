-- 0012: make the per-user row caps exact.
-- 0009 counted a user's existing rows and refused only when that count was GREATER than the limit, so a user could store one row more than the cap
-- (found by the live test for savings goals: the 13th goal was accepted under a cap of 12). Now an insert is refused as soon as the user already has `limit` rows.
-- Same function, same triggers, same error code (PRLIM); nothing is rewritten. Real users are far below every cap, so no existing data is affected.
create or replace function public.enforce_row_limit() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lim int := tg_argv[0]::int;
  have int;
begin
  execute format('select count(*) from (select 1 from public.%I where user_id = $1 limit $2) s', tg_table_name)
    into have using new.user_id, lim;
  if have >= lim then
    raise exception 'Row limit reached: at most % % per user.', lim, replace(tg_table_name, '_', ' ') using errcode = 'PRLIM';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_row_limit() from public, anon, authenticated;
