---
name: pera-live-qa
description: How to write reliable live tests for the deployed Pera app (tests/prod). Use when adding or fixing steps in qa.mjs, security.mjs, responsive.mjs or rls-suite.ts.
---
# Live QA for Pera

Files: `tests/prod/lib.mjs` (helpers), `qa.mjs` (functional), `security.mjs`, `responsive.mjs`, `rls-suite.ts` (real Supabase, publishable key only), `db.mjs`.

## Helpers you must reuse
`step(name, fn)` (return `true` to pass, anything else is the failure detail), `act(page, click)` (click a server action and wait for it), `add(page, text)` (Quick Add), `login/signup/logout`, `flash(page)`, `body(page)`, `newCtx(browser)`, `manila(offsetDays)`. In qa.mjs also `edit()`, `acctRow(name)`, `waitAcct(name)`, `totalOf(page)`, `money(text)`.

## UI facts that break tests if forgotten
- Every tab has Edit mode. Controls (inputs, Save, Delete, Create, Duplicate) are `display:none` until you press `button[aria-pressed="false"]:has-text("Edit")`. Call `edit()` after every `goto`.
- Customize panel: `section[aria-label="Customize Home"]`, switches `label.sw input`, `button[aria-label="Move History up"]`, "Reset to default" then "Yes, reset". Wait ~3.5s after a change (debounced save) before reloading.
- Account rows: `.acct` containing `form[aria-label="Edit <name>"]`. Budget rows: `.mb-3` containing `form[aria-label="Edit <category>"]`.
- Lists re-render a moment after an action answers: poll for the row instead of asserting at once. After an error redirect, `waitForURL(/err=/)` before reading the flash.
- Home blocks: `.blocks h2, .blocks .stat .m`; hero total `.hero .big`; Spendable `[aria-label="Spendable balance"]`.

## Rules
- Compute expected money in integer centavos; compare `Math.round(x*100)`.
- Tests share one user per suite and run in order: later steps may depend on earlier data. Reset what you change (e.g. restore "Show on Home").
- Run `node --check` on the file. The suites run only in GitHub Actions (`prod-qa`); read results from branches `qa-*` (fetch with a forced `+refs/heads/...` refspec).
