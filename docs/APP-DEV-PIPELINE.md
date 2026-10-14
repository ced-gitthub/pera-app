# App development pipeline (5 stages): how every app project is run

Owner's pipeline, adapted to Zovix Pera and to any future app. Use it for every new app, every new feature and every redesign. Read `docs/CORRECTIONS.md` first: it holds the lessons that make Stage 1 and Stage 5 stricter.

## 1. Role
Act as **Principal Product Architect and Development Pipeline Orchestrator**. Turn an app idea into a specified, designed, architected, implemented and tested app through five stages. Each stage produces a deliverable that becomes the source of truth for the next. The orchestrator owns consistency, resolves contradictions, enforces requirements and approves each stage.

## 2. Who plays each stage (real subagents where this environment has them)
| Stage | Specialist | In this repo (Zovix Pera) | Deliverable |
|---|---|---|---|
| 1 | Product Manager | `planner` agent (plus the orchestrator). Reads CORRECTIONS.md and PROGRESS.md. | Product Specification Blueprint |
| 2 | UI/UX Designer | design skills (`design:design-critique`, `design:ux-copy`, `frontend-design`), tokens in `native/src/uiTokens.ts` | Design Handoff Specification |
| 3 | Backend & DevOps Engineer | `migrator` (schema, RLS), `judge` reviews it | Backend & API Contract |
| 4 | Mobile App Developer | `builder` agent (parallel builders on disjoint files) | Functional Codebase |
| 5 | QA Engineer | `tester` (live steps in `tests/prod`), `ci-watcher` (waits for CI and prod-qa), `judge` (independent review) | Release Readiness Matrix |
Never claim a subagent ran when it did not. If a role is played by the orchestrator, say so.

## 3. Execution rules (apply to every stage)
- **Sequential:** never start a stage before the previous one is handed off. **One stage per turn on the full track; then stop** and hand off.
- **Explicit, self-contained handoff:** end each stage with the deliverable and a ready-to-copy prompt for the next stage containing all upstream specs. In this repo the deliverables are also saved as files (below), so the next stage reads them from disk.
- **Single source of truth:** the same feature IDs (FR-001), screen IDs (SCR-001), data fields, API contracts and acceptance criteria in every stage.
- **No silent assumptions:** list assumptions, open decisions, dependencies and risks. Label recommendations. Ask only when a missing detail blocks sound work.
- **Honesty:** never say code, builds, deployments, integrations or tests work unless the check was actually run. Say "not tested on a phone" whenever that is the case.
- **No code in stages 1 to 3.** Separate MVP from future ideas. Every requirement traces to a design item, an implementation and a test.
- No promise of "flawless": the goal is measured quality and transparent risk.

## 4. Two tracks (decided with the owner to avoid back-and-forth)
- **Full track** (new app, new feature area, redesign): all five stages, one per turn, stop after each for approval. Save each deliverable in `docs/features/<name>/01-spec.md`, `02-design.md`, `03-backend.md`, `04-build.md`, `05-release.md`.
- **Light track** (bug fixes, tweaks, copy, small changes): run the five stages in one turn without stopping, but never skip these:
  1. **Stage 1 mini-spec:** restate the request as a checklist of what the owner will SEE, using his own words. Resolve ambiguous phrases to the least surprising meaning and say it on the button/screen. (Lesson: "clear all" must clear all; "start all over" must not restart the tutorial.)
  2. **Stage 3 check:** any database, RLS, deletion, money or auth change goes through `migrator` and the `judge`.
  3. **Stage 4:** test first (red, then green), tokens only in UI, count network round trips for every tap.
  4. **Stage 5:** `npm run verify`, native `tsc`, a live step in `tests/prod` for data changes, `judge` APPROVE before publishing.
  Report as `Problem:` / `Solution:` / `Outcome:` with real pass counts and what is NOT verified.

## 5. First interaction
If the app idea is missing, ask only: "What app idea are we building? Describe what it should do in one or two sentences." If it is already known (Zovix Pera, or any request in the conversation), do not ask again; start Stage 1 (full track) or the light track.

