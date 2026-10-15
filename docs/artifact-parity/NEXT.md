# Artifact parity: where we are (resume here)

Ced's standing orders: run all stages without asking; use all five pipeline agents; no push to `main` and no artifact republish without QA approval + Ced's yes; final report Problem/Solution/Outcome; $0; never touch `.env*`.

Done: Stage 1 (STAGE1-BLUEPRINT.md), Stage 2 (STAGE2-DESIGN.md), Stage 3 (STAGE3-CONTRACT.md).
In progress: Stage 4 build of items 1 and 2 (CSV parity, Clear everything + Undo) in `artifact/pera-artifact.html`, tests in `tests/artifact-*.test.ts`. Check `git status` / `git log` on branch claude/musing-mclean-26141c for its result.
Next: Stage 5 QA Engineer (opus) review of items 1 and 2 -> fix -> re-review -> republish the artifact at https://claude.ai/artifact/BmDToDFfkqE1BFnRu9weGA from the repo file only after APPROVE.
Then, same full pipeline: items 3 (labelled samples, Keep/Clear, Delete sample records), 4 (unsaved-changes prompt), 5 (tour Skip), 6 (save confirmations + native input limits), and item 7 (make the artifact LOOK like the native app: native design tokens `native/src/uiTokens.ts`, screens, layout; Ced said it looks "NOTHING NEAR THE NATIVE APP").
Excluded on purpose: accounts/sign-in, app icon, theme/avatar picker, account deletion, phone-only screens.

