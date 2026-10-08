# Pera — free-tier money tracker (Next.js + Supabase)

Type "food 120, grocery 29" and it becomes transactions. Money is stored as integer centavos (PHP ₱, Asia/Manila dates). Runs at $0/month: Supabase Free + Vercel Hobby + GitHub Free. **No AI key is needed.**

Production: https://pera-app-beta.vercel.app · Repo: `ced-gitthub/pera-app` · Supabase project `vxhgkkzbmrhxayzryake` (ap-southeast-2) · Vercel project `pera-app` (region `syd1`).

## What is verified, and how
Everything below was executed, not assumed. Numbers are from the latest runs of the GitHub Actions workflows (`ci`, `prod-qa`); see "QA coverage".

| Layer | Where it runs | What it proves |
|---|---|---|
| Typecheck, unit/logic tests, app tests, production build | `ci` (every push) | Parser, money, CSV, aggregates, safe-error layer; real server actions + pages against an in-memory Supabase stand-in; `next build`; `npm audit --audit-level=high` |
| Real database suite (`tests/prod/rls-suite.ts`) | `prod-qa` → real Supabase | 39 checks: RLS cross-user isolation, composite ownership FKs, constraints, idempotent saves, transfers, recurring, aggregates, anonymous access |
| Real database regressions (`tests/prod/db.mjs`) | `prod-qa` → real Supabase | 15 checks: undo storage (`tx_trash`), recurring occurrence deletion never resurrects, rule deletion keeps history, month-end/leap-day no-drift |
| Real browser, functional (`tests/prod/qa.mjs`) | `prod-qa` → Chromium → live Vercel app → live Supabase | Auth, recovery, dashboard, commands, transactions, accounts, budgets, reports, settings, recurring, CSV, assistant, cross-user isolation |
| Real browser, security (`tests/prod/security.mjs`) | `prod-qa` → Chromium → live app → live Supabase | Email-link handling, password rules (length, repeats, breached), security page (change password, log out other/all devices), two-step verification with real authenticator codes (setup, login gate, turn-off), database-level 2FA enforcement, loading skeletons (streamed first, nav stays, reduced motion), mobile fit |
| Real browser, responsive (`tests/prod/responsive.mjs`) | same | 6 viewports (390×844, 393×852, 430×932, 768×1024, 1280×800, 1440×900) × every route: overflow, clipping, tap targets, bottom-nav overlap, dark/light contrast, reduced motion, keyboard focus, offline/slow states |

Latest full run (commit d5957f8, against production): functional browser 158/158, responsive 236/236, real-database regressions 15/15, real-database RLS/constraints 39/39; `ci` green.

Throwaway QA users are `pera-qa-<timestamp>-*@example.com`. Their rows are removed by the suites; the auth users remain (see "Housekeeping").

## Architecture
- `src/core` — pure money/parser/aggregate/CSV/migration code (unit-tested).
- `src/lib` — validation, periods, assistant intent, `safe.ts` (error layer), `commands.ts` (delete/undo/change phrases), `limits.ts`.
- `src/app/actions.ts` — server actions. Each re-validates input, writes as the logged-in user under RLS, and confirms writes by re-counting.
- `src/app/(app)/*` — server-rendered pages; totals come from SECURITY INVOKER SQL functions (`period_summary`, `account_balances`, `monthly_summary`, …).
- `src/app/(auth)/*`, `src/app/auth/callback` — login, register, forgot/reset password (PKCE), middleware refreshes the session.
- `supabase/migrations` — schema, RLS, aggregates, recurring engine, undo storage (apply in order in the Supabase SQL Editor).
- `tests/prod` + `.github/workflows/prod-qa.yml` — the production QA suites above.

Security boundary = Postgres RLS (`user_id = (select auth.uid())`) plus composite foreign keys so a row can only reference the same user's accounts/categories. The app ships only the **publishable** key. Never put a Supabase secret/service-role key in this project.

