# Artifact parity items 3-6: condensed Stage 1 + 2 + 3 spec

Roles played by the orchestrator in one pass (no subagents run for this file). Ced's standing order: no approval stops, no questions. Not tested on a phone. Cost $0. No migration, no Supabase, no RLS change: the artifact stores in claude.ai `window.claude.use('db')` + localStorage. Artifact file: `artifact/pera-artifact.html` (publish only after QA APPROVE and Ced's yes, per NEXT.md).

## STAGE 1: Blueprint

### Instruction ledger (Ced's verbatim words, re-check at every gate)
- IL-1 "whatever we did in the native app, make ALL the changes to the artifact except of course the obvious (example the account since artifact account is linked to claude)"
- IL-3 "yes, all 6 but start with 1 and 2" (this file = 3, 4, 5, 6)
- IL-4 "Unsaved changes are never lost silently. Done / Close / Back on anything editable asks Save, Discard or Keep editing when there are changes."
- IL-5 "A removal option people asked for must stay reachable. 'Delete sample records' lives permanently in Settings > Help (shown while sample entries exist), not only in a prompt that appears once."
- IL-6 "Apply a rule everywhere, not on one screen." List EVERY screen, change all, test each.
- IL-7 "A save must be unmistakable." (centred pop-out card with a check, announced to screen readers)
- IL-8 "Clearing data never sends the person back into the first-run tutorial."
- IL-9 "Tutorial/tour: short and instant. At most 7 steps, one or two short sentences each (150 characters)."
- IL-10 "Never delete data silently"; "Check my work against Ced's wording"; "Use ALL five pipeline agents".
- IL-11 Excluded: accounts/sign-in, app icon, theme/avatar, account deletion, phone-only screens.

### Gap analysis (artifact today vs native)
- Samples: 6 seeded rows tagged `<span class="tag">Sample</span>` (`x.demo`), `S.fresh=1`; "Delete sample records" exists (data card, data-a `sd`/`sdc`, shown only while samples exist). Missing: native confirm wording, Keep/Clear question, sample note on starting balances, aria text for the tag.
- Unsaved: no dirty tracking at all. Entry editor (`ok`), recurring form (`rra`), account/category Edit mode ("Tap Done to save"), budgets, starting balances, CSV paste box all close or switch tab and silently drop edits.
- First run: no tour, no wizard, nothing forced (S.fresh only decides seed data + the "Loading your data" wait). Native has TourChoice, TabTour with Skip, isReturningAccount.
- Input limits: `parseFloat` on typed text in quick add (lines ~111, 129, 135, 141), budgets (~376), starting balances (~387), entry edit (`ok` ~434), rule form (`rra` ~440), `neg` (~445). Length limits missing on description/notes/account (categories have maxlength 30). No `isSane` date check on edit and rule forms. No save toasts; one failure path throws a raw error.

### Requirements (Must unless noted; AC in brackets)
- FR-030 Samples stay labelled: visible tag text "Sample" plus `aria-label` "Sample record" on every row (Home, Transactions, search); labelled in edit form header "Sample record". [AC-30]
- FR-031 Keep/Clear question card on Home while samples exist and it is unanswered. Keep = hide the card for good, samples stay. Clear = opens the item-2 Clear everything panel (typed DELETE, undo copy). [AC-31]
- FR-032 "Delete sample records" permanent in Settings > Data while samples exist, native wording below, removes only `demo` rows, never touches own entries/budgets/goals; save failure rolls back with the native fail text. [AC-32]
- FR-033 Starting-balance editor shows the native sample note while samples exist; balances typed there never count sample movement (sample rows excluded from `bal()` preview text only: no change to totals logic). [AC-33]
- FR-040 Unsaved-changes prompt (Save / Discard / Keep editing) on every editable form listed in the screen table. [AC-40]
- FR-050 First-run offer (not a modal, never blocks): one card on Home with Start the tour / Not now; a Skip button on every tour step; Esc and Skip end it. Returning users and anyone with own data never see it. [AC-50]
- FR-060 Save confirmation pop-out ("Entry saved" etc.) after every successful save, error text after a failed one. [AC-60]
- FR-061 Native input limits everywhere (table below), integer-centavo parsing, no `parseFloat` on typed text. [AC-61]

