-- 0011: savings goals ("Save ₱5,000 for a phone"), optionally connected to one of the user's accounts.
-- Additive: a new table only, nothing existing is touched. Progress is never stored: the app derives it from the connected account's balance
-- (or, with no account, from income minus expenses since the goal started), so it can never disagree with the user's transactions.
-- Same safeguards as every other table: owner-only RLS, the restrictive two-step (mfa_ok) policy, a composite foreign key so a goal can only
-- point at the user's OWN account, and a per-user row cap.
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 40 and name ~ '\S'),
  emoji text not null default '🎯' check (length(emoji) between 1 and 8),
  target_minor bigint not null check (target_minor > 0 and target_minor <= 100000000000),
  account_id uuid,
  started_on date not null default ((now() at time zone 'Asia/Manila')::date),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id, created_at);

alter table public.savings_goals enable row level security;
drop policy if exists savings_goals_owner on public.savings_goals;
create policy savings_goals_owner on public.savings_goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "savings_goals_mfa" on public.savings_goals;
create policy "savings_goals_mfa" on public.savings_goals as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

drop trigger if exists savings_goals_row_limit on public.savings_goals;
create trigger savings_goals_row_limit before insert on public.savings_goals for each row execute function public.enforce_row_limit(12);
