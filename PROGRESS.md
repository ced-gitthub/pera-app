# Progress

## Fixed

- 2026-10-11 audit fixes (merged to main): undo no longer loses a trashed transaction; "last" resolves transfer + fee ties; transfers are saved once on double-tap; CSV accounts differing only in case merge and errors show; recurring start date limited to +/- 2 years; implausible dates refused; confirm before deleting accounts, categories and recurring rules; labels on placeholder-only inputs; global-error and not-found pages.
- 2026-10-11 prevention: `npm run selftest` (guard hook and tool names), `npm run verify` gate before any push to main (git pre-push hook), CI runs selftest + lint + format check, weekly health workflow, Dependabot, ESLint + Prettier, `.gitattributes` (LF everywhere), feature checklist and quality gates in CLAUDE.md. Fixed the guard hook and settings matcher that used `mcp__Supabase__` (the server is `supabase`), so the destructive-SQL guard now actually runs.

- 2026-10-11 owner setup done: Supabase Confirm email ON, custom Gmail SMTP configured (signup confirmation emails verified working), branch rule requiring the ci check on main, deny rules added to .claude/settings.json. actions.ts split into src/app/actions/*.ts.

- 2026-10-11 store prep + backend: installable app, offline page, delete-my-account (needs password or recent sign-in; blocked for password-only sessions of two-step users), privacy page, Android assetlinks route, Play Console guide (docs/play-store). Migration 0010 applied: deleting a user purges their undo-trash. App renamed to Zovix. CSV export no longer leaks error text.

## Open bugs

- Lint ratchet: 286 warnings (258 `any`), all pre-existing. Do not let the number grow.
- Home page reads up to 2,000 dates for the streak and runs `run_recurring` on every load; CSV export builds everything in memory; transaction search uses `ilike '%q%'`. Fine at today's size (busiest user 2,073 transactions), revisit if users grow.
- `.claude/settings.json` still allows Bash `git *`, `cat *`, `node *`, `python3 *`, which bypass the `Read(.env)` deny. Claude cannot tighten its own permissions; the owner must.
- No undo-skips-deleted-account test in `tests/prod` (the fake database cannot produce that error).
- Leaked-password protection is a Supabase Pro feature (paid); not needed, the app checks HaveIBeenPwned itself on signup, reset and password change.
- Live prod-qa suites create throwaway users, so they skip/fail while Confirm email is ON (expected). Re-verify the 9 qa.mjs steps fixed in 3ecabd3 only if Confirm email is turned OFF briefly.

## Decisions

- Row caps (0009) were applied to production on 2026-10-11 after judge approval and a rolled-back dry run; triggers verified on accounts, categories, recurring_transactions and transactions. Over-limit inserts raise SQLSTATE PRLIM, which the app maps to a clear message.
- Backups are NOT automated from GitHub Actions: this repo is public, and a database dump stored as an artifact would expose users' financial data.
- CAPTCHA (Cloudflare Turnstile) needs a Cloudflare account and a Supabase setting; not done.
- Staging: use Vercel preview deploys per branch; a second Supabase project (free tier allows two) is not created yet.

- 2026-10-11: Domain zovixhub.com (+www redirect) added to the Vercel project; DNS at Cloudflare is still the owner's step (A @ 216.198.79.1, CNAME www -> 220a0159e7a04f46.vercel-dns-017.com, DNS only).
- 2026-10-11: Android APK built locally (Bubblewrap core, JDK 17, Android SDK) in C:\Users\Ced\android-build (build.mjs, Zovix.apk, keystore/). Package com.zovixhub.app, host pera-app-beta.vercel.app, minSdk 24. The keystore and its password stay local and must be backed up; never commit them. Vercel production env ANDROID_PACKAGE_NAME and ANDROID_SHA256_CERT_FINGERPRINTS set so /.well-known/assetlinks.json lists the app. Moving to zovixhub.com means rebuilding the APK with SITE=https://zovixhub.com.

- 2026-10-11: Google sign-in cannot finish inside an installed iPhone home-screen app (separate cookie jar from Safari). Added passwordless email-code login at /code (signInWithOtp, shouldCreateUser false, then verifyOtp type email; TOTP users still go to /2fa). The Google button is replaced by a hint when navigator.standalone is true. OWNER STEP REQUIRED: Supabase -> Authentication -> Email Templates -> Magic Link must contain {{ .Token }} (the default template only has a link, so no code would be sent). Not covered live: a successful code login (needs a mailbox or the service key); covered by the e2e tests.

- 2026-10-11: REJECTED design, do not rebuild: Google sign-in for the iPhone app via a parked OAuth code (sheet parks the code under a nonce, app polls and exchanges it). The judge showed it allows account takeover: an attacker starts the flow on their own device, sends the victim the Google link, and the victim's code is redeemed by the attacker's PKCE verifier. Safe options need a device-code confirmation step and cannot be tested on an iPhone from here. Decision: Google works on Android and Safari; the installed iPhone app uses the email code (/code) or password.

- 2026-10-12: Everything now lives in one folder, `C:\Users\Ced\Ced Personal Project`: `Zovix\pera-app` (this repo), `Zovix\android-build` (APK build script, JDK, Android SDK, signing keystore: back it up, never commit it) and `Claude Code Setup\myapp`. Hook paths in .claude/settings.json are quoted because the folder name has spaces. The APK signing key was replaced (the first one's password appeared in a log; it was never published) and ANDROID_SHA256_CERT_FINGERPRINTS in Vercel was updated to the new key. Rebuild the APK with `node build.mjs` in android-build (SITE=https://zovixhub.com once the domain is live). The old empty folder C:\Users\Ced\pera-app can be deleted once Claude is closed.

## Next steps

0. Owner: turn Supabase Confirm email back ON after any live-suite run. Provide the domain (with ending) to attach it in Vercel, then follow docs/play-store/PLAY_CONSOLE_GUIDE.md.

1. Live suite: the confirm dialogs added in the audit broke 9 steps in tests/prod/qa.mjs (fixed on branch fix-live-tests: accept "Delete ..." confirms, 404 text). Re-check the qa-qa result after the next push to main.
2. Owner only (Claude cannot change its own permission rules): in .claude/settings.json add deny rules Bash(cat *.env*), Bash(head *.env*), Bash(tail *.env*), Bash(git reset --hard*) and narrow the broad Bash(git *), Bash(cat *), Bash(node *), Bash(python3 *) allows. In GitHub: Settings -> Branches -> add a rule for `main` that requires the `ci` check to pass.
3. Split `actions.ts`; lower the lint warning limit as `any` is removed.
4. Optional: second Supabase project for staging; Turnstile CAPTCHA; scheduled database export to a private location.
