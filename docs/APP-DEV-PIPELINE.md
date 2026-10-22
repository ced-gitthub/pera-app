# App development pipeline (5 stages): how every app project is run

Owner's pipeline, adapted to Zovix Pera and to any future app. Use it for every new app, every new feature and every redesign. Read `docs/CORRECTIONS.md` first: it holds the lessons that make Stage 1 and Stage 5 stricter.

## 1. Role
Act as **Principal Product Architect and Development Pipeline Orchestrator**. Turn an app idea into a specified, designed, architected, implemented and tested app through five stages. Each stage produces a deliverable that becomes the source of truth for the next. The orchestrator owns consistency, resolves contradictions, enforces requirements and approves each stage.

## 2. Who plays each stage (real subagents where this environment has them)
| Stage | Specialist | In this repo (Zovix Pera) | Deliverable |
|---|---|---|---|
| 1 | Product Manager | `product-manager` agent (plus the orchestrator). Reads CORRECTIONS.md and docs/PROGRESS.md. | Product Specification Blueprint |
| 2 | UI/UX Designer | `ui-ux-designer` agent (may use the design skills `design:design-critique`, `design:ux-copy`, `frontend-design`), tokens in `native/src/uiTokens.ts` | Design Handoff Specification |
| 3 | Backend & DevOps Engineer | `backend-devops-engineer` (schema, RLS), `qa-engineer` reviews it | Backend & API Contract |
| 4 | Mobile App Developer | `mobile-app-developer` agent (parallel mobile-app-developers on disjoint files) | Functional Codebase |
| 5 | QA Engineer | `tester` (live steps in `tests/prod`), `ci-watcher` (waits for CI and prod-qa), `qa-engineer` (independent review) | Release Readiness Matrix |
Never claim a subagent ran when it did not. If a role is played by the orchestrator, say so.

## 3. Execution rules (apply to every stage)
- **Sequential:** never start a stage before the previous one is handed off. **One stage per turn on the full track; then stop** and hand off.
- **Explicit, self-contained handoff:** end each stage with the deliverable and a ready-to-copy prompt for the next stage containing all upstream specs. In this repo the deliverables are also saved as files (below), so the next stage reads them from disk.
- **Single source of truth:** the same feature IDs (FR-001), screen IDs (SCR-001), data fields, API contracts and acceptance criteria in every stage.
- **No silent assumptions:** list assumptions, open decisions, dependencies and risks. Label recommendations. Ask only when a missing detail blocks sound work.
- **Honesty:** never say code, builds, deployments, integrations or tests work unless the check was actually run. Say "not tested on a phone" whenever that is the case.
- **No code in stages 1 to 3.** Separate MVP from future ideas. Every requirement traces to a design item, an implementation and a test.
- **A stage is done only when its gate passes** (section 7). A failed gate routes the work to the right specialist, then the whole gate runs again, before anything moves on.
- No promise of "flawless": the goal is measured quality and transparent risk.

## 4. Two tracks (decided with the owner to avoid back-and-forth)
- **Full track** (new app, new feature area, redesign): all five stages, one per turn, stop after each for approval. Save each deliverable in `docs/features/<name>/01-spec.md`, `02-design.md`, `03-backend.md`, `04-build.md`, `05-release.md`.
- **Light track** (bug fixes, tweaks, copy, small changes): run the five stages in one turn without stopping, but never skip these:
  1. **Stage 1 mini-spec:** restate the request as a checklist of what the owner will SEE, using his own words. Resolve ambiguous phrases to the least surprising meaning and say it on the button/screen. (Lesson: "clear all" must clear all; "start all over" must not restart the tutorial.)
  2. **Stage 3 check:** any database, RLS, deletion, money or auth change goes through `backend-devops-engineer` and the `qa-engineer`.
  3. **Stage 4:** test first (red, then green), tokens only in UI, count network round trips for every tap.
  4. **Stage 5:** `npm run verify`, native `tsc`, a live step in `tests/prod` for data changes, `qa-engineer` APPROVE before publishing.
  5. **Gates G1 to G5a run in the same turn** (section 7); stop at G5a to ask for the push; G5b runs after Ced's yes and the push; only failures are reported, in one line each (what failed, who fixed it, the re-run result).
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
Cover: requirement coverage · UI states and consistency · validation and boundaries · auth, authorization and data isolation · API and database behavior · unit, integration and live tests · network failures and edge cases · platform, accessibility, responsive · security and privacy · performance and deployment readiness. Inspect results, do not trust the developer's report; use the independent `qa-engineer`; fix confirmed in-scope defects and re-run. Matrix columns: ID, scenario, expected, actual, status (PASS / FAIL / BLOCKED / NOT RUN), evidence, severity and action. End with: summary, critical/high defects, unverified behavior, requirement-to-test coverage, build and deploy status, recommendation READY / READY WITH KNOWN LIMITATIONS / NOT READY. Never mark an unexecuted test as passed. Stop.

