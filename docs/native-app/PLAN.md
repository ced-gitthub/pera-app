# Zovix native app: roadmap

Handbook: [NATIVE.md](NATIVE.md). History: [CHANGELOG.md](CHANGELOG.md).

## Done (0.1 to 0.9.0)
Scaffold, sign-in (email code, Google, two-step), sign-up in the app, Home + Quick Add, first-run wizard, live tab tour, Activity / Accounts / Budgets / Goals / Settings, edit-delete-undo, recurring, reports, accounts and categories manager, CSV, delete records / account, themes + profile + app icon colour, dark design system with tests.

## Next
1. Owner: try the APK on a phone and report what breaks (nothing has been run on a device yet).
2. Deploy the website (push to main, needs Ced's yes) so account deletion works and the new live steps run in prod-qa.
3. Fix what the phone test finds; add a Maestro/Detox-style smoke test only if it can stay free.
4. Quests detail and streak calendar, category reorder, backup/restore, CSV account auto-create (parity gaps).

## Ideas to discuss (owner mentioned making some personalization paid)
- Free: 8 themes, avatar, status, 6 icon colours (built). Possible paid later: extra themes/icon packs, animated avatar frames, profile banners. Needs a payment path that keeps cost at $0 until it earns (Play Billing takes a cut, no upfront fee).
- iPhone build (needs Apple developer account, 99 USD a year) and Play Store release (see docs/play-store).