## Behaviour worth knowing
- **Undo.** `delete last` removes the newest transaction and offers an Undo button. `undo last` / `undo the last transaction` restores the most recently deleted one (never deletes). Deleted rows are archived by a database trigger in `tx_trash` for 30 days (per user, RLS-protected). Nothing deleted → "Nothing to undo…". Repeated `undo last` walks back through deletions, newest first. Account deletion keeps no trash.
- **Recurring.** Rules run when the dashboard loads, are idempotent, and walk a forward-only cursor, so deleting a generated occurrence never recreates it, future occurrences continue, and month-end/leap-day dates never drift (Jan 31 → Feb 28/29 → Mar 31). Deleting a rule keeps all past transactions (they are unlinked). If recurring processing fails the dashboard shows a safe notice and logs the cause server-side.
- **Errors.** Users only ever see safe messages. Unexpected errors are logged server-side as `[pera] where: …` with secrets redacted and shown as "Something went wrong" (+ a reference id on the error page).
- **Passwords.** 8–72 characters, not one repeated character, and not found in a known data breach (Have I Been Pwned range API, k-anonymity: only 5 hash characters leave the server; fails open if that service is down). Applies to sign-up, reset and change-password. Forgot password → email link → `/auth/callback` (PKCE) → `/reset`; the reply never reveals whether an email has an account; invalid/expired links land on `/forgot` with a clear message.
- **Email confirmation.** Controlled by Supabase → Authentication → Sign In / Providers → Email → "Confirm email". When ON: sign-up shows `/verify` (check your inbox + resend), log-in with an unconfirmed address is sent to `/verify`, and the emailed link returns through `/auth/callback?next=/&welcome=1` (signs in, shows a welcome). A link opened on another device lands on `/verify` with guidance. When OFF the app behaves as before.
- **Two-step verification (optional, per user).** `/security` → set up with any authenticator app (QR + typeable key). After the password, `/2fa` asks for the 6-digit code; until then the middleware sends every page (including `/reset`) to `/2fa`, and migration `0006` makes the database refuse all reads/writes from a password-only session of a user who has 2FA on (restrictive RLS policy on every table via `mfa_ok()`). Turning it off needs a valid code. There are no recovery codes (Supabase does not offer them): keep the setup key, or remove the factor for a locked-out user in Supabase → Authentication → Users.
- **Security page.** Change password (asks for the current one, logs out other devices), log out other devices, log out everywhere.
- **Loading.** Every data page has a `loading.tsx` skeleton with the same shapes as the real page; the nav is already on screen and the skeleton streams first, so navigation never looks frozen. Respects reduced motion.
- **Cache.** Every non-static response is `Cache-Control: private, no-store`; security headers (HSTS, nosniff, frame deny, referrer/permissions policy, CSP frame-ancestors/base-uri/form-action/object-src) are set in `next.config.mjs`.
- **Health.** `GET /api/health` is public and returns only `{ ok, commit }` (probe cached 30 s). Full diagnostics need `?token=<QA_TOKEN>` if you set that optional variable. There is no test endpoint in production.

## CSV import / export — exact duplicate rules
- Export writes `date,type,amount,category,description,notes,account,to_account`; cells starting with `= + - @` (or tab/CR) are prefixed with `'` so spreadsheets do not run them as formulas (the importer strips that guard).
- Each imported row gets an `import_hash` = `date|type|amount|account|to_account|description` (description trimmed and lower-cased; **category and notes are not part of the key**), plus an occurrence index (`#0`, `#1`…) for identical rows inside the same file. The database has a unique index on `(user_id, import_hash)`.
- Consequences (all tested against the live app): re-importing the same file adds **0**; a row whose **description, date, amount or account changed** is a **new** row, while a row that differs only in **category or notes** is treated as the **same** row and skipped (re-categorise in the app instead); two truly identical rows in one file are **both** imported (they may be genuine separate purchases) and re-import adds none; adding rows to a statement copy imports only the new ones; transfers dedupe the same way; same-account transfers, bad dates, non-positive/oversize amounts and unknown formats are skipped and counted.
- **Rows you typed by hand are never compared with imports.** This is intentional (a hand entry and a statement line of the same amount may be two different purchases). If you import a statement that overlaps hand-typed entries, review/delete duplicates in Transactions.
- Limits: 900 KB (≈9,000 rows) per file, 20,000 rows hard cap — enforced in the form before upload (server actions accept ~1 MB bodies, Vercel Hobby ~4.5 MB). Split larger statements.