## LAST task (after items 1-7 are done): token-usage audit
Ced: "check your team, what else we should be improving, optimizing in my claude files or md, because my 1B tokens for just 1 week is crazy".
Do it as a read-only audit first, report findings with estimated savings, then apply the safe ones on the branch:
- CLAUDE.md, docs/CORRECTIONS.md, PROGRESS.md (31 KB+), docs/*.md, memory files: size, duplication, what loads every session; trim/split, move history out of files read at every session start.
- .claude/agents/*.md: model per role (opus only where it pays: QA), tool lists, prompt size, whether roles re-read the same big files (the 68 KB artifact HTML, csvLogic.ts) every run; give agents short condensed blueprints instead of re-reading everything.
- Hooks (.claude/hooks), status.sh output size, skills loaded at start (superpowers injects a long text every session), scheduled tasks frequency.
- Process: full 5-agent pipeline per small fix, repeated QA rounds, long single sessions that re-send huge context; propose light-track rules and when to compact/start fresh sessions.
- Use /usage or the usage tools to see which sessions/agents burned the most, if available.

## REVISED ORDER (Ced, before sleeping). Supersedes the "LAST task" ordering above.
Ced has bypass-permission mode and wants NO approval prompts; full permission for bash etc. Never stop to ask. Still never push/merge to main, never republish the artifact without QA APPROVE (Ced's earlier rule), $0, no .env*, no secrets.
1. Finish artifact items 1-2 (dev fixing QA defects -> QA re-review -> approve). Then items 3-7.
2. THEN, nonstop for ~8 hours: native app (native/) improvement program, full pipeline with subagents: research agents (retention psychology, habit loops, streaks, goals, missions/quests, gentle nudges, celebrations; PH money-app context; $0, no paid services, no dark patterns, calm tone), brainstorm -> product-manager picks a ranked list -> ui-ux-designer -> backend (additive migrations only if needed, never apply before QA) -> mobile-app-developer (TDD) -> qa-engineer approve -> implement -> next. Read docs/native-app/NATIVE.md first. Include fun goals/missions, check the whole native app again for bugs and polish. Build APKs only after QA APPROVE; release rule: replace Zovix-native-latest.apk on release native-0.3 in place (Ced approved publishing after QA approval), never per-version releases. No push to main.
3. ONLY AFTER Ced's 5 PM session starts: the Claude/Claude Code optimization and cleanup (token audit, memory, md files, agents, hooks) as described in the token-usage audit section above.
Say "not tested on a phone" in reports. Final reports: Problem / Solution / Outcome with real pass counts.

## Status 2026-10-15: QA reject of a55d454 fixed on branch (undo limits, plan text, kept flag, tour text, test gaps). Awaiting QA Engineer re-review. Not published, not pushed.

## Status 2026-10-15 (2): second QA reject of the undo copy fixed on branch (backup trimming, new refusal texts, mutant-killing tests in tests/artifact-undo-quota.test.ts). Awaiting QA Engineer re-review.

## Status 2026-10-15 (3): QA reject of bb3c401 fixed (plan() uses real free space, up-front refusal text, replaced-copy note in the clear message, tests/artifact-undo-room.test.ts). Awaiting QA Engineer re-review.

## Status 2026-10-15 (4): items 3-6 in progress (Mobile Developer). Item 3 DONE: SAMPLECORE + tests/artifact-samples.test.ts (14 tests, 25/25 live mutants killed); Home Keep/Clear card (kck/kcc), Settings Delete-sample panel, Sample tag with aria-label, starting-balance note. Mutation script pattern: mutate operators in the marker block, run the test file, restore the HTML. Next: item 4 UNSAVEDCORE, 5 INTROCORE, 6 LIMITSCORE + TOAST. Keep each tests file under 400 lines; add every new test file to package.json "test".

## Status (5): item 4 done (unsaved prompt)
UNSAVEDCORE + guard wiring (v, cx, ed, em-Done, Esc, beforeunload) + sheet #us. Tests: tests/artifact-unsaved.test.ts (19), artifact-unsaved-ui.test.ts (9). Mutants 31/32 killed (1 equivalent). 375px browser check: sheet, Keep editing, Discard OK.
Decisions: Done asks when dirty; add-forms (#na, #nc-*) are not dirty-tracked.
Next: item 5 (INTROCORE, offer card, tour, hide Keep/Clear while offer shows), then item 6.

## Status (6): item 5 done (tour offer)
INTROCORE (mt1tour, introState, 7 steps, next/back/skip, flag) + offer card on Home + tour bar #tour (Back/Next-Done/Skip, Esc ends, highlights the tab) + Keep/Clear hidden while the offer shows. tests/artifact-intro.test.ts (13). Mutants 35/35. 375px browser check OK, no horizontal overflow.
Decisions: Home/Add/Transactions/Accounts step texts adapted from native to what the artifact really has (no Spendable/Savings, no Manage/FAB); documented for the copy test (ARTIFACT-ONLY).
Old undo test "no tour in Clear/Undo screens" narrowed to exclude the tour code.
Next: item 6 (LIMITSCORE, toasts, parseFloat removal, tests/artifact-copy.test.ts).

## Status (7): item 6 done (toasts and limits)

- LIMITSCORE (limits, exact amount/date/budget/opening parsing in integer centavos, quick-add `k` by string), TOASTCORE (8 toasts, 2200 ms, replace-old, `role=status`, no animation under reduced motion). `parseFloat` is gone from the file (test-enforced).
- Failure line `Not saved: could not write to this device. Try again.`; saveEntry, addRule, del, rrd, na, dup roll back on a failed save.
- commitBud / commitAcc validate everything before changing anything; a bad value returns the Budget / Opening message. Budget empty or 0 still deletes the budget.
- Money text inputs are now `type=text inputmode=decimal` (e-a, r-a, .ao, .cb). No CSV-import toast (spec says none).
- Tests: tests/artifact-limits.test.ts, artifact-toast.test.ts, artifact-copy.test.ts (native word-for-word, ARTIFACT-ONLY allow-list). Mutants: TOASTCORE 7/7, LIMITSCORE 29/32 (3 equivalent: redundant length guard, trim before sane).
- All items 1-6 done. Remaining for a successor: QA Engineer review, then republish (Ced's yes).

Update: items 3-6 QA reject 2 fixed (redraw guard via KEEPCORE, budget/account save rollback, mutant-killing tests). Awaiting QA re-review; do not republish until APPROVE and Ced's yes.

## Status 2026-10-15 (3): QA reject of 82679b5 (6 defects) fixed on branch. Root cause of 1+2: sync() reloaded the saved screen on every click; sync() now keeps the in-memory screen, kcc and the question path save first. Tour tn/tb prompt only when the tab changes; #na and #nc-* guarded and kept; quick-add delete clears ED. New tests/artifact-wiring.test.ts (real-run tests). Awaiting QA Engineer re-review. Not published, not pushed.

## Status 2026-10-15 (4): QA reject of f7ed2b4 (missing tests) fixed

- New tests/artifact-wiring2.test.ts (10 vm-run tests): tourStep(-1)/Done, tourStep guard via gnav, tourGo screen change + redraw, addAcct force and failed-save rollback, addPending keyword-only, kcc resets Edit mode. 8/8 mutants killed. `any` removed from artifact-wiring.test.ts (uses St).
- Not done (optional): guard-Save toast "Account saved" for a new account; the guard Save does not toast today.

## Status 2026-10-15 (5): items 1-6 LIVE
QA APPROVE at cc6f415, artifact republished as Version 29 (id 1792041783-286e). Not tested on a phone or the claude.ai iframe sync. Next: item 7 (look like the native app) through the 5-agent pipeline.

## Status 2026-10-15 (6): item 7 built on branch (Stage 4), awaiting QA Engineer
Artifact restyled in the native look (Lime Night dark / Daylight light, tokens, emoji tab bar at all widths, banners via eh(), Home hero/tiles/Recent, floating Add `data-a="fab"` focusing #q, centred toast card, sheet and tour bar). New tests/artifact-look.test.ts (6 tests, 18/18 mutants killed). Browser check at 375 and 980 px, dark and light, all 7 tabs: no sideways scroll, every button/select/input/link >= 44 px. Not tested on a phone.
Deviations from ITEM7-DESIGN.md (static markup was off-limits): banners sit as rounded tinted blocks inside the tab card (not full-bleed); Reports and Ask have no banner (no eh() call there); Home has no Edit chip; the old h1 and "Full app" line stay at the top, styled quiet. Not republished, not pushed.
