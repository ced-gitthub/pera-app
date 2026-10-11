# Pera — working rules for Claude

Free-tier PHP money tracker. Next.js 15 + TypeScript + Tailwind 4, Supabase (project `vxhgkkzbmrhxayzryake`), Vercel Hobby. Production: https://pera-app-beta.vercel.app. Read README.md for architecture.

## Session rules
- At the start of each session, read CLAUDE.md and PROGRESS.md first.
- After every fix or decision, update PROGRESS.md (fixed, open bugs, decisions, next steps).

## Non-negotiables
- Cost stays $0. No paid services or keys.
- Money is integer centavos. Dates are Asia/Manila. Never use floats for money.
- Never print or store secrets. Never edit `.env*`.
- Database changes: additive SQL in `supabase/migrations/NNNN_name.sql`. Apply to Supabase BEFORE merging code that needs it. Never edit an applied migration.
- Security boundary is Postgres RLS. Every new table needs RLS + tests in `tests/prod/rls-suite.ts`.
- Don't ask the user to run anything locally. Do it, or say exactly what is blocked.

## Team (use subagents; keep the main thread short)
| Agent | Model | Use for |
|---|---|---|
| `explorer` | Haiku | Find code, trace flows, answer "where is X". Always first for lookups. |
| `planner` | Sonnet | Plan before coding anything bigger than one file. |
| `builder` | Sonnet | Implement + unit/e2e tests. |
| `tester` | Sonnet | Live tests in `tests/prod` (read skill `pera-live-qa`). |
| `migrator` | Sonnet | Schema changes (read skill `pera-migration`). |
| `ci-watcher` | Haiku | Wait for deploy/CI/prod-qa and return pass counts. Never poll in the main thread. |
| `judge` | Opus | Independent review. REQUIRED before shipping migrations, RLS, money math, auth or deploy config. If it rejects, fix and re-submit. |

Slash commands: `/plan`, `/migrate`, `/qa`, `/review`, `/ship`, `/status`.
Hooks (`.claude/hooks`): `guard.mjs` blocks secret-looking writes, edits to committed migrations, and destructive SQL (drop table/column, truncate, delete/update without where); `tests.sh` blocks finishing while unit tests fail; `status.sh` prints repo/CI state at session start.
Prefer available process skills (test-driven-development, systematic-debugging, verification-before-completion) over improvising.

## Workflow
1. `/plan` (planner). 2. Build (builder; migrator for schema; tester for live steps). 3. judge if risky. 4. `/ship` (ci-watcher reports results).
Local checks: `npm test` (unit). Typecheck/build/e2e run in CI (`ci`). Live checks: `prod-qa`; results are published to branches `qa-qa`, `qa-rls`, `qa-responsive`, `qa-security`, `qa-db` (runner logs are not readable; fetch those branches with a forced `+refs/heads/...` refspec).
Pushing to `main` deploys to Vercel (100/day limit). Batch changes; put `[skip ci]` in the message for docs/config-only commits.

## Tests
Any behaviour change needs: a unit/e2e test, and a live step in `tests/prod/` for user-visible features. The UI uses per-tab Edit mode: controls are hidden until Edit is pressed, so live tests must click Edit first.

## Reporting (user preference)
Final message only: `Problem:` / `Solution:` / `Outcome:` — one line each, with pass counts. No process narration, no recaps, no restating the request. Ask at most one short question, only if truly blocked. User goes by Ced.
