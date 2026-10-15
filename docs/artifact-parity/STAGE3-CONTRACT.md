# Artifact parity: Stage 3 backend contract (items 1 and 2), condensed

No migration, no Supabase change, no RLS change, $0. Artifact db = claude.ai `window.claude.use('db')` (LWW by ts, tombstone `{v:null}`). R5 decided: undo does NOT restore sample records (message says so).

## Repo layout
- Commit the artifact as `artifact/pera-artifact.html` (publish only from this file). Add to prettier/eslint ignores if needed.
- Pure marker blocks, no DOM: `/*CSVCORE:BEGIN*/../*CSVCORE:END*/` and `/*UNDOCORE:BEGIN*/../*UNDOCORE:END*/`. Tests slice them and eval in node:vm with injected env `{S,store,save,now}`.

## CSV (FR-001..013)
- csvCell guard `/^[=+\-@\t\r]/`; import unguard `/^'(?=[=+\-@\t\r])/`. All cells quoted, `\n` rows, header `date,type,amount,category,description,notes,account,to_account`, transfer category `Transfer`, sample rows excluded, sorted by date then n.
- amtMinor (port of parseAmountMinor; commas stripped, <=2 decimals, 0.01..999,999,999.99, native message), fmtMinor, isSane (2000..year+5), no parseFloat on file text.
- csvExportRange = port of checkExportRange (same 3 messages). Export > 50,000 rows refused: "Too many entries to export in one go (N). Narrow the date range with From and To." Empty messages per Stage 2.
- csvNormalize = port of normalizeArtifactCsv (after the 900,000-char cap). csvPlan returns native ImportPlan shape {blocked,total,rows,hashes,dup,problems,range}; ctx={accts,alias,inc,exp}. Account match by name/alias case-insensitive, canonical stored; blank = Cash else first account else "You have no accounts yet. Add an account first."; unknown account = row error (NO auto-create); transfer needs different known to_account; unknown category -> Other / Other Income; desc 120, notes 500, account 40. Limits 900,000 chars, 5,000 rows, 50,000 entries total (native PRLIM text).
- Dedupe key `date|type|amount_minor|account|to_account|desc.trim().toLowerCase()#i` (i from 0), stored in `ih`. `ihNorm` rewrites old decimal third segment to centavos at compare time (no data rewrite). Known miss: old keys from descriptions >120 chars.
- commitImport: re-plan at click, remember len, push all rows, `save()` once; if false truncate to len and show "Import failed. Nothing was added. Try again." (also when STORE_OK false). Double tap adds 0.
- Parity proof: tests/fixtures/csv/*.csv (~12: native export, old id layout, formula guards, BOM/CRLF, quoted commas/newlines, "1,250.50", bad amounts, bad dates, unknown account, same-account transfer, blank account, alias, unknown category, 120/500/40 boundaries, 5,000/5,001 rows, >900,000 chars, duplicate pair) + tests/artifact-csv.test.ts comparing summary, problem lines, mapped rows, hashes, export bytes vs native csvLogic.ts. Fixtures use at most one alias.

## Undo copy (FR-024..028)
- Key `localStorage['mt1undo']`, JSON array newest first, max 3, never synced (not in toRecs), separate from mt1bk.
- Record `{v:1,id,at,expiresAt:at+30d,counts:{tx,sample,bud,rec,open},payload:{tx:[non-sample full objs],bud,rec:[full rules],open:{acct:nonzero}}}`.
- undoWrite: purge expired; slice 3; refuse if >2,000,000 chars; setItem then exact read-back; any failure aborts the clear with "Nothing was deleted." If 3 exist, panel warns the oldest is replaced.
- clearEverything (sync, one tick, CLR_BUSY flag): sync(); recount; re-check typed DELETE in handler; total 0 -> "Nothing to clear"; snapshot; undoWrite; clear order rec -> tx -> bud -> open, S.fresh=0; keep accounts/categories/alias/kw/ren/view/trash; save() once; if save false roll memory back and drop the copy. No bkAdd, no runRec. Must not re-enter the first-run tour.
- undoRestore: reject missing/expired; current wins (tx/rules by id absent from S.tx and S.trash; budgets if category absent; starting balance if current is 0/absent and account exists); skipped counted; apply, save() once; on failure roll back and keep the copy; remove copy only after save succeeds. Message includes "N sample records were not restored." when relevant.
- D7: `#clrsync` line derived from EN p==1 and ST/DBS/SUB: none "Cleared on this device only. Sync is unavailable here."; !SUB "Cleared here. Other devices clear when this one reconnects."; pending "Cleared here. Sending to your other devices..."; error "Sync paused, retrying."; synced "Sent to your other devices. They clear the next time they open."
- Known: offline device editing after the tombstone can resurrect the record (LWW). Tombstone writes scale with record count (not measured).

## Tests (must pass, real counts)
Parity on all fixtures; "1,250.50"=125050; bad-amount messages; no parseFloat in new code; old ih re-import adds 0; save failure leaves tx unchanged; undo write/read-back/cap failure deletes nothing; clear save failure rolls back; clear removes 4 kinds and keeps accounts/categories/trash; toRecs after clear has no tx/rule/bud/open of cleared items; runRec adds 0; clear->restore exact counts; current-wins, deleted account, non-zero current balance; 30-day purge; 4th copy evicts oldest; 10 bkAdd leave undo key unchanged; double tap no-ops; copy text matches code; "Reset everything"/"Delete everything?"/"demo" gone; UI source asserts (button disabled until DELETE, aria-labels, role=status/alert). Browser pane check at 375 px.
NOT VERIFIABLE until G5b: two-device sync, quota at 50,000 entries, phone.