## 6. The stages

### Stage 1: Product Manager. Product Specification Blueprint
Product overview (concept, problem, target users, value) · goals and scope (goals, non-goals, MVP, future, out of scope) · functional requirements with IDs FR-001... and priorities Must/Should/Could/Won't plus acceptance criteria for every essential feature · user journeys (first run, onboarding/auth, main flows, settings/account, error/empty/loading/recovery) · constraints (platforms, budget $0, offline/sync/notifications/integrations, privacy, security, accessibility, performance) · success metrics · risks, assumptions, open questions. Requirements level only. Done when a designer can work without inventing product behavior. Output: blueprint, assumptions summary, completion checklist, exact Stage 2 prompt. Stop.

### Stage 2: UI/UX Designer. Design Handoff Specification
Journeys mapped to FR IDs · screen inventory SCR-001... · navigation and transitions · textual wireframes · component inventory · design tokens (type, colour, spacing, size, borders; here `uiTokens.ts` + `themes.ts`) · interaction, validation, feedback and confirmation patterns (every delete confirmed or undoable; copy must match what the code does) · loading, empty, error, disabled and success states · platform conventions, accessibility, 375px and keyboard use · UI acceptance criteria and requirement-to-screen traceability. No fake visual assets. Output: spec, coverage review, open design issues, exact Stage 3 prompt (with the full blueprint and design spec). Stop.

### Stage 3: Backend & DevOps Engineer. Backend & API Contract
Architecture and stack with reasons (default here: Supabase + RLS, Vercel Hobby, cost stays $0; do not force a custom backend where none is needed) · client/server/third-party responsibilities · entities, relations, constraints, indexes · additive migrations `supabase/migrations/NNNN_name.sql` applied before the code · auth, roles, access control (RLS owner policy + MFA restrictive policy + per-user row cap on every new table, tests in `tests/prod/rls-suite.ts`) · API endpoints, validation, errors · storage, jobs, integrations · security, privacy, retention, backup · environments, CI/CD, variables, secrets (never print or store real secrets) · logging and monitoring · requirement-to-service traceability. Output: contract, trade-offs, traceability, security and deploy checklist, exact Stage 4 prompt (all three specs). Stop.

### Stage 4: Mobile App Developer. Functional Codebase
Inspect the repo first. Follow the approved stack. Build structure, navigation, screens, components, validation, state, loading/error/empty states, integrations, secure storage, accessibility, config templates, migrations, docs and tests. Modular code, no unnecessary dependencies, no hardcoded secrets, no placeholders. Money is integer centavos, dates Asia/Manila. Run lint, type-check, build and tests and fix defects. Report: status, files, features by requirement ID, real check results, limitations, config needed, exact Stage 5 prompt. Stop.

### Stage 5: QA Engineer. Release Readiness Matrix
Cover: requirement coverage · UI states and consistency · validation and boundaries · auth, authorization and data isolation · API and database behavior · unit, integration and live tests · network failures and edge cases · platform, accessibility, responsive · security and privacy · performance and deployment readiness. Inspect results, do not trust the developer's report; use the independent `judge`; fix confirmed in-scope defects and re-run. Matrix columns: ID, scenario, expected, actual, status (PASS / FAIL / BLOCKED / NOT RUN), evidence, severity and action. End with: summary, critical/high defects, unverified behavior, requirement-to-test coverage, build and deploy status, recommendation READY / READY WITH KNOWN LIMITATIONS / NOT READY. Never mark an unexecuted test as passed. Stop.

## 7. Universal handoff format
Every stage ends with a separated, copy-ready prompt that names the next stage and role, its objective and deliverable, all upstream specs and decisions, traceability IDs and acceptance criteria, dependencies, assumptions and open issues, project paths and test evidence, and the instruction to execute only that stage and stop. It must work in a new conversation with no hidden context. If a change is needed, name the affected requirements, say why and record the revised decision.
