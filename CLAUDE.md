# Zovix (Pera app) — rules for Claude

Reply in caveman style (caveman skill). Final report only: `Problem:` / `Solution:` / `Outcome:`, one line each, real pass counts. Ask at most one short question, only if blocked. User = Ced.

## Stack
Next.js 15 + TypeScript + Tailwind 4, Supabase (project `vxhgkkzbmrhxayzryake`), Vercel Hobby, GitHub `ced-gitthub/pera-app`. Prod: https://pera-app-beta.vercel.app. Native app: `native/` (Expo Android). Architecture: README.md.

## Session start
Read this file, `docs/CORRECTIONS.md`, PROGRESS.md. After every fix or decision, update PROGRESS.md.

## Commands
- `npm run verify` = safety self-test, typecheck, unit tests, lint. Must pass. Pre-push hook blocks `main` otherwise.
- `npm test` unit. `npm run format` before commit. CI also runs e2e, build, `format:check`.
- Native: `cd native && npx tsc --noEmit` (verify does not cover it). Handbook: `docs/native-app/NATIVE.md`.
- Lint warnings ratchet: `--max-warnings` in package.json only goes down. No `any`. Files <= 400 lines.

## Non-negotiables
- Cost $0. No paid services or keys. Never print/store secrets. Never edit `.env*`.
- Money = integer centavos, never floats/`parseFloat`. Dates Asia/Manila.
- DB changes: additive SQL in `supabase/migrations/NNNN_name.sql`; apply to Supabase BEFORE merging code that needs it; never edit an applied migration.
- Security boundary = Postgres RLS. New table: owner policy + MFA restrictive policy + per-user row cap + tests in `tests/prod/rls-suite.ts`.
- Do the work; do not ask Ced to run things. Say exactly what is blocked.
- No push to `main` without Ced's yes, each time (it deploys; 100/day Vercel limit). Batch; `[skip ci]` for docs/config-only commits.

## Feature checklist
- Create forms: one-time request id or DB unique key, `<Btn>` disables while saving.
- Deletes: confirm (`<Btn confirm=...>`) or Undo. Never silently drop data.
- Inputs: server-side limits, `isSaneDate`, label/`aria-label`, error says what to fix.
- Unbounded work (imports, exports, search): hard cap + clear message.
- Loading/empty/error/success states; keyboard + 375px usable. DB rules beat app-only rules.
- Behaviour change needs unit/e2e test; user-visible feature needs live step in `tests/prod/` (click Edit first: controls hidden until Edit).

## Workflow
Follow `docs/APP-DEV-PIPELINE.md` (5 stages, gates, Instruction ledger of Ced's words). Fixes: light track, restate request first. Review required before migrations, RLS, money math, auth, deploy config, any APK. Use superpowers skills (TDD, systematic-debugging, verification-before-completion).

## Team (real subagents in `.claude/agents/`, keep main thread short)
- Pipeline roles: `product-manager` (Stage 1 spec + Instruction ledger), `ui-ux-designer` (2), `backend-devops-engineer` (3, migrations, skill `pera-migration`), `mobile-app-developer` (4, tests first), `qa-engineer` (5 + every gate).
- `qa-engineer` APPROVE is REQUIRED before shipping migrations, RLS, money math, auth, deploy config or any APK. On REJECT: fix, re-submit.
- Helpers: `explorer` (find code), `tester` (live tests, skill `pera-live-qa`), `ci-watcher` (wait for CI, return pass counts; never poll in main thread), `judge` (required for middleware/redirect/deploy-config).
- Slash commands: `/plan` `/migrate` `/qa` `/review` `/ship` `/status`.

## Website team (website/landing page ONLY, never `native/`)
Read `docs/WEBSITE-TEAM.md` first. Agents: `web-seo-architect`, `web-aeo-engineer`, `web-geo-architect`, `web-copywriter`, `web-ux-designer`, `web-qa-auditor` (independent PASS/FAIL audit). Copy: mostly English, Tagalog mixed in, never pure Tagalog.

## Native (Expo) rules
- Expo APIs change every SDK. Before touching Expo/EAS/RN code: read `expo` major in `native/package.json`, check `https://docs.expo.dev/versions/v<major>.0.0/` (index: https://docs.expo.dev/llms.txt). Never answer from memory.
- Add packages with `npx expo install <pkg>`, not npm add. Routing = Expo Router (`src/app/` screens only; other code outside). Lint (`npx expo lint`) + `npx tsc --noEmit` before done.
- No `ios/`/`android/` in repo: generated (prebuild). Never hand-edit; configure in `app.json`/config plugins. Native-code libs need a dev build, not Expo Go. Prefer Expo modules over third-party.

## Native release
Replace `Zovix-native-latest.apk` on existing GitHub release `native-0.3`; never per-version releases. Publish only after review approves. Theme: design tokens only (`native/src/uiTokens.ts`).
