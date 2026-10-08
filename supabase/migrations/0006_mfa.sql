-- 0006: make two-step verification (TOTP) binding at the database level.
-- Users who have a VERIFIED authenticator factor can only read/write their data with an aal2 session (password + code).
-- Users without a factor are unaffected. This stops someone who only knows a password from calling the API directly with an aal1 token.
create or replace function public.mfa_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$ declare t text; begin
  foreach t in array array['profiles','accounts','categories','recurring_transactions','transactions','budgets','tx_trash'] loop
    execute format('drop policy if exists "%s_mfa" on public.%I', t, t);
    execute format('create policy "%s_mfa" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t, t);
  end loop;
end $$;
