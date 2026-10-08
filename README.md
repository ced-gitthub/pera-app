# Pera — free-tier money tracker (Next.js + Supabase)

Type "food 120, grocery 29" and it becomes transactions. Money is stored as integer centavos. Runs at $0/month: Supabase Free + Vercel Hobby + GitHub Free. **No AI key is needed.**

> **Status honesty.** Executed and passing in the author's sandbox: core/app logic tests (14 groups), the real server actions and pages run against an *in-memory stand-in* for Supabase (94 checks), and the real `QuickAdd` component in headless Chromium (24 checks). **Never executed:** `npm install`, `next build`, the SQL migrations, real Supabase Auth/RLS (`test:rls`), and Vercel deployment. The stand-in mirrors the SQL's behaviour but does not prove it. Run `npm run test:rls` against your Supabase project before trusting it with real data.

## Prerequisites
Node.js 20.9+ (22 recommended), Git, a free [Supabase](https://supabase.com) account, optionally a free GitHub and Vercel account.

## Install
```
npm install
cp .env.example .env.local
```
## Supabase setup
1. New project (free plan; no card). Wait for it to finish provisioning.
2. **SQL Editor:** run `supabase/migrations/0001_init.sql`, `0002_app.sql`, `0003_hardening.sql`, `0004_indexes.sql` (in that order, once each). Verify with `select count(*) from information_schema.columns where table_name='transactions' and column_name='request_id'` (must be 1).
3. **Authentication > Providers > Email:** keep enabled. For personal use you may switch "Confirm email" off so sign-up logs you straight in (required for `npm run test:rls`).
4. **Project Settings > API:** copy the Project URL and the *publishable* key into `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
Never put a Supabase secret or service-role key anywhere in this project. The app only needs the publishable key; Row Level Security is the security boundary.
(If your dashboard still shows the legacy "anon" key, it also works in the same variable.)
5. Authentication > URL Configuration: add `http://localhost:3000` (and your Vercel URL later) to the allowed redirect URLs.

## Run / test
```
npm run dev          # http://localhost:3000  -> Register -> Dashboard
npm run typecheck    # TypeScript over the whole app
npm test             # core + app logic, no network needed
npm run test:app     # real server actions + pages vs an in-memory Supabase stand-in (needs devDependencies)
npm run test:browser # real QuickAdd in Chromium (pip install playwright && playwright install chromium)
npm run test:rls     # REAL Supabase: cross-user isolation, idempotency, transfers, recurring (needs .env.local, both migrations, Confirm email OFF)
npm run build        # production build
```
Old prototype data: open the app in the *same browser* you used for the prototype, then Settings > "Migrate prototype data". It is verified against the original totals and is safe to repeat.

## Deploy (GitHub -> Vercel -> Supabase)
1. `git init && git add . && git commit -m init`; create an empty GitHub repo; push. (`.env.local` is git-ignored; never commit keys.)
2. vercel.com > Add New > Project > import the repo (Hobby plan, framework auto-detected as Next.js).
3. Settings > Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Deploy.
4. Add the Vercel URL to Supabase redirect URLs (step 5 above).

## Optional AI
Off by default. Simple inputs never use AI. To add a provider: implement `AIProvider` (`src/ai/provider.ts`) for any free provider, return it from `getProvider(env)`, and put its key in `.env.local` as server-only `AI_API_KEY` (never `NEXT_PUBLIC_`). AI output is validated (`validateAction`) and always needs your confirmation; it never touches the database directly. Assistant numbers always come from SQL.

## Architecture
`src/core` pure money/parser/aggregate/CSV/migration (tested) · `src/lib` validation, periods, assistant intent · `src/app/actions.ts` server actions (re-validate, write as the logged-in user under RLS, confirm writes by re-counting) · `src/app/(app)/*` pages (server components; all totals from SQL functions) · `supabase/migrations` schema, RLS, aggregates, recurring.

## Rules worth knowing
- Every transaction belongs to an account; entries without one go to "Cash" (or your first account).
- Recurring monthly/yearly rules are always computed from the start date and clamp to the month's last day (Jan 31 -> Feb 28/29 -> Mar 31 -> Apr 30). They run when the dashboard loads and are idempotent.
- CSV re-import is de-duplicated against earlier imports only.

## Vercel checklist (all must be true)
- Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production, Preview and Development. They are inlined at build time: **redeploy after changing them**.
- Framework Preset: Next.js. Root Directory: the folder that contains `package.json` (repo root).
- Settings > Deployment Protection: the app has its own login + RLS, so set Vercel Authentication to *Preview deployments only* or off, otherwise the public cannot open the site.
- Diagnostics: `GET /api/health` (public, shows env/key kind/RLS probe). Optional `QA_TOKEN` env enables `GET /api/qa?token=...`, a real-database RLS/QA run; delete the variable afterwards.
