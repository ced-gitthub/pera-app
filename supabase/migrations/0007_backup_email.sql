-- 0007: backup email for account recovery. Only the server (secret key) touches this table: RLS is on with NO policies and anon/authenticated have no grants,
-- because it stores one-time verification hashes that a signed-in user must never be able to read.
create table if not exists public.backup_emails (
  user_id uuid primary key references auth.users on delete cascade,
  -- null = no backup email set (row kept only so the hourly send limit survives remove/re-add)
  email text check (email is null or (char_length(email) <= 254 and email = lower(email))),
  verified_at timestamptz,
  code_hash text,
  code_expires_at timestamptz,
  code_attempts int not null default 0,
  sends_in_hour int not null default 0,
  sends_window_start timestamptz,
  last_recovery_at timestamptz,
  created_at timestamptz not null default now()
);
-- one verified backup address maps to exactly one account
create unique index if not exists backup_emails_verified_email_key on public.backup_emails (email) where verified_at is not null;
alter table public.backup_emails enable row level security;
revoke all on public.backup_emails from anon, authenticated;
