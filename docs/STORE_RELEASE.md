# Releasing Pera to Google Play and the App Store

Pera is a web app (Next.js) that is now installable (PWA). The stores need extra, mostly paid, steps that only the account owner can do.

## What already works (free, today)
- **Android (Chrome):** open https://pera-app-beta.vercel.app, menu, "Install app".
- **iPhone (Safari):** Share, "Add to Home Screen".
- Public pages the stores ask for: privacy policy `/privacy`; delete-account instructions are on the same page and in the app (Security, Delete my account).

## Costs (outside the project's $0 rule - owner decides)
| Store | Fee | Needs |
|---|---|---|
| Google Play | $25 once | Google Play Console account, identity verification. New personal accounts must run a closed test (12+ testers for 14 days) before production release. |
| Apple App Store | $99 per year | Apple Developer Program, a Mac with Xcode (or a cloud Mac build service), and the app must offer more than a plain website (Apple guideline 4.2). A web-only wrapper is commonly rejected. |

## Android route (recommended first): Trusted Web Activity
1. Register at https://play.google.com/console ($25), verify identity.
2. Generate the Android package from the live site with PWABuilder (https://www.pwabuilder.com) or Bubblewrap; use package id `app.vercel.pera` or your own domain.
3. PWABuilder gives you a signing key and an `assetlinks.json`. Host it at `/.well-known/assetlinks.json` (ask Claude to add it; the file is public by design).
4. Upload the `.aab`, fill the listing (below), complete Data safety and the content rating, run the closed test, then promote to production.

## iOS route
1. Enroll at https://developer.apple.com/programs ($99/year).
2. Wrap with Capacitor (Claude can generate the project) and add at least one real native feature (for example biometric unlock with Face ID, or a home-screen widget) so it is more than a website.
3. Build and sign on a Mac or a cloud build service; upload to App Store Connect; fill App Privacy ("Data not collected for tracking; email and financial info linked to the user, used for app functionality").

## Listing text (draft)
- **Name:** Pera - money tracker
- **Short description (80):** Track every peso. Type it, done.
- **Full description:** Pera is a simple money tracker for the Philippines. Type "lunch 150 gcash" and it records it. See your balance, budgets, monthly reports and spending by category. Your data stays private to you, with optional two-step verification, and you can export it or delete your account any time.
- **Category:** Finance. **Privacy policy URL:** https://pera-app-beta.vercel.app/privacy
- **Data safety (Google) / App Privacy (Apple):** collected: email, name, financial info (user-entered); purpose: app functionality and account management; not shared; not sold; encrypted in transit; users can request deletion (in-app).
- **Screenshots needed:** phone screenshots (at least 2); Apple also needs 6.7-inch and 6.5-inch sizes.
- **Test account for reviewers:** create a dedicated demo user and give the credentials in the review notes (never reuse a real account).

## Risks to know
- Both stores can reject or remove an app that is only a website wrapper; the PWA install path has no such risk.
- The privacy policy must stay accurate whenever the app starts collecting something new.