## Environment variables
| Name | Where | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Production/Preview/Development) + `.env.local` | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…` or legacy anon) | same | yes |
| `AI_PROVIDER`, `AI_API_KEY` | server-only | optional, off by default |
| `QA_TOKEN` | Vercel | optional (full `/api/health` details) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | optional: the exact origin used in emailed links; if unset the request origin is used (Supabase only honours URLs in its Redirect allow-list anyway) |

They are inlined at build time: **redeploy after changing them.**

## Deployment flow
1. Push to `main` (GitHub). `ci` runs: `npm ci` → audit → typecheck → tests → app tests → build.
2. Vercel builds and deploys `main` to production automatically (`vercel.json` pins region `syd1`).
3. `prod-qa` runs on pushes touching app/test/migration files (or manually): waits until `/api/health` reports the pushed commit, then runs the four suites against production and publishes results to branches `qa-qa`, `qa-responsive`, `qa-db`, `qa-rls` (markdown + JSON + failure screenshots + layout screenshots).
4. Database changes: add a numbered file in `supabase/migrations`, run it once in the Supabase SQL Editor, and add a regression check to `tests/prod`.

Supabase one-time setup: run migrations `0001`…`0006` in order; Authentication → Email: keep enabled. **For real users turn "Confirm email" ON and configure custom SMTP** (Authentication → Emails → SMTP; Supabase's built-in sender only reaches project team members and is rate-limited). While "Confirm email" is ON, the `prod-qa` suites that create test users are skipped automatically (preflight reads `/auth/v1/settings`); turn it off briefly and run `prod-qa` manually to re-verify live. Two-step verification needs Authentication → Multi-Factor → TOTP enabled (the default). Authentication → URL Configuration: Site URL = the production URL, Redirect URLs include `<production URL>/auth/callback` (needed for password-reset emails). Vercel: Deployment Protection must allow public access to production (the app has its own login).

## Local development (optional — nothing here is required to deploy)
```
npm ci && cp .env.example .env.local   # fill the two Supabase variables
npm run dev        # http://localhost:3000
npm run typecheck && npm test && npm run test:app && npm run build
```
`npm run test:browser` (real QuickAdd component, mocked server actions) needs `pip install playwright`.

Old prototype data: open the app in the browser you used for the prototype → Settings → "Migrate prototype data" (verified against the original totals; safe to repeat).

## Known limitations (intentional or accepted)
- Email delivery uses Supabase's built-in SMTP unless you configure custom SMTP (a few emails/hour, project team members only). Confirmation and reset emails therefore cannot be QA'd end-to-end against throwaway addresses; the actions, link handling, invalid/expired-link paths and the unconfirmed-login branch are tested (the last in the app tests).
- Supabase's own leaked-password protection is a Pro feature (advisor WARN stays); Pera does the equivalent check itself (see Passwords).
- Two-step verification has no recovery codes (see Behaviour).
- Supabase performance advisor INFO: composite FKs rely on single-column indexes (`tx_account_idx`, …). Fine at personal scale; revisit if a single user holds hundreds of thousands of rows.
- No offline mode / PWA yet (planned next). `viewport-fit=cover` and safe-area CSS are already in place for it.
- Hand-typed entries are not compared with imports (see CSV section). Currency is fixed to PHP in this version.
- Vercel runtime logs are not readable by the automation; server-side errors are visible in the Vercel dashboard (Logs) as `[pera] …`.

## Housekeeping
QA users accumulate under Authentication → Users. Delete them with the SQL Editor: `delete from auth.users where email like 'pera-qa-%@example.com';` (cascades their data; the undo trigger skips users being deleted).

## Optional AI
Off by default. Simple inputs never use AI. To add a provider: implement `AIProvider` (`src/ai/provider.ts`), return it from `getProvider(env)`, and put its key in server-only `AI_API_KEY`. AI output is validated (`validateAction`) and always needs your confirmation; it never touches the database directly. Assistant numbers always come from SQL, and the assistant is read-only.
