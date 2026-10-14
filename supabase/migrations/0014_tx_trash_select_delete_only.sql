-- 0014: users can only READ and DELETE their own undo-trash rows (tx_trash). They can no longer INSERT or UPDATE them.
-- Why: 0005 gave tx_trash a `for all` owner policy, so a signed-in user could insert arbitrary-size rows (no size limit, no per-user cap) or
-- push deleted_at into the future (the 30-day purge in on_tx_delete never reaches it) and fill the free-tier database.
-- Nothing legitimate writes there as the user: rows are inserted by the security-definer trigger on_tx_delete (0005), which is owned by the
-- table owner and bypasses RLS and these grants. The apps only SELECT (list/restore) and DELETE (spend the copy after a restore).
-- The 30-day purge already exists (0005, on_tx_delete deletes that user's rows older than 30 days on every transaction delete); nothing to add.
-- The restrictive "tx_trash_mfa" policy from 0006 is `for all`, so it keeps applying to SELECT and DELETE unchanged.

drop policy if exists tx_trash_owner on public.tx_trash;
drop policy if exists tx_trash_owner_select on public.tx_trash;
drop policy if exists tx_trash_owner_delete on public.tx_trash;
create policy tx_trash_owner_select on public.tx_trash for select to authenticated using (user_id = (select auth.uid()));
create policy tx_trash_owner_delete on public.tx_trash for delete to authenticated using (user_id = (select auth.uid()));

-- Defence in depth: without the privilege a write fails loudly with 42501 (permission denied) instead of silently matching no rows.
revoke insert, update on public.tx_trash from anon, authenticated;