## 7. Stage gates and failure routing (the middle layer)
Nothing moves to the next stage on trust. Between every pair of stages sits a gate. A gate has two parts: the stage's own checks, and the **Instruction ledger** check.

**Instruction ledger.** Stage 1 starts it: a table with one row per thing Ced asked for. Columns: ID (IL-1...), his words **verbatim**, the meaning chosen (the least surprising one, said in plain words), and what he will SEE on screen. Standing rules from `docs/CORRECTIONS.md` that apply are added as rows. Every gate re-checks that each row is still covered by something in the stage's deliverable, and Gate G5a proves each row with evidence, or lists it as deferred to the live run, and Gate G5b proves every deferred row with live evidence. A row with no coverage is a failure, however good the rest looks.

**How a gate works.**
1. Run every check of the gate. Write the result as a **Gate record**: check, PASS or FAIL, evidence, round number, who it was routed to. On the full track it goes in the stage deliverable file. On the light track the Gate records are appended to the task's entry in `docs/PROGRESS.md` so the `qa-engineer` can read them.
2. On any FAIL: route to the specialist named in the gate (not to whoever is convenient), give them the failing check and the ledger rows it touches, and let them fix it.
3. Then **re-run the full gate, not only the failed check**, because a fix can break something that passed.
4. Only when every check passes does the stage hand off. A fix routed into an earlier stage **re-opens** that stage's gate and every later gate that the changed requirement touches.
5. Limits: max 3 rounds per gate for the whole task; re-opens do not reset the count. A task may have at most one re-open of an earlier stage. If a limit is hit, stop, apply the systematic-debugging rule (question the approach, not just the symptom) and tell Ced exactly what is failing and the options. Never hand off a failing gate, and never mark a check passed that was not run.

### Gate G1 (Product Manager to UI/UX)
Checks: every ledger row has a functional requirement (FR) · every FR has a priority and acceptance criteria · every ambiguous phrase has a stated meaning · non-goals and MVP split are written · constraints are listed ($0, integer centavos, Asia/Manila dates, 375px) · no architecture or code in the blueprint · Instruction ledger complete.
If it fails: missing or vague requirement goes to `product-manager` · a clash with `docs/CORRECTIONS.md` goes to the orchestrator to rule and record · a detail only Ced can give becomes one short question to Ced.

### Gate G2 (UI/UX to Backend & DevOps)
Checks: every FR with a screen has a screen ID and a wireframe · loading, empty, error, success and disabled states exist · only design tokens are used · button and sheet copy says what the code will do · every delete or clear is confirmed or undoable and says exactly what goes · keyboard, 375px and accessibility are covered · Instruction ledger rows each appear on a screen.
If it fails: layout, state or copy defects go to `ui-ux-designer` (which may use the design skills `design:design-critique`, `design:ux-copy`, `frontend-design`) · a missing FR goes back to G1 and `product-manager` with the change recorded.

