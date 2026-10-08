-- Pera schema. Money is integer minor units (centavos). Run in the Supabase SQL editor (free tier). NOT yet executed by the author.
create extension if not exists pgcrypto;
create table profiles (id uuid primary key references auth.users on delete cascade, email text, name text, created_at timestamptz default now(), updated_at timestamptz default now());
create table accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null check (char_length(name) between 1 and 40),
  account_type text not null default 'cash' check (account_type in ('cash','ewallet','bank','credit_card','savings','other')), opening_balance_minor bigint not null default 0 check (abs(opening_balance_minor) <= 99999999999),
  currency char(3) not null default 'PHP', created_at timestamptz default now(), updated_at timestamptz default now(), unique (user_id, name), unique (id, user_id));
create table categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null check (char_length(name) between 1 and 40),
  type text not null check (type in ('income','expense')), created_at timestamptz default now(), updated_at timestamptz default now(), unique (user_id, name, type), unique (id, user_id));
create table recurring_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, account_id uuid, category_id uuid, type text not null check (type in ('income','expense')),
  amount_minor bigint not null check (amount_minor between 1 and 99999999999), description text not null default '' check (char_length(description) <= 120),
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')), interval_count int not null default 1 check (interval_count between 1 and 365),
  start_date date not null, end_date date, next_run_date date not null, active boolean not null default true, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (id, user_id), foreign key (account_id, user_id) references accounts (id, user_id), foreign key (category_id, user_id) references categories (id, user_id));
create table transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, account_id uuid, transfer_account_id uuid, category_id uuid,
  type text not null check (type in ('income','expense','transfer')), amount_minor bigint not null check (amount_minor between 1 and 99999999999),
  description text not null default '' check (char_length(description) <= 120), notes text not null default '' check (char_length(notes) <= 500), transaction_date date not null,
  client_request_id uuid, import_hash text, external_id text, recurring_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  foreign key (account_id, user_id) references accounts (id, user_id), foreign key (transfer_account_id, user_id) references accounts (id, user_id), foreign key (category_id, user_id) references categories (id, user_id),
  foreign key (recurring_id, user_id) references recurring_transactions (id, user_id),
  check ((type = 'transfer' and account_id is not null and transfer_account_id is not null and account_id <> transfer_account_id and category_id is null) or (type <> 'transfer' and transfer_account_id is null and category_id is not null)));
create unique index tx_idem on transactions (user_id, client_request_id) where client_request_id is not null;   -- retries never double-insert
create unique index tx_import on transactions (user_id, import_hash) where import_hash is not null;            -- CSV/statement dedupe
create unique index tx_external on transactions (user_id, external_id) where external_id is not null;          -- localStorage migration dedupe
create unique index tx_recurring on transactions (recurring_id, transaction_date) where recurring_id is not null; -- recurring runs are idempotent
create index tx_user_date on transactions (user_id, transaction_date desc, created_at desc);
create table budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, category_id uuid not null, amount_minor bigint not null check (amount_minor between 0 and 99999999999),
  month int not null check (month between 1 and 12), year int not null check (year between 2000 and 2200), created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (user_id, category_id, month, year), foreign key (category_id, user_id) references categories (id, user_id));
-- Row Level Security: every table, every operation, owner only. The composite FKs above also stop a user linking another user's account/category.
do $$ declare t text; begin foreach t in array array['accounts','categories','transactions','budgets','recurring_transactions'] loop
  execute format('alter table %I enable row level security', t);
  execute format('create policy "%s_owner" on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t); end loop; end $$;
alter table profiles enable row level security;
create policy profiles_owner on profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create or replace function touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','accounts','categories','transactions','budgets','recurring_transactions'] loop
  execute format('create trigger %I before update on %I for each row execute function touch()', t || '_touch', t); end loop; end $$;
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles (id, email) values (new.id, new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
-- Aggregates run in the database; security invoker means RLS still applies.
create or replace function period_summary(p_from date, p_to date) returns table (type text, category_id uuid, total_minor bigint, n bigint) language sql security invoker stable as $$
  select type, category_id, sum(amount_minor)::bigint, count(*) from transactions where transaction_date between p_from and p_to and type <> 'transfer' group by type, category_id $$;
create or replace function account_balances() returns table (account_id uuid, balance_minor bigint) language sql security invoker stable as $$
  select a.id, (a.opening_balance_minor + coalesce((select sum(case when t.type = 'income' then t.amount_minor when t.type in ('expense','transfer') then -t.amount_minor end) from transactions t where t.account_id = a.id), 0)
   + coalesce((select sum(t.amount_minor) from transactions t where t.transfer_account_id = a.id), 0))::bigint from accounts a $$;
create or replace function run_recurring(p_today date) returns int language plpgsql security invoker as $$
declare r recurring_transactions; d date; n int := 0; c int; begin
  for r in select * from recurring_transactions where active and next_run_date <= p_today loop
    d := r.next_run_date;
    while d <= p_today and (r.end_date is null or d <= r.end_date) loop
      insert into transactions (user_id, account_id, category_id, type, amount_minor, description, transaction_date, recurring_id) values (r.user_id, r.account_id, r.category_id, r.type, r.amount_minor, r.description, d, r.id) on conflict do nothing;
      get diagnostics c = row_count; n := n + c;
      d := case r.frequency when 'daily' then d + r.interval_count when 'weekly' then d + 7 * r.interval_count when 'monthly' then (d + make_interval(months => r.interval_count))::date else (d + make_interval(years => r.interval_count))::date end;
    end loop;
    update recurring_transactions set next_run_date = d where id = r.id;
  end loop; return n; end $$;
