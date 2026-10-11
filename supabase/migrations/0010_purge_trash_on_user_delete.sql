-- 0010: deleting a user also deletes their undo-trash rows.
-- tx_trash has no foreign key on purpose (the delete trigger must be able to write while a user's data is being cascaded away), which left orphaned
-- copies of a deleted user's transactions behind. This AFTER DELETE trigger on auth.users removes them, so deleting an account is always complete,
-- whichever code path deletes the user (the app's "Delete my account", the Supabase dashboard, or SQL).
create or replace function public.purge_user_trash() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tx_trash where user_id = old.id;
  return old;
end;
$$;
revoke all on function public.purge_user_trash() from public, anon, authenticated;

drop trigger if exists purge_user_trash on auth.users;
create trigger purge_user_trash after delete on auth.users for each row execute function public.purge_user_trash();
