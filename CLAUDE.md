# Zovix — working rules for Claude

Free-tier PHP money tracker. Next.js 15 + TypeScript + Tailwind 4, Supabase (project `vxhgkkzbmrhxayzryake`), Vercel Hobby. Production: https://pera-app-beta.vercel.app. Read README.md for architecture.

## Session rules
- At the start of each session, read CLAUDE.md, `docs/CORRECTIONS.md` (everything Ced has already corrected: do not make him repeat it) and PROGRESS.md first.
- After every fix or decision, update PROGRESS.md (fixed, open bugs, decisions, next steps).
- Every app project, feature or fix follows `docs/APP-DEV-PIPELINE.md` (5 stages: PM, UI/UX, Backend & DevOps, Mobile Developer, QA, with gates G1 to G4, G5a and G5b between stages: a failed gate is routed to the right specialist agent and the whole gate re-run before moving on; an Instruction ledger of Ced's verbatim words is re-checked at every gate). Full track for new apps/features (one stage per turn, stop for approval); light track for fixes (all stages in one turn, but always a Stage 1 restatement of the request in Ced's own words, a QA Engineer review for risky changes, and real test evidence).

## Non-negotiables
- Cost stays $0. No paid services or keys.
- Money is integer centavos. Dates are Asia/Manila. Never use floats for money.
- Never print or store secrets. Never edit `.env*`.
- Database changes: additive SQL in `supabase/migrations/NNNN_name.sql`. Apply to Supabase BEFORE merging code that needs it. Never edit an applied migration.
- Security boundary is Postgres RLS. Every new table needs RLS + tests in `tests/prod/rls-suite.ts`.
- Don't ask the user to run anything locally. Do it, or say exactly what is blocked.

## Feature checklist (every feature, no exceptions)
- Every form that creates something: a one-time request id (or a database unique key) so a double-tap or retry saves once, and `<Btn>` (disables while saving).
- Every delete: confirm (`<Btn confirm=...>`) or Undo. Never silently drop data; delete a trash/backup copy only after the restore succeeded.
- Every input: server-side limits (length, amount, plausible date via `isSaneDate`), a visible label or `aria-label`, and an error message that says what to fix.
- Every new table: RLS owner policy + the MFA restrictive policy + a per-user row cap + RLS tests in `tests/prod/rls-suite.ts`.
- Anything that can run unbounded (imports, recurring rules, exports, search): a hard cap and a clear message when it is reached.
- Loading, empty, error and success states for every new screen; keyboard and mobile (375px) usable.
- Rules enforced in the database beat rules only in app code. Add both.

## Quality gates
- `npm run verify` (safety self-test, typecheck, unit tests, lint) must pass. A git pre-push hook blocks pushing `main` otherwise; CI also runs the app tests, the build and `npm run format:check`.
- `npm run selftest` proves the guard hook and tool-name rules still work. Run it after any change to `.claude/` or `.mcp.json`.
- Lint warnings are a ratchet: the count in `package.json` (`--max-warnings`) may only go down. Do not add `any`; do not grow files past 400 lines; split by topic.
- Format with `npm run format` before committing. Money never goes through `parseFloat`.
- Work on a branch, then merge to `main` only when the gates are green. Weekly health check: `.github/workflows/weekly-health.yml`.

## Team (use subagents; keep the main thread short)
The five pipeline roles (docs/APP-DEV-PIPELINE.md), each a real agent in `.claude/agents/`, plus two cheap helpers:
| Agent | Model | Stage / use for |
|---|---|---|
| `product-manager` | Sonnet | Stage 1: Product Specification Blueprint + the Instruction ledger. Always before building anything bigger than one file. |
| `ui-ux-designer` | Sonnet | Stage 2: Design Handoff Specification (screens, states, copy, tokens). |
| `backend-devops-engineer` | Sonnet | Stage 3: Backend & API Contract, migrations (read skill `pera-migration`). Never applies a migration before the QA Engineer approves it. |
| `mobile-app-developer` | Sonnet | Stage 4: implement + unit/e2e tests, test first. |
| `qa-engineer` | Opus | Stage 5 and the independent reviewer at every gate: returns APPROVE/REJECT with evidence. REQUIRED before shipping migrations, RLS, money math, auth, deploy config or any APK. If it rejects, fix and re-submit. |
| `explorer` | Haiku | Find code, trace flows, answer "where is X". |
| `tester` | Sonnet | Live tests in `tests/prod` for the QA Engineer (read skill `pera-live-qa`). |
| `ci-watcher` | Haiku | Wait for deploy/CI/prod-qa and return pass counts. Never poll in the main thread. |

Slash commands: `/plan`, `/migrate`, `/qa`, `/review`, `/ship`, `/status`.
Hooks (`.claude/hooks`): `guard.mjs` blocks secret-looking writes, edits to committed migrations, and destructive SQL (drop table/column, truncate, delete/update without where); `tests.sh` blocks finishing while unit tests fail; `status.sh` prints repo/CI state at session start.
Prefer available process skills (test-driven-development, systematic-debugging, verification-before-completion) over improvising.

## Workflow
1. `/plan` (product-manager). 2. Build (mobile-app-developer; backend-devops-engineer for schema; tester for live steps). 3. QA Engineer if risky. 4. `/ship` (ci-watcher reports results).
Local checks: `npm test` (unit). Typecheck/build/e2e run in CI (`ci`). Live checks: `prod-qa`; results are published to branches `qa-qa`, `qa-rls`, `qa-responsive`, `qa-security`, `qa-db` (runner logs are not readable; fetch those branches with a forced `+refs/heads/...` refspec).
Pushing to `main` deploys to Vercel (100/day limit). Batch changes; put `[skip ci]` in the message for docs/config-only commits.

## Tests
Any behaviour change needs: a unit/e2e test, and a live step in `tests/prod/` for user-visible features. The UI uses per-tab Edit mode: controls are hidden until Edit is pressed, so live tests must click Edit first.

## Native app (`native/`, Expo Android)
- Read `docs/native-app/NATIVE.md` before touching it (map, rules, build recipe, open items). History in `CHANGELOG.md`, roadmap in `PLAN.md`.
- Screens use only design tokens (`native/src/uiTokens.ts`); `tests/native-design.test.ts` enforces it. `npm run verify` does not type-check `native/`: also run `cd native && npx tsc --noEmit`.
- Release: replace `Zovix-native-latest.apk` on the existing GitHub release `native-0.3` (Ced has that page saved); never make per-version releases. Publish ONLY after the QA Engineer approves. Never push to `main` without Ced's yes (it deploys the website).

## Reporting (user preference)
Final message only: `Problem:` / `Solution:` / `Outcome:` — one line each, with pass counts. No process narration, no recaps, no restating the request. Ask at most one short question, only if truly blocked. User goes by Ced.
