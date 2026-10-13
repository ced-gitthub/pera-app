# Native app changelog

One entry per release. "Rejected" lines are what independent review (the judge agent) found before it was allowed out. See [NATIVE.md](NATIVE.md) for how it works.

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