### Acceptance criteria (each needs a named test)
AC-30 every demo row renders tag + aria. AC-31 Keep hides card and persists; Clear opens panel, does not delete by itself. AC-32 confirm text exact; cancel deletes 0; confirm removes exactly the demo rows; failed save restores them. AC-33 note visible only with samples. AC-40 per form: untouched = no prompt; typed-then-reverted = no prompt; changed = prompt; Keep editing keeps values; Discard restores originals; Save validates and closes only on success; tab switch/Done/Cancel/Esc all ask. AC-50 returning (own data, or flag set, or S.fresh=0) = state `done`, no card; Skip at any step ends and marks done; nothing else is blocked while the card is open. AC-60 one toast per successful save, none on failure, `role="status"`. AC-61 table below, boundaries 0.00, 0.01, 999,999,999.99, 1,000,000,000, 3 decimals, "1,250.50", "1e5", "-5", description 120/121, notes 500/501, account 40/41, dates 1999-12-31 / 2000-01-01 / year+5 / year+6.

### Assumptions (decided for Ced; he may overrule later)
- D1 Keep/Clear question appears once per device (flag `mt1sq`, device-only localStorage, not synced). D2 Tour is optional and device-only (flag `mt1tour`). D3 No "tour with/without sample" choice: samples always exist on first run, so the offer is just Start the tour / Not now. D4 Storage stays float pesos (A5); new parsing goes through integer centavos at the boundary. D5 Native goal screens do not exist in the artifact (A4): no goal toasts/limits. D6 Account name limit 40 (native task spec); category name stays 30 (stricter, already shipped).

## STAGE 2: Design (states, copy, 375px)

Reuse existing classes: `.card`, `.pend exp` (inline sheets), `.acts`, `.tag`, `.m`, buttons with `data-a`. No new colours; use existing CSS variables only. All new controls min 44px tall, wrap at 375px, labels or `aria-label`, focus visible, Esc closes.

### Copy (verbatim from native unless marked ARTIFACT-ONLY)
- Unsaved sheet: title `Save your changes?` (UNSAVED_TITLE); text `You changed something but have not saved it yet.` (UNSAVED_TEXT_ANY); buttons in order `Keep editing`, `Discard`, `Save` (primary = Save; Keep editing is the default/focused one).
- Delete samples confirm (Settings.tsx): title `Delete sample records?`; text `This deletes the N sample entries (the ones labelled "Sample:"). Your own entries, budgets and goals stay.` (singular `entry` when N=1); buttons `Keep them`, `Delete sample records`; success `Sample records deleted.`; failure `Could not clear the sample entries. They are still there. Try again.` ARTIFACT-ONLY difference: the label is the tag "Sample", so the text says `labelled "Sample"` (quotes without colon). Button label in Settings: `Delete sample records`.
- Keep/Clear card (adapted from TOUR_END, ARTIFACT-ONLY body): title `Keep the sample entries?`; body `Zovix added sample entries so every screen has something to show. They count in your balances until you clear them. Keep everything, or clear everything (sample entries, budgets, recurring rules and starting balances) and use an empty app. Your accounts and categories stay.`; buttons `Keep everything`, `Clear everything` (TOUR_END_KEEP / TOUR_END_CLEAR). `Clear everything` opens the existing item-2 panel (typed DELETE; button text there stays `Clear everything`; native confirm label `Yes, delete everything` is NOT used because item 2 is already QA-approved).
- Starting-balance sample note: `The sample entries are added on top of this until you clear them.`
- Tour offer (TourChoice, no sample variant): title `Take a quick tour?`; body `The tour walks through each tab using what is in your app now.`; buttons `Start the tour`, `Not now`. Steps: <= 7, text <= 150 chars each, from native `tourContent.ts` for Home, Add an entry, Activity (Transactions), Accounts, and ARTIFACT-ONLY short texts for Budgets, Reports, Ask. Each step has `Back`, `Next`, `Skip` (aria-label `Skip the tour`); last step `Next` becomes `Done`.
- Toasts (native): `Entry saved`, `Entry deleted`, `Budget saved`, `Budget deleted`. ARTIFACT-ONLY: `Starting balances saved`, `Account saved`, `Rule saved`, `Rule deleted`, `Entries imported` (CSV already has its own result line, no toast there). Failure line: `Not saved: could not write to this device. Try again.` (native pattern "Not saved: ...").
- Validation messages (native logic.ts / manageLogic.ts / money.ts, verbatim): amount `Amount must be 0.01 to 999,999,999.99, with at most 2 decimals.`; date `Use a real date like 2026-10-14 (between the year 2000 and five years from now).`; budget `Type the monthly limit as a number above 0, like 3000.`; starting balance `The starting balance is not a valid amount. Use numbers like 1500 or -250.50, or leave it empty for 0.`; quick add over-long text is cut at 500 characters (native `slice(0, 500)`).

