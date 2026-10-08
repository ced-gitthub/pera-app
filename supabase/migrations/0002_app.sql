-- Run AFTER 0001_init.sql. Not yet executed by the author (see README).
-- 1) Real unique constraints (PostgREST upsert needs plain constraints, not partial indexes). NULLs are distinct, so unset columns never collide.
drop index if exists tx_idem; drop index if exists tx_import; drop index if exists tx_external;
alter table transactions drop column if exists client_request_id;
alter table transactions add column request_id uuid, add column request_idx int;
alter table transactions add constraint tx_request_uq unique (user_id, request_id, request_idx), add constraint tx_import_uq unique (user_id, import_hash), add constraint tx_external_uq unique (user_id, external_id);
alter table recurring_transactions add column run_count int not null default 0, alter column account_id set not null, alter column category_id set not null;
-- 2) Defaults for every new user: categories + accounts.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name) values (new.id, new.email, new.raw_user_meta_data ->> 'name');
  insert into public.categories (user_id, name, type) select new.id, n, 'income' from unnest(array['Salary','Freelance','Business','Investment','Gift','Other Income']) n;
  insert into public.categories (user_id, name, type) select new.id, n, 'expense' from unnest(array['Food','Groceries','Transportation','Bills','Utilities','Rent','Shopping','Entertainment','Health','Education','Subscriptions','Travel','Personal','Other']) n;
  insert into public.accounts (user_id, name, account_type) values (new.id,'Cash','cash'),(new.id,'GCash','ewallet'),(new.id,'Maya','ewallet'),(new.id,'BPI','bank'),(new.id,'Credit Card','credit_card'),(new.id,'Savings','savings');
  return new;
end $$;
-- 3) More aggregates (security invoker: RLS applies).
create or replace function monthly_summary(p_year int) returns table (month int, income_minor bigint, expense_minor bigint) language sql security invoker stable as $$
  select extract(month from transaction_date)::int, coalesce(sum(amount_minor) filter (where type = 'income'), 0)::bigint, coalesce(sum(amount_minor) filter (where type = 'expense'), 0)::bigint
  from transactions where transaction_date between make_date(p_year,1,1) and make_date(p_year,12,31) and type <> 'transfer' group by 1 order by 1 $$;
create or replace function account_spending(p_from date, p_to date) returns table (account_id uuid, total_minor bigint) language sql security invoker stable as $$
  select account_id, sum(amount_minor)::bigint from transactions where type = 'expense' and transaction_date between p_from and p_to group by account_id $$;
create or replace function sum_expense(p_from date, p_to date, p_category uuid default null, p_account uuid default null) returns bigint language sql security invoker stable as $$
  select coalesce(sum(amount_minor), 0)::bigint from transactions where type = 'expense' and transaction_date between p_from and p_to and (p_category is null or category_id = p_category) and (p_account is null or account_id = p_account) $$;
-- 4) Recurring: occurrence k is ALWAYS computed from start_date (no drift). Monthly/yearly use Postgres date + interval, which clamps to the last valid day
--    (start Jan 31 monthly -> Jan 31, Feb 28/29, Mar 31, Apr 30 ...). Re-running creates nothing new (unique recurring_id + date).
create or replace function recurring_occurrence(r recurring_transactions, k int) returns date language sql immutable as $$
  select case r.frequency when 'daily' then r.start_date + k * r.interval_count when 'weekly' then r.start_date + 7 * k * r.interval_count
    when 'monthly' then (r.start_date + make_interval(months => k * r.interval_count))::date else (r.start_date + make_interval(years => k * r.interval_count))::date end $$;
create or replace function run_recurring(p_today date) returns int language plpgsql security invoker as $$
declare r recurring_transactions; k int; d date; n int := 0; c int; begin
  for r in select * from recurring_transactions where active and next_run_date <= p_today for update loop
    k := r.run_count; d := recurring_occurrence(r, k);
    while d <= p_today and (r.end_date is null or d <= r.end_date) loop
      insert into transactions (user_id, account_id, category_id, type, amount_minor, description, transaction_date, recurring_id) values (r.user_id, r.account_id, r.category_id, r.type, r.amount_minor, r.description, d, r.id) on conflict do nothing;
      get diagnostics c = row_count; n := n + c; k := k + 1; d := recurring_occurrence(r, k);
    end loop;
    update recurring_transactions set run_count = k, next_run_date = d, active = (r.end_date is null or d <= r.end_date) where id = r.id;
  end loop; return n; end $$;
