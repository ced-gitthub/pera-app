PASS [undo storage (tx_trash) — real database] deleting a transaction archives a full copy in tx_trash (DB trigger)
PASS [undo storage (tx_trash) — real database] the archived row can be restored with the same id and amount
PASS [undo storage (tx_trash) — real database] another user cannot read or modify my trash
PASS [undo storage (tx_trash) — real database] anonymous cannot read tx_trash or execute the trigger function
PASS [undo storage (tx_trash) — real database] another user's delete trigger never writes into my trash
PASS [recurring deletion — real database] monthly rule starting 2 months ago generates exactly 3 occurrences
PASS [recurring deletion — real database] running again is idempotent (no duplicates)
PASS [recurring deletion — real database] deleting a generated occurrence does NOT bring it back on the next run
PASS [recurring deletion — real database] the deleted occurrence is archived and restorable, and a later run does not duplicate it
PASS [recurring deletion — real database] future occurrences continue: a later "today" adds the next month only
PASS [recurring deletion — real database] deleting the rule succeeds and preserves every past transaction
PASS [recurring deletion — real database] a deleted rule's old occurrence can still be deleted and restored
PASS [recurring deletion — real database] month-end rule (Jan 31 start) keeps no-drift dates
PASS [recurring deletion — real database] leap-day yearly rule: Feb 29 -> Feb 28 in non-leap years, back to Feb 29 in 2028
PASS [recurring deletion — real database] another user's run_recurring never touches my rules