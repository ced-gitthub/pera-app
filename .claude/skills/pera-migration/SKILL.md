---
name: pera-migration
description: Checklist for safe Supabase schema changes in Pera (additive SQL, RLS, tests, apply, verify). Use for any migration.
---
# Pera migrations

1. New file `supabase/migrations/NNNN_short_name.sql` (next number, never edit an applied one). Idempotent: `if not exists`, `drop policy if exists` then create, `create or replace function`.
2. Additive and backwards compatible: the previous app version must keep working on the new schema (add columns with defaults; do not rename or drop).
3. Every new table: `enable row level security`; policies `to authenticated using (user_id = (select auth.uid()))`; keep the restrictive `mfa_ok()` policy pattern used by the other tables. Functions: `security invoker`, `set search_path = public`, revoke from `public, anon`, grant to `authenticated`.
4. Backfill existing rows in the same migration when a new column needs values.
5. Add checks to `tests/prod/rls-suite.ts` (cross-user read/update/insert blocked, anon blocked, constraints) and update the e2e fake in `tests/e2e/mocks/fake-supabase.cjs` if the app reads the new columns.
6. Get `judge` approval, then apply with `mcp__Supabase__apply_migration` to project `vxhgkkzbmrhxayzryake` BEFORE merging code that needs it.
7. Verify with a read-only query (information_schema.columns, pg_policies, pg_proc) and confirm in the report.
8. Update the migration list in README.md.
Destructive SQL (drop table/column/schema, truncate, delete/update without where) is blocked by `.claude/hooks/guard.mjs`; stop and ask the user instead.
