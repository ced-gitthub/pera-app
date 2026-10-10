PASS [auth: logged-out] logged out / -> redirected away from app
PASS [auth: logged-out] logged out /transactions -> redirected away from app
PASS [auth: logged-out] logged out /accounts -> redirected away from app
PASS [auth: logged-out] logged out /budgets -> redirected away from app
PASS [auth: logged-out] logged out /reports -> redirected away from app
PASS [auth: logged-out] logged out /assistant -> redirected away from app
PASS [auth: logged-out] logged out /settings -> redirected away from app
PASS [auth: logged-out] logged out /export -> redirected away from app
PASS [auth: logged-out] logged out /transactions/00000000-0000-0000-0000-000000000000 -> redirected away from app
PASS [auth: logged-out] logged out /reset -> redirected away from app
PASS [auth: logged-out] /api/health is public and healthy
PASS [auth: logged-out] /api/health leaks no secrets
PASS [auth: logged-out] no test endpoint exists in production (/api/qa returns no data)
PASS [auth: logged-out] /api/health shows only ok+commit publicly
PASS [auth: logged-out] security headers present
PASS [auth: logged-out] financial pages are not cacheable (no-store)
PASS [auth: logged-out] x-powered-by hidden
PASS [auth: logged-out] unknown route (logged out) is gated to login, not an error
PASS [auth: register / login / logout] register: invalid email blocked
PASS [auth: register / login / logout] register: short password blocked
PASS [auth: register / login / logout] register: valid account auto-logs in to dashboard
PASS [auth: register / login / logout] register: duplicate email gives a safe message, no leak
PASS [auth: register / login / logout] session persists across refresh
PASS [auth: register / login / logout] logout lands on /login and dashboard is protected
PASS [auth: register / login / logout] login: wrong password -> safe error, stays on /login
PASS [auth: register / login / logout] login: unknown email gives the same safe error (no account enumeration)
PASS [auth: register / login / logout] login: invalid email format blocked client-side
PASS [auth: register / login / logout] google: login and register offer the button; click heads to Supabase/Google with our callback
PASS [auth: register / login / logout] login: correct credentials -> dashboard
PASS [auth: register / login / logout] invalid/expired session cookie -> redirected to /login, no crash
PASS [auth: password recovery] login page links to Forgot password
PASS [auth: password recovery] forgot: unknown email -> generic confirmation (no enumeration, no leak)
PASS [auth: password recovery] forgot: invalid email blocked
PASS [auth: password recovery] invalid reset link (bad code) -> /forgot with a clear message
PASS [auth: password recovery] expired token_hash link -> /forgot with a clear message
PASS [auth: password recovery] callback rejects open-redirect next=
PASS [auth: password recovery] /reset without a session -> /forgot
PASS [auth: password recovery] reset page with a live session: mismatch + weak rejected, success changes password
PASS [dashboard] first login: empty state (no transactions, first-budget prompt, zero streak)
PASS [dashboard] first login: default accounts and categories seeded
PASS [dashboard] command "undo last" with nothing deleted -> friendly message, nothing changes
PASS [dashboard] command "delete last" with no transactions -> safe message
PASS [dashboard] Quick Add: expense with account (lunch 150 gcash)
PASS [dashboard] Quick Add: income (salary 25000 bpi)
PASS [dashboard] Quick Add: multiple entries in one line
PASS [dashboard] Quick Add: date phrase "yesterday"
PASS [dashboard] Quick Add: unknown label asks income/expense, resolved by "Spent"
PASS [dashboard] Quick Add: uncertain category asks for confirmation, then saves
PASS [dashboard] Quick Add: garbage input -> clear error, nothing saved
PASS [dashboard] Quick Add: duplicate submit (double Enter + double click) saves once
PASS [dashboard] Quick Add: failed save keeps input, offers retry, retry saves exactly once
PASS [dashboard] dashboard: total balance equals Accounts total
PASS [dashboard] dashboard: recent list, streak shows today logged
PASS [dashboard] dashboard: period filters (month/prev/year/prevyear/custom) all render
PASS [dashboard] dashboard: an odd period link still renders Home
PASS [dashboard: commands (delete/undo)] "delete last" removes the newest entry and offers Undo
PASS [dashboard: commands (delete/undo)] "undo last" restores it (does not delete another)
PASS [dashboard: commands (delete/undo)] "undo last" again -> Nothing to undo, count unchanged
PASS [dashboard: commands (delete/undo)] "undo the last transaction" literal phrase works
PASS [dashboard: commands (delete/undo)] delete two, unrelated add, then undo restores the most recently deleted
PASS [transactions] CSV import (30 rows) succeeds
PASS [transactions] CSV re-import of the same text adds nothing
PASS [transactions] CSV re-import as a file adds nothing
PASS [transactions] pagination: >25 rows -> page 1 of 2, Next works
PASS [transactions] search by description
PASS [transactions] search is injection-safe (% _ , ( ) quotes)
PASS [transactions] filter by type (income only / expense only / transfer)
PASS [transactions] filter by category and by account
PASS [transactions] filter by date range
PASS [transactions] sorting: newest, oldest, highest, lowest
PASS [transactions] garbage filter params are ignored safely
PASS [transactions] page beyond last page is empty but safe
PASS [transactions: edit / convert / duplicate / delete] edit expense: amount + description
PASS [transactions: edit / convert / duplicate / delete] convert expense -> income with matching category
PASS [transactions: edit / convert / duplicate / delete] convert with mismatched category is rejected with a clear message
PASS [transactions: edit / convert / duplicate / delete] edit rejects invalid amounts (abc, 0, -5, 1e9999)
PASS [transactions: edit / convert / duplicate / delete] nonexistent transaction -> 404 page, no leak
PASS [transactions: edit / convert / duplicate / delete] malformed transaction id -> safe (404 or friendly), not a 500 with details
PASS [transactions: edit / convert / duplicate / delete] duplicate adds one copy
PASS [transactions: edit / convert / duplicate / delete] delete shows Undo; Undo restores; refresh keeps it
PASS [transactions: edit / convert / duplicate / delete] delete without undo removes it permanently from the list
PASS [accounts] create account with opening balance
PASS [accounts] negative opening balance accepted and shown
PASS [accounts] duplicate account name rejected safely
PASS [accounts] invalid opening balance rejected
PASS [accounts] rename account
PASS [accounts] delete unused account
PASS [accounts] delete an account that has transactions -> blocked with a safe message
PASS [accounts] transfer moves balance, total unchanged, not counted as spending
PASS [accounts] same-account transfer rejected
PASS [accounts] invalid transfer amounts rejected (0, -1, abc)
PASS [accounts] transfer appears in Transactions and can be edited
PASS [budgets] budgets: a category without a budget says so
PASS [budgets] create budget (Transportation 1000) -> shows 0%-ish usage text
PASS [budgets] update budget amount
PASS [budgets] budget >=80% shows "close to the limit"
PASS [budgets] budget exactly 100% shows 100% and not "over budget"
PASS [budgets] budget over 100% shows "over budget" with the right percent
PASS [budgets] invalid budget amounts rejected (abc, -5)
PASS [budgets] budgets page shows progress bars once a budget exists
PASS [budgets] month navigation (previous / next / invalid ym)
PASS [budgets] remove budget (empty amount)
PASS [reports] reports p=month renders without error
PASS [reports] reports p=prev renders without error
PASS [reports] reports p=year renders without error
PASS [reports] reports p=prevyear renders without error
PASS [reports] reports: category totals + account totals + monthly table
PASS [reports] reports: Net equals Income minus Expenses
PASS [reports] reports: empty period shows empty state
PASS [reports] reports: refresh consistency
PASS [reports] reports: garbage custom range handled
PASS [settings] profile name saves and greets on dashboard
PASS [settings] create category
PASS [settings] duplicate category rejected safely
PASS [settings] delete unused category
PASS [settings] delete a used category is blocked safely
PASS [recurring] create monthly rule starting 2 months ago -> 3 occurrences appear on dashboard load
PASS [recurring] reloading the dashboard does not duplicate occurrences
PASS [recurring] deleting a generated occurrence keeps it deleted after dashboard reload (no resurrection)
PASS [recurring] future occurrences still continue (rule still active, next date in the future)
PASS [recurring] undo restores the deleted occurrence (and it is not duplicated by a later load)
PASS [recurring] deleting the rule preserves past transactions
PASS [recurring] bad rule inputs rejected (amount 0, interval 0)
PASS [csv export / import hardening] export: CSV content-type, attachment, no-store, header row
PASS [csv export / import hardening] export: round-trip row count matches transactions total
PASS [csv export / import hardening] malicious CSV: handled safely, bad rows skipped, summary shown, no leak
PASS [csv export / import hardening] malicious CSV: HTML/JS is rendered as text (no dialog, no injected elements)
PASS [csv export / import hardening] export neutralises spreadsheet formulas (=,+,-,@ prefixed with an apostrophe)
PASS [csv export / import hardening] invalid CSV (no header / binary-ish / empty) -> friendly message
PASS [csv export / import hardening] oversize CSV (>900 KB) is refused in the form with a clear message (no upload, no error page)
PASS [csv export / import hardening] oversize CSV pasted as text is also refused cleanly
PASS [csv export / import hardening]   (large import took 3s)
PASS [csv export / import hardening] large import (2,000 rows) completes within the serverless time limit
PASS [csv export / import hardening] large import repeated adds nothing
PASS [csv duplicate semantics (documented behaviour)] changed description on same row is treated as a NEW row (hash includes description)
PASS [csv duplicate semantics (documented behaviour)] same row with only the category changed is skipped (category is not part of the key)
PASS [csv duplicate semantics (documented behaviour)] identical rows inside one file are both imported (legit duplicates), re-import adds none
PASS [csv duplicate semantics (documented behaviour)] a hand-typed identical entry is NOT compared with imports (documented limitation)
PASS [csv duplicate semantics (documented behaviour)] modified statement copy: only the genuinely new rows are added
PASS [csv duplicate semantics (documented behaviour)] transfers import and re-import idempotently; same-account transfer row skipped
PASS [prototype migration UI] migration with no prototype data shows a friendly note
PASS [prototype migration UI] migration with data imports, verifies, and is repeatable
PASS [prototype migration UI] migration with junk data fails safely
PASS [assistant] assistant: supported question (spent on food this month)
PASS [assistant] assistant: income, savings, top category, biggest expenses, comparison, per-account
PASS [assistant] assistant: unsupported question handled gracefully
PASS [assistant] assistant: very long / empty / special input handled
PASS [assistant] assistant: prompt injection stays read-only (no data changed)
PASS [isolation between users] user B cannot open user A's transaction by id
PASS [isolation between users] user B's export and lists contain none of A's data
PASS [isolation between users] user B's accounts are their own seeded defaults (no QA Savings)
PASS [isolation between users] user B cannot act on A's ids via forged server action inputs (edit page of foreign id is 404)
PASS [accounts: options, fees, card payments] edit mode per tab: controls hidden until Edit; Customize only where it applies
PASS [accounts: options, fees, card payments] create "Maya Credit Card" with short name cc
PASS [accounts: options, fees, card payments] short name must be unique across accounts
PASS [accounts: options, fees, card payments] Accounts > Edit shows "Starting balance", the current balance, and a working ± button
PASS [accounts: options, fees, card payments] "transfer 300 from maya to gcash. 15 fee" => a transfer plus a Transfer Fee expense; total drops by exactly the fee
PASS [accounts: options, fees, card payments] "atm fee 18 maya" => ATM Fee, empty description
PASS [accounts: options, fees, card payments] "late fee 500 cc" => Late Fee on Maya Credit Card (by its short name)
PASS [accounts: options, fees, card payments] "lunch 120 maya credit card" picks Maya Credit Card, not Maya
PASS [accounts: options, fees, card payments] fee categories were created before "Other"
PASS [accounts: options, fees, card payments] a fee category in use cannot be deleted
PASS [accounts: options, fees, card payments] "pay cc from maya" pays the full amount owed, shown as "Paid Maya Credit Card" / Card payment
PASS [accounts: options, fees, card payments] "pay cc 5467 from maya" is a transfer for exactly 5,467.00 (the number is not read as a date)
PASS [accounts: options, fees, card payments] card payment is a transfer: not counted as spending, total unchanged
PASS [Home: Spendable, Savings, accounts card] Savings-flagged account is excluded from Spendable (Savings starts at 1,000)
PASS [Home: Spendable, Savings, accounts card] hiding an account on Home does not change Spendable or Total
PASS [Home: Spendable, Savings, accounts card] Home shows Accounts, Spendable, Savings and History (6 newest) by default
PASS [layout is saved per user] hide Savings and move History to the top; a second session of the same user sees it after refresh
PASS [layout is saved per user] a later change in one session reaches the other after refresh (show Savings again)
PASS [layout is saved per user] a second user's layout is separate (defaults: Accounts before History, Savings shown)
PASS [layout is saved per user] totals never depend on the layout (hide everything: balance unchanged; hint with a Customize button)
PASS [layout is saved per user] Reset to default asks first, then restores the default layout (also in the other session)
PASS [layout is saved per user] other tabs keep their own layout: hide a Reports block and it stays hidden after refresh
PASS [security: cross-origin server actions] captured a real server-action request from the browser (probe is valid)
PASS [security: cross-origin server actions] replay with a foreign Origin is rejected and changes nothing
PASS [security: cross-origin server actions] replay with Origin: null is rejected and changes nothing
PASS [security: cross-origin server actions] control: replay with the real Origin is accepted (proves the check is what blocked the others)
PASS [hygiene] no uncaught JS errors during the run
PASS [hygiene] no unexpected browser dialogs (XSS payloads inert)
PASS [hygiene] logout works from every page (sidebar/header)