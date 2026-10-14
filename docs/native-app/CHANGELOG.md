# Native app changelog

One entry per release. "Rejected" lines are what independent review (the judge agent) found before it was allowed out. See [NATIVE.md](NATIVE.md) for how it works.

## 0.9.9 (2026-10-14)
- Result of a full independent QA (4 agents) and three review rounds. Money: setup balances ignore sample entries (typing 5,000 then deleting samples no longer leaves -17,671); a retry after a lost reply corrects the stored entry; two decimal points (1.2.3) are refused. Flows: the existing-data question is saved until answered, asked before setup, never lost or re-raised; tutorial replay is read-only with a Close; one sheet at a time; no flashing; newest reload wins; another account's data never shows after a theme redraw or sign-out. UI: every editable sheet (entry, Quick Add, budget, goal, Manage, recurring rule, CSV import) asks Save/Discard/Keep editing, has a pinned Save and a pop-out confirmation (local pop-out for screens inside a Modal); card-shaped skeletons that match the live screens; 48 px touch targets; stable theme redraw (keeps your tab); icon-leave logic tested with fake timers. Database: migration 0014 applied (undo copies are select/delete only for users). CI: native type-check job. Live tests: several steps that could never pass were repaired and new ones added (never run yet: they need a push).
- Known limits: a user can still create many undo copies by adding and deleting entries within 30 days (bounded by the 30-day purge and the 50,000-entry cap); nothing run on a phone.

## 0.9.8 (2026-10-14)
- Settings > Help has a permanent "Delete sample records" (with the count and a confirmation that only "Sample:" entries go) while sample entries exist; the Settings footer shows the real version (it said 0.9.0). The icon picker keeps a fixed 3-column order and tile size when you choose (the selected icon no longer jumps to the bottom), with a check badge instead of "(soon)".
- Unverified: on a phone.

## 0.9.7 (2026-10-14)
- App icon: picking an icon only queues it (with a plain warning), applied when you leave the app or on "Apply now" after a confirmation; repeat picks are never blocked. Profile: Done asks Save / Discard / Keep editing when there are unsaved changes; "Save profile" is pinned and always visible; saving shows a centred pop-out confirmation; the last profile is cached so reopening never flashes the default avatar. Loading skeleton now mirrors the live Home and tab bar. Ced: "how did this pass QA?" (the rule was tested, the experience was not).
- Unverified: all of it on a phone (icon switching and the app closing are Android launcher behavior).

## 0.9.6 (2026-10-14)
- Sample entries: one request writes all six (was 12+ in a row) and the local session is used; "Clear everything" after the tour no longer restarts the first-run tutorial, it shows the empty app. Ced: "TOO LONG" and "wtf is happening".

## 0.9.5 (2026-10-14)
- "Clear" after the tour now clears ALL of it (sample entries, budgets, goals, recurring rules, every starting balance to 0) behind a second step that lists the counts, then starts over from the first step. Delete ALL my records does the same, and recurring rules have their own Delete option. Ced: "if I say clear all data, why leave some?".
- Unverified: on a phone; the new live steps run in prod-qa after the next push.

## 0.9.4 / 0.9.3 / 0.9.2 / 0.9.1
- 0.9.4: Next is instant (tooltip never hidden; only the spotlight waits), snapshot + counts + profile read in parallel, saves use the local session. 0.9.3: tour cut from 25 steps to 7 short ones. 0.9.2: launcher icon in the website's style (violet tile, yellow badge, compact Z), Grape is the default. 0.9.1: sample entries in the wizard first step and before the tour (keep or clear afterwards), tour freeze fixed (measure timeout, 2.5 s deadline).
- Rejected (judge, 4 rounds): sample ids not valid uuids (add and clear always failed), samples never offered because the wizard forces a typed entry first, pending flag set after the writes, live test with an invalid date, a delete filtered by RLS reported as success, an entry edited into a real one could be cleared, a stray script committed.

## 0.9.0 (2026-10-14)
- Welcome page alive (animated scene, mood per mission, level chip); live coach-mark tour that points at the real tab and control; Delete my records (+ Delete ALL) and Delete my account; Personalize (8 free themes incl. light, avatar/profile in account metadata, Make it yours step); app icon colour (6); Accounts tab; uniform floating button; manual add in Activity; pinned Done/Close; Spendable now includes negatives (Spendable + Savings = Total).
- Rejected: the automatic wipe after sign-up (could erase an existing account's data) became a Keep / Start fresh prompt; the prompt was first not rendered at all; icon changed twice in one session left two launcher icons; flag not tied to the email; tour not held back during Start fresh; lockfile not pinned. Delete route had no security finding.
- Unverified: everything on a phone; live steps for the delete route.

## 0.8.0
- Home: Total + 2x2 tiles (Spendable, Savings, two accounts); Accounts tab; tab tour; Delete data; welcome motion; tap hints.
- Rejected: tour text described controls that did not exist; delete messages used a stale count and could be false; no live test for the unfiltered bulk deletes (added with an isolation canary so they cannot run if RLS ever regressed).

## 0.7.1 / 0.7.0
- 0.7.0: edit/delete/undo entries, recurring, reports, accounts and categories manager, CSV import/export (five parallel agents).
- Rejected (11 points), then 0.7.1 fixed a bug already published: resuming a paused recurring rule restarted from position 0 and could re-create deleted entries; also failed Undo had no Dismiss, due rules blocked refreshes.

## 0.6.0
- Dark theme, skeleton loading, spendable-first Home, hands-on welcome sandbox, per-tab settings, logout confirmation, design tokens enforced by test.

## 0.5 / 0.5.1
- Welcome intro, in-app sign-up, keyboard fix (Expo 57 edge-to-edge made Android resize do nothing), Budgets/Goals/Activity tabs, design tokens.

## 0.3 / 0.1
- Scaffold, email-code and Google sign-in, TOTP step, Home + Quick Add reusing the website parser, mandatory first-run wizard. The owner called 0.3 "garbage compared with the prototype": the first-run screens and most tabs did not exist yet.
