-- 0005: real "undo last" + deleting a recurring rule keeps its history.

-- 1) Deleted transactions are kept for 30 days so "undo last" can restore them.
--    No foreign key on user_id on purpose: this insert must never block deleting a user's data.
create table public.tx_trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tx_id uuid not null,
  row jsonb not null,
  deleted_at timestamptz not null default now()
);
create index tx_trash_user_idx on public.tx_trash (user_id, deleted_at desc);
create index tx_trash_tx_idx on public.tx_trash (tx_id);
alter table public.tx_trash enable row level security;
create policy tx_trash_owner on public.tx_trash for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.on_tx_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tx_trash (user_id, tx_id, row) values (old.user_id, old.id, to_jsonb(old));
  delete from public.tx_trash where user_id = old.user_id and deleted_at < now() - interval '30 days';
  return old;
end $$;
create trigger tx_after_delete after delete on public.transactions for each row execute function public.on_tx_delete();
revoke execute on function public.on_tx_delete() from public, anon, authenticated;

-- 2) Deleting a recurring rule keeps its past transactions (they just stop being linked).
--    Before this, the delete failed on the foreign key, so rules that had already run could not be removed.
alter table public.transactions drop constraint transactions_recurring_id_user_id_fkey;
alter table public.transactions add constraint transactions_recurring_id_user_id_fkey
  foreign key (recurring_id, user_id) references public.recurring_transactions (id, user_id) on delete set null (recurring_id);

-- Why a deleted generated occurrence is never recreated: run_recurring walks each rule with a cursor (run_count / next_run_date)
-- that only moves forward, and tx_recurring (recurring_id, transaction_date) is unique. Regression-tested against the real database.