### Screen / state table (every place the rules apply, IL-6)
| ID | Screen | Dirty means | Save does | Toast |
|---|---|---|---|---|
| SCR-1 | Entry editor (`ok`) | any of amount, date, desc, notes, category, account, type differs from the opened values (trimmed) | validate (limits) then save | Entry saved |
| SCR-2 | Entry delete / duplicate | n/a | n/a | Entry deleted (undo kept) |
| SCR-3 | Recurring rule form (`rra`, new + edit) | any field differs from the opened/blank values | validate then save | Rule saved / Rule deleted |
| SCR-4 | Accounts Edit mode (rename, opening balances, new account) | any `.ao` / name / new-account box differs | validate all, one save | Account saved / Starting balances saved |
| SCR-5 | Categories Edit mode (name, words, budget) | any field differs | validate all, one save | Budget saved / Budget deleted when budget set to empty |
| SCR-6 | Budgets tab inline budget inputs | value differs from `defaultValue` | validate then save | Budget saved |
| SCR-7 | Quick add / Ask box | NOT guarded (native QuickAdd is a one-shot, not a sheet); limit 500 | n/a | Entry saved (via add) |
| SCR-8 | CSV paste box (Settings) | text pasted and not imported (native csvMineLogic rule) | Import | none (own result line) |
| SCR-9 | Home first-run card, Keep/Clear card | n/a | n/a | n/a |
Triggers that must ask when dirty: Done, Cancel, close X, Esc, any bottom/top tab click, entering another edit form, `beforeunload` (browser-default text; cannot be customised). States per screen: idle, dirty, saving (button disabled, `<Btn>`-style), error (inline, says what to fix, focus moves to first bad field), success (toast). Empty/loading states unchanged. 375px: unsaved sheet is a full-width `.pend` card pinned above the keyboard area, buttons stacked, Save last in DOM order but visually primary.

### Limits (LIMITSCORE constants, same numbers as native)
| Field | Rule |
|---|---|
| description | max 120 (input `maxlength=120`, and `slice` on save) |
| notes | max 500 |
| account name | max 40 (new + rename) |
| category name | max 30 (unchanged) |
| amount (entry, rule, import) | `amtMinor`: commas stripped, one dot, <= 2 decimals, 0.01..999,999,999.99 |
| budget limit | `amtMinor` and > 0 |
| starting balance | signed `amtMinor` allowing `-`, empty = 0, |value| <= 999,999,999.99 |
| date | `isSane`: 2000-01-01..(year+5)-12-31 |
| quick add text | 500 chars |

## STAGE 3: Contract (no code here; for the Mobile Developer)

Pure, DOM-free marker blocks like `/*CSVCORE:BEGIN*/../*CSVCORE:END*/`; tests slice them and eval in `node:vm` with injected env `{S,store,save,now}` (same harness as `tests/artifact-csv*.test.ts`, `artifact-undo*.test.ts`). Reuse `amtMinor`, `isSane`, `fmtMinor` from CSVCORE (do not duplicate).

