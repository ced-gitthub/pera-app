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
PASS [auth: logged-out] /api/qa without token is 404
PASS [auth: logged-out] /api/qa with a wrong token is 404
PASS [auth: logged-out] security headers present
PASS [auth: logged-out] financial pages are not cacheable (no-store)
PASS [auth: logged-out] x-powered-by hidden
FAIL [auth: logged-out] unknown route gives a clean 404 — 200
PASS [auth: register / login / logout] register: invalid email blocked
PASS [auth: register / login / logout] register: short password blocked
PASS [auth: register / login / logout] register: valid account auto-logs in to dashboard
PASS [auth: register / login / logout] register: duplicate email gives a safe message, no leak
PASS [auth: register / login / logout] session persists across refresh
PASS [auth: register / login / logout] logout lands on /login and dashboard is protected
PASS [auth: register / login / logout] login: wrong password -> safe error, stays on /login
PASS [auth: register / login / logout] login: unknown email gives the same safe error (no account enumeration)
PASS [auth: register / login / logout] login: invalid email format blocked client-side
PASS [auth: register / login / logout] login: correct credentials -> dashboard
PASS [auth: register / login / logout] invalid/expired session cookie -> redirected to /login, no crash
PASS [auth: password recovery] login page links to Forgot password
PASS [auth: password recovery] forgot: unknown email -> generic confirmation (no enumeration, no leak)
PASS [auth: password recovery] forgot: invalid email blocked
PASS [auth: password recovery] invalid reset link (bad code) -> /forgot with a clear message
PASS [auth: password recovery] expired token_hash link -> /forgot with a clear message
PASS [auth: password recovery] callback rejects open-redirect next=
PASS [auth: password recovery] /reset without a session -> /forgot
FAIL [auth: password recovery] reset page with a live session: mismatch + weak rejected, success changes password — page.fill: Timeout 20000ms exceeded.
PASS [dashboard] first login: empty state (no transactions, first-budget prompt, zero streak)
PASS [dashboard] first login: default accounts and categories seeded
FAIL [dashboard] command "undo last" with nothing deleted -> friendly message, nothing changes — ₱
Pera
Dashboard
Transactions
Accounts
Budgets
Reports
Assistant
Settings
Log out

Good evening, QA Tester 👋

Total balance
₱0.00
▲ ₱0.00 this month
🔥 Log today to start a streak

