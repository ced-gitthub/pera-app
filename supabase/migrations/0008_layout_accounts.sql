-- 0008: per-user layout settings + account options (short name, savings flag, show on Home) + manual ordering.
-- Additive only: the previous app version keeps working on this schema.

-- 1) Account options.
alter table public.accounts
  add column if not exists short_name text check (short_name is null or char_length(short_name) between 1 and 12),
  add column if not exists counts_as_savings boolean not null default false,
  add column if not exists show_on_home boolean not null default true,
  add column if not exists sort_order int not null default 0;
create unique index if not exists accounts_short_uq on public.accounts (user_id, lower(short_name)) where short_name is not null;
-- Replace the old name-contains-"saving" rule with the flag: pre-check it for accounts that matched that rule.
update public.accounts set counts_as_savings = true where name ilike '%saving%';
-- Keep today's order (by name) as the starting manual order.
update public.accounts a set sort_order = r.n * 10 from (select id, row_number() over (partition by user_id order by lower(name)) n from public.accounts) r where r.id = a.id;

-- 2) Category order ("Other" stays last; new fee categories are inserted before it).
alter table public.categories add column if not exists sort_order int not null default 0;
update public.categories c set sort_order = r.n * 10 from (select id, row_number() over (partition by user_id, type order by (name in ('Other','Other Income')), lower(name)) n from public.categories) r where r.id = c.id;

-- 3) Entries without an account: how many there are and their running balance (income - expenses). The "No account" row shows only when n > 0.
create or replace function public.no_account_summary() returns table (balance_minor bigint, n bigint) language sql security invoker stable set search_path = public as $$
  select coalesce(sum(case when type = 'income' then amount_minor when type = 'expense' then -amount_minor else 0 end), 0)::bigint, count(*)::bigint from transactions where account_id is null $$;
revoke execute on function public.no_account_summary() from public, anon;
grant execute on function public.no_account_summary() to authenticated;

-- 4) Layout settings: one row per user, owner only.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object' and pg_column_size(layout) < 20000),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists user_settings_select on public.user_settings;
drop policy if exists user_settings_insert on public.user_settings;
drop policy if exists user_settings_update on public.user_settings;
create policy user_settings_select on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_insert on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_settings_update on public.user_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists user_settings_mfa on public.user_settings;
create policy user_settings_mfa on public.user_settings as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings for each row execute function public.touch();

-- 5) New users: ordered defaults, and Savings is flagged.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name) values (new.id, new.email, new.raw_user_meta_data ->> 'name');
  insert into public.categories (user_id, name, type, sort_order) select new.id, n, 'income', o * 10 from unnest(array['Salary','Freelance','Business','Investment','Gift','Other Income']) with ordinality t(n, o);
  insert into public.categories (user_id, name, type, sort_order) select new.id, n, 'expense', o * 10 from unnest(array['Food','Groceries','Transportation','Bills','Utilities','Rent','Shopping','Entertainment','Health','Education','Subscriptions','Travel','Personal','Other']) with ordinality t(n, o);
  insert into public.accounts (user_id, name, account_type, counts_as_savings, sort_order) values (new.id,'Cash','cash',false,10),(new.id,'GCash','ewallet',false,20),(new.id,'Maya','ewallet',false,30),(new.id,'BPI','bank',false,40),(new.id,'Credit Card','credit_card',false,50),(new.id,'Savings','savings',true,60);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
