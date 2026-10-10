# Pera — working rules for Claude

Free-tier PHP money tracker. Next.js 15 + TypeScript + Tailwind 4, Supabase (project `vxhgkkzbmrhxayzryake`), Vercel Hobby. Production: https://pera-app-beta.vercel.app. Read README.md for architecture.

## Non-negotiables
- Cost stays $0. No paid services or keys.
- Money is integer centavos. Dates are Asia/Manila. Never use floats for money.
- Never print or store secrets. Never edit `.env*`.
- Database changes: additive SQL in `supabase/migrations/NNNN_name.sql`. Apply to Supabase BEFORE merging code that needs it. Never edit an applied migration.
- Security boundary is Postgres RLS. Every new table needs RLS + tests in `tests/prod/rls-suite.ts`.
- Don't ask the user to run anything locally. Do it, or say exactly what is blocked.

## Team (use subagents; keep the main thread short)
- `explorer` (Haiku): find code, read CI/test results, check deploy status. Use first for any lookup.
- `builder` (Sonnet): implement + write tests.
- `judge` (Opus): independent review. REQUIRED before shipping anything that touches migrations, RLS, money math, auth, or deploy config. Optional otherwise. If it rejects, fix and re-submit.

## Workflow
1. Explore (explorer). 2. Build + tests (builder). 3. Judge if risky. 4. `/ship`.
Local checks: `npm test` (unit). Typecheck/build/e2e run in CI (`ci`). Live checks: `prod-qa` workflow; results are published to branches `qa-qa`, `qa-rls`, `qa-responsive`, `qa-security`, `qa-db` (runner logs are not readable).
Pushing to `main` deploys to Vercel (100/day limit). Batch changes; use `[skip ci]` in the message for docs/config-only commits.

## Tests
Any behaviour change needs: a unit/e2e test, and a live step in `tests/prod/` for user-visible features. The UI uses per-tab Edit mode: controls are hidden until Edit is pressed, so live tests must click Edit first.

## Reporting (user preference)
Final message only: `Problem:` / `Solution:` / `Outcome:` — one line each, with pass counts. No process narration, no recaps, no restating the request. Ask at most one short question, only if truly blocked. User goes by Ced.
