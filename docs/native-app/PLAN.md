# Zovix native app (Expo / React Native): plan and handoff

Owner decision (2026-10-13): build a REAL native app, not a wrapper around the website. Keep the website working. Start with Android.

## Goal
Native Android APK first (free, no Play Store needed), then iPhone later (App Store needs Apple's $99/yr; until then only a limited test-build route).

## Reuse (do not rebuild)
- Supabase project `vxhgkkzbmrhxayzryake`: database, RLS, MFA policy, RPCs (`period_summary`, `account_balances`, `run_recurring`, ...). The app talks to it with the publishable key + the user's session; never a secret key.
- Pure TypeScript logic: `src/core/money.ts`, `src/core/parser.ts`, `src/lib/{missions,quests,goals,onboarding,onboardingCopy,vibe,validate}.ts`. Share by moving into a `packages/core` folder (or copying with tests) so web and native run the same tests.
- Rules from CLAUDE.md still apply: money is integer centavos, dates Asia/Manila, cost stays $0, no secrets in the repo.

## Rebuild (native screens)
Login (Google + email code) -> Home (balance, Quick Add, accounts, history) -> Transactions -> Accounts -> Budgets -> Reports -> Settings -> savings goals -> quests -> first-run wizard/tutorial (4 steps with worked examples, see `src/lib/onboardingCopy.ts`).

## Order of work
1. Scaffold `native/` (Expo, TypeScript), env via `app.config` + `EXPO_PUBLIC_*` (publishable values only).
2. Auth: email code + Google (Supabase OAuth with a deep link `zovix://auth/callback`; add it to Supabase redirect URLs - owner action).
3. Home + Quick Add (parser reused) -> first installable Android APK (EAS free tier or local `expo run:android`) for the owner to try.
4. Remaining screens, then wizard, goals, quests.
5. Tests: unit tests for shared logic stay in `npm run verify`; add native smoke tests; keep the website suites green.

## Mandatory tutorial in the native app (owner request)
Full-screen sliding wizard (Step N of 5, progress bar, dots, no Skip, nothing behind it scrollable or tappable): 1 first entry, 2 real balances (opening = typed minus entries already logged), 3 first budget, 4 first savings goal, 5 closing slide. Every slide has a worked example (You type / What each part means / What Zovix does), see src/lib/onboardingCopy.ts. Accounts with all four steps get a one-time Next/Back walkthrough. Settings has a Show the tutorial again button. Gate on real data, fail open on read errors. Build right after Home + Quick Add.

## Owner actions that may be needed (ask only when truly blocked)
- Add the native deep-link redirect URL in Supabase Auth URL configuration.
- Google OAuth: an Android client / SHA-1 for the new app if native Google sign-in is used.
- Install the APK from the build link.

## State at handoff
Website at commit c5e2483 on main, all five live suites green (qa 190, rls 49, security 66, responsive 242, db 15). Existing Android wrapper APK (Bubblewrap) stays available at `/zovix.apk` until the native app replaces it.
