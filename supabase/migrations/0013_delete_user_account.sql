-- 0013: delete a user's account through the database instead of the auth admin API.
-- Why: the server's secret key is a new-style key that PostgREST accepts but the auth service's admin endpoint rejects ("401: This endpoint requires a valid
-- Bearer token"), so DELETE /admin/users/<id> always failed (found by the live test of the native app's delete-account route, 2026-10-14).
-- Deleting the auth.users row is what the admin API does anyway: every table has `on delete cascade` to auth.users, and migration 0010's AFTER DELETE
-- trigger purges the hidden undo-trash.
-- Safety: the function takes a user id, so it MUST NOT be callable by signed-in users (they could delete anyone). Execute is granted to service_role only;
-- the web route and the native route call it after checking the person's own token, typed DELETE, a recent sign-in and two-step verification.
create or replace function public.delete_user_account(p_user uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    raise exception 'user id required';
  end if;
  delete from auth.users where id = p_user;
  delete from public.tx_trash where user_id = p_user; -- belt and braces: the 0010 trigger already does this
end;
$$;
revoke all on function public.delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_account(uuid) to service_role;
