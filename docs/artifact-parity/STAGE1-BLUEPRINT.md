# Artifact parity: Stage 1 blueprint (items 1 and 2), approved by Ced

Source: Product Manager agent. Ced approved with "go". Items 3 to 6 are queued (see bottom).

## Instruction ledger (verbatim)
- IL-1 "whatever we did in the native app, make ALL the changes to the artifact except of course the obvious (example the account since artifact account is linked to claude)"
- IL-2 "so that CSV can be the same too"
- IL-3 "yes, all 6 but start with 1 and 2"
- IL-6 standing corrections: "Clear / delete all means ALL"; leftovers that undo the action are bugs; never delete data silently; typed DELETE for bulk deletes; clearing data never sends the person back into the first-run tutorial.
- Ced, 2026-10-15: use ALL five pipeline agents for every app change.

## Artifact today (observed in the HTML)
- Export header `id,date,type,amount,category,description,notes,account,to` (extra id column, "to"); amounts via toFixed(2); sample rows exported; no range, no row cap.
- Import expects the id layout; amount via parseFloat (so "1,250.50" imports as 1.00: a bug); no sane-date check; unknown accounts are auto-created; unknown categories silently become Other; errors are only "skipped invalid rows 3, 7"; no Check step; no row cap; one save per row (partial import possible).
- "Reset everything": one-click confirm, erases everything including accounts and categories, continues even if the backup cannot be saved; only 6 rotating backups (key mt1bk).
- "Clear demo data": no confirmation, no undo.

## Required: item 1, CSV identical to the native app
- FR-001 header exactly `date,type,amount,category,description,notes,account,to_account`, every cell quoted, "\n" line breaks, no id column, transfers use category `Transfer`.
- FR-002 amounts from integer centavos as `whole.dd`.
- FR-003 formula guard for `= + - @ TAB CR`, stripped again on import.
- FR-004 sample rows are not exported; an empty export says so.
- FR-005 (Should) optional From/To boxes (native checkExportRange wording), cap 50,000 rows with a clear message.
- FR-006 import accepts the old `id,date,type,amount,...,to` layout (drop column 0, `to` becomes `to_account`).
- FR-007 two steps, Check then Import. Check says `N ready to add, N already imported, N with problems (N rows found).` then the first 10 problems as `Row N: <reason>` then `...and N more`.
- FR-008 limits 900,000 characters and 5,000 rows with the native messages.
- FR-009 native amount rules: commas stripped, at most 2 decimals, one decimal point, 0.01 to 999,999,999.99; otherwise `Amount must be 0.01 to 999,999,999.99, with at most 2 decimals (like 1250.50).` Never parseFloat on file text.
- FR-010 native per-row messages verbatim: real date, sane date (2000 to five years ahead), type, account matched by name or alias (case-insensitive) and stored canonical, unknown account is a row error (no auto-create), blank account uses Cash or the first account, transfer needs a different known to_account, unknown category falls back to Other / Other Income, description max 120, notes 500, account 40.
- FR-011 dedupe key `date|type|amount_minor|account|to_account|desc.trim().toLowerCase()#i` with i from 0, same as native; one-time migration of old `ih` keys so re-importing an old file does not duplicate.
- FR-012 all-or-nothing import with one save and rollback on storage failure.
- FR-013 shared fixture CSVs prove native and artifact give the same counts, messages and hashes.

## Required: item 2, clear everything means everything
- FR-020 clears every transaction (including sample), every budget, every recurring rule, every opening balance (to 0); rules first so nothing regenerates.
- FR-021 keeps accounts list, categories, aliases, keywords, renames, view settings, the existing Recently deleted; never returns to the tour.
- FR-022 confirm sheet shows live counts (`N transactions (N sample), N budgets, N recurring rules, N starting balances`), says other devices are cleared too, says an undo copy is kept 30 days.
- FR-023 typed DELETE (trim, case-insensitive) enables the button; button disables while working; input has an aria-label; if nothing to clear it says "Nothing to clear".
- FR-024 undo copy written and read back before deleting; if it cannot be saved, nothing is deleted and the message says "Nothing was deleted".
- FR-025 undo copy in its own storage key (not the 6 rotating backups), timestamped, removed after 30 days or after a successful restore; up to 3 copies.
- FR-026 Settings card "Undo clear everything" with date, counts, expiry; confirmation to restore; restore merges (current wins where an item exists).
- FR-027 result line `Cleared N transactions, N budgets, N rules and N starting balances. Undo is kept for 30 days in Settings.`
- FR-028 clear and restore go through the existing sync with one save.
- FR-029 (Should) rename the button to "Clear everything"; copy must match what the code clears.

## Acceptance criteria
AC-1 header exact. AC-2 export then import reproduces rows. AC-3 fixture parity. AC-4 "1,250.50" gives 125050. AC-5 bad amounts give the exact native message. AC-6 formula round trip lossless. AC-7 old layout imports. AC-8 unknown account is a row error naming it. AC-9 same file twice adds 0. AC-10 old ih migrated. AC-11 5,001 rows blocked. AC-12 storage failure adds 0. AC-13 button disabled until DELETE; counts equal real counts. AC-14 after clear everything is empty/0, accounts and categories kept, no tour. AC-15 failed copy save means 0 deletions. AC-16 undo restores exact counts; older than 30 days gone; survives 10 backup rotations. AC-17 double tap clears once. AC-18 runRec adds nothing after clear. AC-19 copy text matches code. AC-20 375 px, keyboard, all four states.

## Assumptions (Ced may overrule)
A1 clear keeps accounts and categories (as native). A2 unknown account in import is an error row. A3 undo copy is device-only (cannot be recovered if browser data is cleared). A4 no goals in the artifact. A5 storage stays float pesos, all parsing and formatting through integer centavos.

## Backlog after items 1 and 2
3 labelled samples + Keep/Clear question + permanent Delete sample records. 4 unsaved-changes prompt on edit forms. 5 Skip on the first-run tour, nothing forced on a returning user. 6 save confirmations and the native input limits everywhere.