One quick entry st
PASS [dashboard] command "delete last" with no transactions -> safe message
FAIL [dashboard] Quick Add: expense with account (lunch 150 gcash) — 🎉 Logged! Filed under Food.
FAIL [dashboard] Quick Add: income (salary 25000 bpi) — no income line
PASS [dashboard] Quick Add: multiple entries in one line
FAIL [dashboard] Quick Add: date phrase "yesterday" — 🎉 Logged! Filed under Food.
PASS [dashboard] Quick Add: "last friday" style phrase accepted
PASS [dashboard] Quick Add: unknown label asks income/expense, resolved by "Spent"
PASS [dashboard] Quick Add: uncertain category asks for confirmation, then saves
PASS [dashboard] Quick Add: garbage input -> clear error, nothing saved
FAIL [dashboard] Quick Add: duplicate submit (double Enter + double click) saves once — 0
FAIL [dashboard] Quick Add: failed save keeps input, offers retry, retry saves exactly once — locator.waitFor: Timeout 30000ms exceeded.
PASS [dashboard] dashboard: total balance equals Accounts total
PASS [dashboard] dashboard: recent list, streak shows today logged
PASS [dashboard] dashboard: period filters (month/prev/year/prevyear/custom) all render
PASS [dashboard] dashboard: last month with no data shows empty spending state
FAIL [dashboard: commands (delete/undo)] "delete last" removes the newest entry and offers Undo — {"ok":false,"n":9,"nBefore":9}
PASS [dashboard: commands (delete/undo)] "undo last" restores it (does not delete another)
FAIL [dashboard: commands (delete/undo)] "undo last" again -> Nothing to undo, count unchanged — {"n":9,"nBefore":9,"t":"₱\nPera\nDashboard\nTransactions\nAccounts\nBudgets\nReports\nAssistant\nSettings\nLog out\n\nGood evening, QA Tester 👋\n\nTotal balance\n₱22,076.00\n▲ ₱22,076.00 t"}
PASS [dashboard: commands (delete/undo)] "undo the last transaction" literal phrase works
PASS [dashboard: commands (delete/undo)] delete two, unrelated add, then undo restores the most recently deleted
FAIL [transactions] CSV import (30 rows) succeeds — page.waitForURL: Timeout 90000ms exceeded.
FAIL [transactions] CSV re-import of the same text adds nothing — page.waitForURL: Timeout 90000ms exceeded.
FAIL [transactions] CSV re-import as a file adds nothing — page.waitForURL: Timeout 90000ms exceeded.
FAIL [transactions] pagination: >25 rows -> page 1 of 2, Next works — page 1 of 1
FAIL [transactions] search by description — []
FAIL [transactions] search is injection-safe (% _ , ( ) quotes) — '; drop table transactions;--
PASS [transactions] filter by type (income only / expense only / transfer)
PASS [transactions] filter by category and by account
PASS [transactions] filter by date range
PASS [transactions] sorting: newest, oldest, highest, lowest
PASS [transactions] garbage filter params are ignored safely
FAIL [transactions] page beyond last page is empty but safe — 500
FAIL [transactions: edit / convert / duplicate / delete] edit expense: amount + description — locator.click: Timeout 20000ms exceeded.
FAIL [transactions: edit / convert / duplicate / delete] convert expense -> income with matching category — locator.click: Timeout 20000ms exceeded.
FAIL [transactions: edit / convert / duplicate / delete] convert with mismatched category is rejected with a clear message — locator.click: Timeout 20000ms exceeded.
FAIL [transactions: edit / convert / duplicate / delete] edit rejects invalid amounts (abc, 0, -5, 1e9999) — locator.click: Timeout 20000ms exceeded.
PASS [transactions: edit / convert / duplicate / delete] nonexistent transaction -> 404 page, no leak
PASS [transactions: edit / convert / duplicate / delete] malformed transaction id -> safe (404 or friendly), not a 500 with details
FAIL [transactions: edit / convert / duplicate / delete] duplicate adds one copy — locator.click: Timeout 20000ms exceeded.
FAIL [transactions: edit / convert / duplicate / delete] delete shows Undo; Undo restores; refresh keeps it — locator.click: Timeout 20000ms exceeded.
FAIL [transactions: edit / convert / duplicate / delete] delete without undo removes it permanently from the list — locator.click: Timeout 20000ms exceeded.
FAIL [accounts] create account with opening balance — 
FAIL [accounts] negative opening balance accepted and shown — locator.fill: Timeout 20000ms exceeded.
FAIL [accounts] duplicate account name rejected safely — locator.fill: Timeout 20000ms exceeded.
FAIL [accounts] invalid opening balance rejected — locator.fill: Timeout 20000ms exceeded.
FAIL [accounts] rename account — locator.fill: Timeout 20000ms exceeded.
FAIL [accounts] delete unused account — locator.click: Timeout 20000ms exceeded.
FAIL [accounts] delete an account that has transactions -> blocked with a safe message — locator.click: Timeout 20000ms exceeded.
FAIL [accounts] transfer moves balance, total unchanged, not counted as spending — locator.getAttribute: Timeout 20000ms exceeded.
FAIL [accounts] same-account transfer rejected — locator.getAttribute: Timeout 20000ms exceeded.
FAIL [accounts] invalid transfer amounts rejected (0, -1, abc) — {"v":"0","fl":""}
FAIL [accounts] transfer appears in Transactions and can be edited — no transfer row
PASS [budgets] budget empty state on dashboard for a category without budget
FAIL [budgets] create budget (Transportation 1000) -> shows 0%-ish usage text — locator.innerText: Timeout 20000ms exceeded.
FAIL [budgets] update budget amount — locator.innerText: Timeout 20000ms exceeded.
FAIL [budgets] budget >=80% shows "close to the limit" — locator.innerText: Timeout 20000ms exceeded.
FAIL [budgets] budget exactly 100% shows 100% and not "over budget" — locator.innerText: Timeout 20000ms exceeded.
FAIL [budgets] budget over 100% shows "over budget" with the right percent — locator.innerText: Timeout 20000ms exceeded.
FAIL [budgets] invalid budget amounts rejected (abc, -5) — {"v":"abc","fl":""}
FAIL [budgets] dashboard shows budget progress once a budget exists — no budgets block
FAIL [budgets] month navigation (previous / next / invalid ym) — {"h0":"Budgets · 2026-10","h1":"Budgets · 2026-09","h2":"Budgets · 2026-09"}
FAIL [budgets] remove budget (empty amount) — locator.innerText: Timeout 20000ms exceeded.
PASS [reports] reports p=month renders without error
PASS [reports] reports p=prev renders without error
PASS [reports] reports p=year renders without error
PASS [reports] reports p=prevyear renders without error
PASS [reports] reports: category totals + account totals + monthly table
PASS [reports] reports: totals match dashboard for the same period
PASS [reports] reports: empty period shows empty state
PASS [reports] reports: refresh consistency
PASS [reports] reports: garbage custom range handled
FAIL [settings] profile name saves and greets on dashboard — name not shown
FAIL [settings] create category — 
FAIL [settings] duplicate category rejected safely — page.fill: Timeout 20000ms exceeded.
FAIL [settings] delete unused category — page.click: Timeout 20000ms exceeded.
FAIL [settings] delete a used category is blocked safely — 
FAIL [recurring] create monthly rule starting 2 months ago -> 3 occurrences appear on dashboard load — 0
FAIL [recurring] reloading the dashboard does not duplicate occurrences — 0
FAIL [recurring] deleting a generated occurrence keeps it deleted after dashboard reload (no resurrection) — locator.click: Timeout 20000ms exceeded.
FAIL [recurring] future occurrences still continue (rule still active, next date in the future) — ₱
Pera
Dashboard
Transactions
Accounts
Budgets
Reports
Assistant
Settings
Log out
Profile & currency

pera-qa-1791467763198-a@example.com · Currency: PHP (₱), fixed in this version

Save
Categories
in
FAIL [recurring] undo restores the deleted occurrence (and it is not duplicated by a later load) — 0
FAIL [recurring] deleting the rule preserves past transactions — locator.click: Timeout 20000ms exceeded.
FAIL [recurring] bad rule inputs rejected (amount 0, interval 0) — 
PASS [csv export / import hardening] export: CSV content-type, attachment, no-store, header row
PASS [csv export / import hardening] export: round-trip row count matches transactions total
FAIL [csv export / import hardening] malicious CSV: handled safely, bad rows skipped, summary shown, no leak — page.waitForURL: Timeout 90000ms exceeded.
PASS [csv export / import hardening] malicious CSV: HTML/JS is rendered as text (no dialog, no injected elements)
PASS [csv export / import hardening] export neutralises spreadsheet formulas (=,+,-,@ prefixed with an apostrophe)