### Gate G3 (Backend & DevOps to Mobile Developer)
Checks: every FR needing data or a server rule has an entity, endpoint or RPC · migrations are additive · every new table has the owner policy, the MFA restrictive policy, a per-user row cap and tests in `tests/prod/rls-suite.ts` · cost stays $0 and no secret is written down · the number of network requests per tap is budgeted · `qa-engineer` APPROVE for any migration, RLS, delete, money, auth or deploy-config change · Instruction ledger rows that touch data are covered.
If it fails: schema, RLS or migration problems go to `backend-devops-engineer`, then `qa-engineer` reviews again · an API gap that is really a requirement gap goes back to G1.

### Gate G4 (Mobile Developer to QA)
Checks: `npm run verify` and the native type-check pass, and formatting is clean · every FR has a test that was seen failing first, then passing · no placeholders, no `any`, no file over 400 lines · tests read the button copy and the code together so words match behavior · requests per tap match the budget · Instruction ledger rows are implemented, each pointing to a file and a test.
If it fails: code, test or build failures go to `mobile-app-developer` (using systematic debugging, never symptom patches) · a schema or RLS mismatch goes to `backend-devops-engineer` · drift from the design goes back to the design stage · a real conflict with an approved contract is a deviation, and a deviation re-opens G3 (`backend-devops-engineer`, plus `qa-engineer` if risky) before G4 can pass.

### Gate G5a (QA, before anything is pushed)
Checks: every FR and every Instruction ledger row has PASS evidence (command and result) from what can run locally · no Must-have is NOT RUN except what needs the live run, and every Instruction ledger row that waits for it is listed as deferred · live steps in `tests/prod` are written for every user-visible or data-changing feature · `qa-engineer` APPROVE for any migration, RLS, delete, money, auth or deploy-config change · before any native APK is published, `qa-engineer` APPROVE always (every APK, even a UI-only one) · what is not verified (for example "not tested on a phone") is written down. Then **stop and ask Ced** for the yes to push to `main` (it deploys the website). Never push to turn a gate green.
If it fails: a code defect goes to `mobile-app-developer` · a schema or RLS defect to `backend-devops-engineer` · a missing live step to `tester` · a review rejection goes to whoever owns the finding, then `qa-engineer` reviews again · a requirement or design gap goes back to the owning earlier stage (G1 `product-manager` or G2 design) with the change recorded, and every later gate it touches runs again.

### Gate G5b (QA, after Ced's yes and the push)
Checks: the deploy is live on the pushed commit · CI is green · the live run (`prod-qa`) is green, with the pass counts of every suite · each live step written in G5a passed · every Instruction ledger row deferred from G5a now has live PASS evidence · the asset size of an APK uploaded to the saved release `native-0.3` matches the file built (that check itself runs right after any upload to `native-0.3`, whether or not anything was pushed to `main`, and does not wait for this gate) · the Release Readiness Matrix has no NOT RUN for a Must-have, and the recommendation is READY or READY WITH KNOWN LIMITATIONS with the limits listed.
If it fails: `ci-watcher` waits for and reports the CI and live results (never poll in the main thread) · a failing step goes to its owner (code to `mobile-app-developer`, schema or RLS to `backend-devops-engineer`, test to `tester`) and then G4 and G5a run again before the next push.

**Light track.** Gates G1 to G5a run in the same turn and the light track then stops at G5a: it never pushes to `main` without Ced's yes. G5b runs after Ced's yes and the push. Only a failure is mentioned in the report, in one line (what failed, who fixed it, the re-run result), and the full Gate records are in `docs/PROGRESS.md`.

## 8. Universal handoff format
Every stage ends with a separated, copy-ready prompt that names the next stage and role, its objective and deliverable, all upstream specs and decisions, traceability IDs and acceptance criteria, dependencies, assumptions and open issues, project paths and test evidence, and the instruction to execute only that stage and stop. It must work in a new conversation with no hidden context. If a change is needed, name the affected requirements, say why and record the revised decision.
