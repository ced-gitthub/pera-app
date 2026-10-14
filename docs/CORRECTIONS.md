# Ced's corrections: read this FIRST on any Zovix project (and any new project)

Every time Ced had to correct something, it is here, so he never has to say it twice. Grouped by topic. Newest lessons are in section 1.

> Process: every project runs through `docs/APP-DEV-PIPELINE.md` (5 stages). Stage 1 restates the request in Ced's words; Stage 5 checks against that restatement.

## 1. The rule behind most corrections: do what the words say, completely
- **"Clear / delete all" means ALL.** "Delete ALL my records" removes entries, budgets, goals, recurring rules AND sets every starting balance to 0. Only the login, the (now empty) accounts and categories, and the profile/theme stay, and the screen says so. A "clear" that leaves some data behind is a bug. (0.9.5: the end-of-tutorial "Clear" had only removed the 6 sample entries and left the budget and goal; it was narrower than the sheet's words.)
- **The words on a button or sheet must match what the code does.** If the copy says "empty app", the code must empty the app. Test the copy against the code (a test that reads both).
- **Check my work against Ced's wording, not against my own design.** Reviews and tests that only check my design prove nothing about what he asked. Before building: restate his request as a checklist of what he will SEE, and test each line.
- **Leftovers that undo the action are bugs too.** Deleting entries while recurring rules stay means the entries come back. Think through what re-creates the data.
- **Fix the whole list.** "Fix it ALL" means every item, not the first few. After a fix, grep for the same mistake elsewhere (other tabs, other screens).
- **Explain causes plainly, no excuses.** When he asks "why did this happen", answer honestly first (what I assumed, what I skipped), before changing anything, if he asks for the answer first.

- **Clearing data never sends the person back into the first-run tutorial.** After "Clear everything" they land on the empty app (the mandatory wizard is a first-run step only; the "onboarded" flag stays). I once read "reset and start all over again" as "restart the tutorial", and Ced: "wtf is happening?". When a phrase can mean two things, pick the one with the least surprise, and say what will happen in the button text.
- **Every action he taps must feel instant.** Count the network round trips of a tap (one request for all rows, not one per row; local session instead of getUser; reads in parallel). "Try sample entries" took 12+ sequential requests; it is now 2.

- **Warn before anything the system does to the person's app.** Android closes the app when the launcher icon changes, so picking an icon only queues it, says plainly when it will change ("when you leave Zovix; open it again from the new icon"), and applies it when the app goes to the background, or on "Apply now" behind a confirmation. Never close or restart the app on a plain tap. Never block a repeat action ("stuck"): picking again just replaces the queued choice.
- **Unsaved changes are never lost silently.** Done / Close / Back on anything editable asks Save, Discard or Keep editing when there are changes. Switching tabs inside a sheet keeps the edits (keep every tab mounted).
- **The primary action is pinned, never scrolled away.** "Save profile" (and similar) lives in a footer that is always on screen.
- **A save must be unmistakable.** A small line of text above a button is not enough: show a centred pop-out card with a check (and announce it to screen readers).
- **Never flash a placeholder that then changes.** Avatar and name show a neutral disc until the real value is known; the last known profile is cached on the phone (and in memory) so a reopened app shows the right one immediately.
- **The loading skeleton must be the same layout as the live screen** (header, cards, tiles, rows and the tab bar), so nothing jumps when the data arrives.

- **Selecting something must never rearrange the screen.** Fixed-size cells in a fixed order; a selected state is a ring plus a badge, never extra words that change a tile's width or height (the icon picker jumped and wrapped when "(soon)" was added).
- **No cryptic words on the screen.** If a label needs explaining ("soon"), it is the wrong label: put one plain sentence below instead.
- **A removal option people asked for must stay reachable.** "Delete sample records" lives permanently in Settings > Help (shown while sample entries exist), not only in a prompt that appears once.
- **Show the real app version** (from the app config), never a hard-coded number.

- **Apply a rule everywhere, not on one screen.** The profile sheet got the unsaved prompt, pinned Save and pop-out; every other editable sheet did not (found by the independent QA, not by me). When Ced states a UI rule: list EVERY screen it applies to, change them all, and test each one. A screen that is shown inside a Modal must use a local pop-out (the app-wide card is drawn behind a Modal).
- **Run the full independent QA (four agents: flows, UI, data/security, test audit) before calling a release final**, then fix every finding test-first and have the same reviewers confirm. It found two high-severity bugs the earlier reviews missed (a wrong balance after deleting samples; a lost "already has data" question).
- **Setup data: sample entries never count as money the person logged** (balances typed in setup ignore them), and the copy says so while they exist.
- **Never lose a question or a choice**: anything the app must ask (keep or start fresh) is saved on the phone until answered and cleared only when answered or no longer relevant.

## 2. UI and product rules
- Uniform UI: the same floating button in the same place on every tab; the Done/Close button pinned in a header (never scrolled to the bottom where it is hard to tap); same card, button and spacing everywhere.
- Skeletons, not "Loading" text. Always a loading, empty, error and success state.
- Keyboard must never hide the input (KeyboardAvoidingView on every sheet and screen).
- Logging out asks for confirmation. Every delete is explicit: typed DELETE for bulk deletes, Undo for single entries.
- **Tutorial/tour: short and instant.** At most 7 steps, one or two short sentences each (150 characters). 25 steps was "too much". Pressing Next must show the next step at once: never hide the tooltip while measuring; the spotlight can arrive a moment later. No step may need more than a glance to read.
- The pre-account tutorial is an interactive sandbox with motion and three missions, not passive slides. Accounts matter most (show up to 4 on Home). "Why is this better than a spreadsheet?" must be answered on screen.
- After sign-in: ask what to do about the tutorial (sample entries instead of typing) and, when it ends, offer Keep everything / Clear everything and start over.
- Spendable includes negative balances (credit cards) so Spendable + Savings = Total; money format with thousands separators and 2 decimals; tap hints on rows.
- Themes (8, free), profile/avatar, and the launcher icon colour are changeable after sign-up; paid options later. Default/launcher icon = the website's violet tile with the yellow badge and dark Z, compact (badge about 40% of the canvas), never oversized.
- Brand match with the website matters: colours, logo and tone must align with the site.

## 3. Data and safety rules
- Money is integer centavos; dates Asia/Manila; never floats.
- Database changes are additive SQL in `supabase/migrations/NNNN_name.sql`, applied BEFORE the code that needs it; never edit an applied migration. Every new table: RLS owner policy, MFA restrictive policy, row cap, tests in `tests/prod/rls-suite.ts`.
- Anything that deletes or changes money logic gets the independent `judge` review before it ships. Judge rounds caught real bugs several times (invalid uuid ids, wrong live-test date, false "cleared" message, edited rows deleted): never skip it, and fix every finding test-first.
- A live step (`tests/prod`) for anything user-visible or data-changing; the fake database in unit tests does not check column types.
- Never delete data silently; never auto-wipe on sign-up (sign-up with an existing email just signs in, so the app ASKS).
- Secrets: never print or store them; never edit `.env*`. If a server feature fails with "permission denied", check the Supabase edge log for which API key the call carried (the publishable key in the secret variable was the cause of the delete-account 500).

## 4. Process rules (how Ced wants me to work)
- Final report format: `Problem:` / `Solution:` / `Outcome:`, one line each, with pass counts. No process narration. Ced goes by "Ced".
- Do it, don't ask him to run things. If blocked, say exactly which click and give the direct links.
- Cost stays $0. No paid services.
- Update PROGRESS.md after every fix or decision. Save lessons here and in memory.
- Ask before pushing to `main` (it deploys the website). Everything else on the branch is mine to do.
- Permission prompts: the session can be in bypass mode and still prompt, because the project's `.claude/settings.json` ask/deny rules and the guard hook apply. Do not loosen them; tell him once.
- Be honest about what is unverified: nothing native has ever run on a phone from my side. Say "not tested on a phone" every time, and say what the test did prove.
- Scheduled work: only fires while the laptop is awake and the Claude session stays open (set Windows sleep to Never while plugged in).

## 5. Release rules for the Android app
- Always update the saved GitHub release page: `https://github.com/ced-gitthub/pera-app/releases/tag/native-0.3`, asset `Zovix-native-latest.apk` (`gh release upload native-0.3 ... --clobber`), update the notes with the version. Never create per-version releases.
- Publish only after the judge approves. Check the asset size after upload.
- Build in the short path `C:\zb` (see `docs/native-app/NATIVE.md`). Bump `version` and `versionCode` in `native/app.json` every build.
- A new installed build keeps the old launcher icon until the person picks a colour in Settings (Android keeps the enabled alias); say so.

## 6. Mistakes to avoid repeating (each cost a round trip)
| Mistake | What to do instead |
|---|---|
| Published before the re-review | Judge approves first, then publish |
| Narrow reading of "the data from the tutorial" | List every thing the tutorial creates; the clear option removes all of it |
| Copy that promised more than the code | Test the copy against the code |
| Unit-tested the RULE (one icon change per session) but never the EXPERIENCE (the app closes, a repeat tap does nothing, no warning) | For every action ask: what does the person see and feel, in order? Write that as the Stage 1 checklist and test each line; say "not tested on a phone" |
| Looping a network call per row | One batched request; count round trips before shipping any button |
| Test regexes with unescaped `(`, `)` written through shell heredocs | Write scripts with the Write tool, or use Edit; shells mangle quotes and backslashes |
| Long measuring waits before showing a tooltip | Show text first, move the highlight when ready; hard deadline |
| Sequential network reads on every refresh | Read in parallel (`Promise.all`); use the local session, not `getUser`, on saves |
| Thinking `[skip ci]` only skips tests | It also skips the Vercel deploy for that commit |
| Scratch files committed to the repo | Scratch scripts go in the scratchpad directory, never the repo |
