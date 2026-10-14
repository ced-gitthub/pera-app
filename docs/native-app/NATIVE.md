# Zovix native app: handbook

Living document. Read this before working in `native/`. History is in [CHANGELOG.md](CHANGELOG.md), the roadmap in [PLAN.md](PLAN.md).

## What it is
Expo SDK 57 / React Native 0.86 Android app in `native/`, package `com.zovixhub.pera`. Same Supabase project as the website (`vxhgkkzbmrhxayzryake`), publishable key only, RLS is the security boundary. Debug-signed, arm64 APK for trying (not for the Play Store). Cost stays $0.

## Map
- **Screens** (`native/src/`): `Welcome` (pre-account sandbox + `WelcomeScene/Touch/Motion`), `Login` (email code, Google, sign-up), `Gate` (decides wizard vs app, owns tabs, undo, tour, prompts), `Wizard` (first-run steps), `Home`, `Tabs` (Activity, TabBar, shared `Page`), `AccountsTab`, `Planning` (Budgets, Goals), `Settings`, sheets: `Sheet`, `EntrySheet`, `Recurring`, `Reports`, `Manage`, `Csv`, `ResetData`, `DeleteAccount`, `Personalize`, `MakeItYours`, `ExistingDataPrompt`, `TabTour` (+ `Coach`).
- **Pure logic** (no react-native, unit-tested with `node --test`): `logic.ts` (money views, planners), `*Logic.ts`, and `*Core.ts` files that take an injected `db`/`fetch` so write paths are testable with the fakes in `tests/helpers/`. Thin `*Api.ts` / `entries.ts` / `reset.ts` wrappers pass the real Supabase client. A screen `X.tsx` never shares a base name with a data module `x.ts` (Windows case clash): use `xApi.ts`.
- **Look**: all colours/sizes live in `uiTokens.ts` + `themes.ts` (8 free themes). Screens use `c, s, sp, t, e, r` only; `tests/native-design.test.ts` fails on raw hex, raw font/radius/padding/margin/gap/top/left/right/bottom numbers and checks contrast of every theme.
- **Server**: `src/app/api/native/delete-account/route.ts` + `src/lib/deleteAccount.ts` (only the server holds the key that can delete a user). Middleware lets `/api/native/` through; the route checks the bearer token itself.

