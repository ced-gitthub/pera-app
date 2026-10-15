# Artifact parity: Stage 2 design handoff (items 1 and 2), condensed

Source: UI/UX Designer agent. Uses only existing artifact classes (.card .pend .row .acts .m .p .lb .flt .tx .tag) and CSS variables. No new colours. Buttons min-height 48px. Destructive button text uses var(--bg). Results use role=status / role=alert.

## Data card (Settings)
- Export: optional From/To (type=date), "Export CSV", result line, separate read-only export box (text selected on focus). Sample entries not exported. Empty: "Nothing to export yet. Add an entry first." / "No entries in that date range. Change From or To."
- Import: paste box, "Check" button, then summary + problems list (max 10, "...and N more") + "Import N rows" button. Native messages verbatim (csvLogic.ts): "N ready to add, N already imported, N with problems (N rows found)." Limits 900,000 chars / 5,000 rows / 50,000 entries. Editing the paste box removes the old summary. Import is all-or-nothing; failure: "Import failed. Nothing was added. Try again." Success: "N added, N skipped as duplicates, N rows with problems."
- Export and import use separate boxes (D2).

## Clear everything (inline .pend.exp panel, no modal, D1)
- Counts line live: "This will clear N transactions (N sample), N budgets, N recurring rules and N starting balances."
- Cleared: every transaction incl. sample, every budget, every recurring rule, every starting balance to 0. Stays: accounts, categories, renames/aliases/keywords, view settings, Recently deleted. Never opens the tour. Other devices cleared on next sync. Undo copy kept 30 days on this device only.
- Typed DELETE (trim, case-insensitive) enables the button; aria-label; helper line; no redraw per keystroke; counts re-read at click; double tap ignored.
- States: Counting, Nothing to clear (no red button), Ready, Working ("Clearing..."), Failure "Nothing was deleted. The undo copy could not be saved on this device..." , Success "Cleared N transactions, N budgets, N rules and N starting balances. Undo is kept for 30 days in Settings."

## Undo clear everything card
- Always visible. Empty: "No undo copy yet. After you clear everything, a copy appears here for 30 days." Rows newest first with date, counts, "kept until D" (warn at 3 days or fewer), Restore with confirm. Restore merges (current wins). Success "Restored ... The copy was removed." Failure keeps the copy.

## Wording
"Reset everything" and "Delete everything?" become "Clear everything". "Clear demo data" becomes "Delete sample records" with a one-step confirm (D4); tag "demo" becomes "Sample". Clears do not use the 6 rotating backups.

## Decisions for Ced (recommendation first)
D1 inline panel (not overlay). D2 separate export/import boxes. D3 button directly under field, no sticky. D4 rename + confirm on Delete sample records now. D5 in-card result line. D6 dark-mode contrast on accent buttons, later pass. D7 (Stage 3) "cleared here, other devices pending" state, and restore treats 0 starting balance as empty.

## Stage 3 handoff
Backend & API Contract: shared fixture CSVs and parser contract (FR-001 to 013), undo-copy storage contract (own key, record shape, 30-day expiry, max 3, write-then-read-back, rollback, single save via existing sync), D7 answer, migration needed (expected none), float pesos stored with centavo parsing (A5). Do not build.