- `SAMPLECORE`: `sampleCount(tx)`, `sampleText(n)` (the native confirm text, singular/plural), `deleteSamples(env)` -> `{ok,removed,message}` (filter `demo`, set `S.fresh=0`, one `save()`, roll back + native fail text on failure; if `STORE_OK` false same), `keepAnswer.read/write(store)` (flag `mt1sq`, try/catch), `showKeepClear({samples, answered})` = samples>0 && !answered.
- `UNSAVEDCORE`: `snap(fields)` (trim strings, normalise numbers via amtMinor so `5` == `5.00`), `isDirty(initial,current)`, `onClose(dirty)` -> `'ask'|'close'` (port of `promptOnClose`), `buttons()` returns the three labels in native order. One module-level `GUARD={open,initial,read(),save()}`; `guardedNav(fn)` runs `fn` only if clean, else shows the sheet; Save runs the form validator and closes only when it returns true. `beforeunload` registered only while dirty.
- `INTROCORE`: `introState({fresh, ownData, flag})` -> `'offer'|'done'` (ownData = any non-demo tx, trash, rule, budget or nonzero opening balance; any of those, or `mt1tour` set, or `fresh=0` => `done`); `tourSteps()` (<= 7, each text <= 150); `next/back/skip(i)` pure index functions; Skip and Not now both write `mt1tour=1`. Never calls `draw()` blocking, never alters data. Reading the flag throwing = treat as `done` (nothing forced).
- `LIMITSCORE`: `MAXDESC, MAXNOTES, MAXACCT, MAXQUICK`, `clip(s,n)`, `parseAmount(s)` (amtMinor + native message), `parseBudget`, `parseOpening` (signed), `parseDate(s,today)` (isSane + message). Replace every `parseFloat(...)` on typed text in: quick-add parser tokens (use the digit string -> minor, `k` multiplier in integer minor: `minor*1000`), `bd.value` (~376), `p.op.value` (~387), `#e-a` (~434), `#r-a` (~440), `neg` (~445). `Math.round(x*100)/100` may remain only to convert already-validated minor to the stored peso float (`minor/100`).
- `TOAST`: `toast(text)` writes one `<div role="status" aria-live="polite" class="toast">` (centred card with check, existing colour vars, 2.2 s, replaces any previous, `prefers-reduced-motion` = no animation); called after `save()` returned true; never on failure. Failure path replaces `throw new Error(...)` surfaces with the `Not saved: ...` line.
- Sync/storage: samples and flags are not synced (flags device-only keys `mt1sq`, `mt1tour`, never in `toRecs`). Deleting samples keeps today's `toRecs` behaviour (demo rows are not pushed, `line 480`). Own-data flows unchanged.

### Test plan (all must be real counts; test first; mutants required)
- `tests/artifact-samples.test.ts`: AC-30..33 (text exact, singular/plural, only demo removed, failed save rollback, Keep persists, flag read throwing).
- `tests/artifact-unsaved.test.ts`: AC-40 per SCR-1,3,4,5,6,8 (untouched/revert/changed, 5 vs 5.00, whitespace-only change = clean, Keep editing/Discard/Save, Save with invalid values stays open, double Save adds once).
- `tests/artifact-intro.test.ts`: AC-50 (returning user combinations, flag throw, Skip at every step, <= 7 steps, <= 150 chars, no mutation of `S`).
- `tests/artifact-limits.test.ts`: AC-61 every row of the limits table at both boundaries, plus a source-scan test: no `parseFloat(` inside the four marker blocks, and the named handlers contain none.
- `tests/artifact-toast.test.ts`: one toast per success, none on save failure, role attribute present.
- Copy test (CORRECTIONS rule "test the copy against the code"): reads each native string from `native/src/*.ts` and asserts the artifact constants match (except the ARTIFACT-ONLY lines above, listed in the test as an allow-list).
- Manual pass at G5 in a real browser (claude-in-chrome) at 375px: each SCR row, keyboard only, Esc, tab switch while dirty, reload mid-tour, fresh and returning profile. NOT VERIFIABLE: two-device sync, a phone.
- Gates: `npm run verify`, format, ESLint ratchet (no new `any`, files < 400 lines: the HTML is a single file, so keep each new core under ~60 lines), QA Engineer (opus) APPROVE before any republish. This is a deletion + money-parsing change, so the independent review is required.

### Risks
1. Single 538-line minified-style HTML: edits to the editor handlers (`ok`, `rra`, Edit mode) can regress item 1/2 flows; re-run all 12 artifact test files at each gate.
2. Unsaved guard hooks every nav; a bug could trap the user. Mitigation: Discard always works, Esc = Keep editing, guard only while `GUARD.open`.
3. `beforeunload` is ignored inside the claude.ai iframe in some browsers; the in-page sheet is the real protection.
4. Float-peso storage means "1,250.50" is exact only through `minor/100`; sums elsewhere unchanged (known, A5).
5. Quick-add parser is a hand port; changing its number parse can alter what it understands. Keep a before/after fixture of 30 phrases and require identical results except the fixed comma/decimal cases.
6. Native has no category-name limit constant found in `manageLogic.ts` quick scan; Mobile Developer must confirm and align (D6).
7. Sample label differs (tag vs "Sample:" prefix) by design; copy says "labelled Sample".

### Stage 4 handoff
Mobile Developer: implement SAMPLECORE, UNSAVEDCORE, INTROCORE, LIMITSCORE, TOAST in that order, test first; one commit per item; do not republish. Then QA Engineer with this file + IL list.