## Rules and decisions (and why)
- **Money**: integer centavos everywhere; dates Asia/Manila; reuse website code (`src/core/*`, `src/lib/*`) instead of copying.
- **Spendable** = sum of non-savings account balances INCLUDING negatives (credit cards); Savings = savings accounts; Spendable + Savings = Total. `owed` is information only. (Ced first wanted negatives excluded, then asked for this so the numbers never disagree; it also matches the website's `homeNumbers`.)
- **Deleting** is always explicit: logout asks first; delete entry has Undo (tx_trash trigger); Delete my records / Delete ALL need typing DELETE and say what stays; Delete my account is a different, permanent option. **"Clear all" means all**: Delete ALL = entries, budgets, goals, recurring rules and every starting balance to 0 (login, empty accounts/categories, profile stay). The end-of-tour Clear is the same full reset plus a restart of the first-run steps. Read `docs/CORRECTIONS.md`.
- **No silent wipes.** An automatic clean-up after sign-up was built and REJECTED by review: "Create account" with an email that already has an account just signs that person in, so it could erase real data. Now the app asks (Keep / Start fresh through the typed-DELETE sheet). The flag is single-use and tied to the email.
- **Recurring**: resume never moves a rule backwards (that would recreate deleted entries); the schedule uses the server date, not the phone clock.
- **App icon colour**: 6 colours via `expo-alternate-app-icons` (pinned 8.0.0); one change per app session (a second change before a restart can leave two launcher icons); the `zovix://` deep link filter is on every alias so Google sign-in survives a switch. Never rename or remove an alias in a later build.
- **Theme** changes remount the tree (`App.tsx` key); module-level colour captures go stale, so build colour maps inside functions.

## Build and release
1. `npm run verify` (root) + `cd native && npx tsc --noEmit` (verify does NOT type-check `native/`) + `npm run format:check`.
2. Build in a SHORT path (the worktree path breaks CMake): robocopy `native/` (with `node_modules`, do not exclude `build` dirs), `../src/core`, `../src/lib` to `C:\zb`, then in `C:\zb\native`: `npx expo prebuild --platform android --no-install`, and in `android`: `gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon` with `JAVA_HOME=C:/Users/Ced/Ced Personal Project/Zovix/android-build/jdk/jdk-17.0.20.1+1` and `ANDROID_HOME=.../android-build/sdk`. APK: `app/build/outputs/apk/release/app-release.apk`. Check the bundle contains the new strings (`unzip -p apk assets/index.android.bundle | grep -c "text"`); emoji strings are stored escaped.
3. **Release page**: Ced saved `https://github.com/ced-gitthub/pera-app/releases/tag/native-0.3`. Always replace `Zovix-native-latest.apk` there (`gh release upload native-0.3 <file> --clobber`), update the notes with the version, verify the download size with `curl -sIL`. Never create per-version releases.
4. **Publish only after the judge approves.** 0.7.0 was published before its re-review and shipped a real bug.

## Working agreements (Ced)
Fix the whole list, not part of it ("fix it ALL"). Explain causes plainly, no excuses. Uniform UI (same button style/place on every tab). Say exactly which click is needed only when blocked. Final report as Problem / Solution / Outcome. TDD red-green; parallel agents only on disjoint files; judge review for auth, money, deletes, deploy config. No push to `main` without his yes (it deploys the website).

## Tour and sample data (0.9.x)
- The tour is 7 steps max, 150 characters each, and Next must be instant (tooltip always visible; only the ring waits for its target; 2.5 s deadline). `tests/native-tour.test.ts` enforces it.
- Samples: 6 entries with fixed uuid request ids and the label "Sample:", offered on the wizard first step and before the tour (`sampleLogic/Core/Api`, `SampleSheets`). A pending flag per account survives closing the app.
- Launcher icon: the website style, generated by `docs/native-app/icons/generate-icons.mjs` (needs `sharp` from the root node_modules); Grape (the website violet) is the default.

## Open items (honest list)
- **Website deployed (4c39ed7) but account deletion failed live (500)** because the server key cannot call the auth admin API; fixed by migration 0013 (applied to production, verified) and the route/action now call it. Needs the next push + a green prod-qa security run to confirm.
- **Supabase dashboard**: Authentication > Email Templates > "Confirm signup" needs `{{ .Token }}` for in-app sign-up to send a code; keep "Allow new users to sign up" on; consider OTP rate limits.
- **Never run live**: rls-suite (56 checks incl. bulk-delete steps with an isolation canary) and the new security.mjs group run in `prod-qa` on the next push (needs Confirm email OFF).
- **Never run on a phone** (all of it): keyboard inside sheets, safe-area/Done position, tour spotlight measuring after tab switches, Fab vs tab bar, welcome animation load on low-end Android, theme remount, icon change (launcher delay, Samsung/Xiaomi behaviour), Google deep link after an icon change.
- Website gaps found in review: its two-step check counts only TOTP factors; `tx_trash` has no per-user row cap; website `homeNumbers` naming.
- Not built vs website: category reorder, CSV auto-create accounts, backup/restore, assistant, delete-my-account UI parity (uses the route above).

## Phone test checklist
1. Install over the old build: opens, data intact. 2. First launch: Welcome plays, three missions, Create account only after mission 3. 3. Sign up with a NEW email: Make it yours, then the setup steps, then the live tour. 4. Sign up with an email that already has data: the Keep / Start fresh question appears and nothing is deleted before typing DELETE. 5. Keyboard: type in Quick Add, sheets and inputs; Done/Close are always visible and tappable. 6. Tabs: floating button in the same place on every tab; tap hints on rows. 7. Home: Total + four tiles without scrolling; a negative account lowers Spendable. 8. Edit/delete an entry, Undo. 9. Delete my records / ALL: counts, typed word, result. 10. Themes: apply each, close the sheet, relaunch (persists). 11. App icon: pick a colour, wait, relaunch from the new icon, Google sign-in still returns. 12. Reduce motion on: no animations. 13. Delete my account (after the website deploy): needs sign-in within 10 minutes.
