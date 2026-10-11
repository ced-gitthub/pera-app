# Zovix on Google Play: everything prepared, in order

Legend: DONE = already in the repo or live. YOU = only the account owner can do it (account, payment, identity, domain).
Play Console wording changes now and then; if a field name differs slightly, pick the closest one.

## 0. Decisions only you can make (one-time, permanent)
| Decision | Recommendation |
|---|---|
| Domain for the app | the one you own, for example `app.zovixhub.com` (needed before packaging) |
| **Package name** (permanent once published, can never change) | `com.zovixhub.app` (change the last part of your domain's ending if it is not `.com`, for example `ph.zovixhub.app`) |
| Developer contact email (shown publicly on the store page) | a separate, non-personal Gmail |
| Developer account type | Personal (Organization needs a D-U-N-S number) |

## 1. Create the Google Play developer account (YOU, $25 once)
1. https://play.google.com/console/signup, sign in with the Google account you want to own the app long term.
2. Pay the one-time $25 registration fee, verify your identity (ID + phone). Verification can take a few days.
3. Complete the developer profile (name, public contact email, phone).

## 2. Hosting side (DONE, except two values)
- Installable web app with icons: DONE (`/manifest.webmanifest`).
- Offline page when there is no internet: DONE (`/offline.html`, `public/sw.js`). It never stores money data.
- Privacy policy: DONE, `https://<your domain>/privacy`.
- Account and data deletion: DONE, in-app (Security → Delete my account) and described on `/privacy`.
- Digital Asset Links file: DONE at `/.well-known/assetlinks.json`. It stays empty until you set two Vercel environment variables (step 5).

## 3. Graphics (DONE)
| Play field | File | Size |
|---|---|---|
| App icon | `docs/play-store/icon-512.png` | 512 x 512 PNG |
| Feature graphic | `docs/play-store/feature-graphic-1024x500.png` | 1024 x 500 PNG |
| Phone screenshots (2 to 8) | YOU, see below | 9:16, 1080 x 1920 recommended |

Screenshots need real-looking data. Create one demo account (never a real person's), add ~15 sample transactions, then capture: Dashboard, Quick Add, Transactions, Budgets, Reports, Accounts. Ask Claude to capture them from the app once the demo account exists. Regenerate graphics any time with `node scripts/make-store-graphics.mjs`.

## 4. Build the Android app package (YOU, free, 10 minutes, after the domain is live)
1. Open https://www.pwabuilder.com, enter `https://<your domain>`, click Start.
2. Click **Package for stores** → **Android** → **Google Play**.
3. Fill in: Package ID = the package name from step 0; App name = `Zovix`; Launcher name = `Zovix`; Version = 1 / 1.0.0; Display mode = Standalone; leave notification, location and Play Billing delegation OFF.
4. Signing key: choose **New**. Download the zip and keep the `.keystore` file and its passwords somewhere safe and backed up (password manager). Never commit them to GitHub and never paste them into a chat.
5. The zip contains the `.aab` file (upload to Play) and a sample `assetlinks.json` (the fingerprint inside is needed in step 5).

## 5. Link the app to the website (YOU, 2 minutes)
1. In Play Console, create the app (step 6), upload the `.aab` to a test track, then open **Test and release → App integrity → App signing** and copy the **SHA-256 certificate fingerprint** of the *App signing key certificate*. Also copy the one for your *upload key* (or from the PWABuilder file).
2. In Vercel → project `pera-app` → Settings → Environment Variables (Production) add:
   - `ANDROID_PACKAGE_NAME` = your package name
   - `ANDROID_SHA256_CERT_FINGERPRINTS` = the fingerprints, separated by commas
3. Redeploy (or ask Claude to). Open `https://<your domain>/.well-known/assetlinks.json` and check it lists your package. This is what removes the browser address bar inside the app.

## 6. Create the app in Play Console (YOU)
**Create app**: name `Zovix: Budget & Money Tracker` (29 of 30 characters), language English (Philippines) or English (US), type **App**, **Free**, accept declarations.

## 7. Store listing (copy and paste)
**Short description (80 max):**
`Track spending, set budgets and see where your money goes. Type it, done.`

**Full description (4000 max):**
```
Zovix is a simple budget and money tracker. Type what you spent, like "lunch 150 gcash", and Zovix records it in seconds. No spreadsheets, no endless forms.

WHAT YOU CAN DO
- Quick add: type a short sentence and it fills in the amount, category and account for you
- Accounts: cash, e-wallets, banks, credit cards and savings, each with its own balance
- Budgets: set a monthly limit per category and see how much is left
- Reports: spending by category, month by month and over a custom date range
- Recurring bills and income: set it once, Zovix adds it on schedule
- Transfers between accounts, including fees
- Undo: bring back a transaction you deleted by mistake
- Import and export: bring in a CSV and download all of your data any time

PRIVATE BY DESIGN
- Your data is visible only to you
- Optional two-step verification with an authenticator app
- No ads, no trackers, and your data is never sold or shared
- Delete your account and all of your data yourself, any time, inside the app

Zovix does not connect to your bank. You stay in control of what you enter.

Your feedback shapes the app. Questions or ideas? Visit our privacy page for how to reach us.
```
**Category:** Finance. **Tags:** Budgeting, Expense tracking, Personal finance.
**Contact:** website = your domain; email = the public developer email; phone optional.
**Privacy policy URL:** `https://<your domain>/privacy`

## 8. App content declarations (answers to give)
| Section | Answer |
|---|---|
| Privacy policy | the URL above |
| Ads | No ads |
| App access | **Restricted** (login needed). Provide a dedicated demo account email and password with sample data, and say "Log in with the email and password. No two-step verification on this account." |
| Content rating (IARC questionnaire) | Category: Utility/Reference. Violence, sexual content, language, drugs, gambling, user-generated content shared with others: all No. Expected rating: Everyone |
| Target audience | 18 and over only (not designed for children) |
| News app / COVID / Government app | No |
| Financial features | Personal finance management and budgeting only. Not a bank, loan, credit, trading, crypto or payment app. No money moves through the app |
| Health apps | No |
| Data deletion | Yes. In-app (Security → Delete my account) and web page: `https://<your domain>/privacy` |

## 9. Data safety form (answers to give)
- Does the app collect or share user data? **Collects**, does **not share**.
- Is all data encrypted in transit? **Yes** (HTTPS).
- Can users request data deletion? **Yes**, in-app and via the privacy page.

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | No | Account management, app functionality |
| Name | Yes | No | Yes | Account management |
| Financial info (what users type: accounts, transactions, budgets) | Yes | No | No | App functionality |
| Everything else (location, contacts, photos, device IDs, analytics, ads) | No | | | |

## 10. Testing requirement and release (YOU)
New personal developer accounts must run a **closed test** before production: at least **12 testers opted in for 14 continuous days**.
1. Testing → Closed testing → Create track → upload the `.aab` → add testers by email list (or a Google Group).
2. Recruit 12 to 15 people (friends and family with Android phones). Message to send: *"I built a budget app and need testers for Google Play. Please send me your Gmail address, then tap the link I send, tap Become a tester, then install Zovix and open it once every couple of days for 2 weeks. Thank you!"*
3. After 14 days, Play Console shows **Apply for production**. Answer the short questions (testing feedback, what you changed), then create the production release.
4. Release notes (first version): `First release: quick add, accounts, budgets, reports, recurring bills, undo, CSV import and export.`
5. Review usually takes from a few hours to a few days.

## 11. Common rejection reasons, already handled
- Missing demo login for a login-only app → step 8, give a demo account.
- No account deletion → DONE (in-app + web).
- Privacy policy mismatch → `/privacy` matches what the app stores; update it whenever the app collects something new.
- Broken link between app and site (browser bar showing) → step 5.
- Misleading finance claims → the listing says it does not connect to your bank and is not a bank.

## Costs
Google Play registration $25 once. Nothing else: PWABuilder, Vercel (Hobby), Supabase (free) and Gmail sending stay free. Apple App Store is skipped on purpose ($99 per year).
