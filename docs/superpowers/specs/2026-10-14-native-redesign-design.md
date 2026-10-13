# Zovix native app: redesign (dark, game-like, spendable-first)

Status: DRAFT for Ced's review. Nothing in this document is built yet.
Branch: `claude/musing-mclean-26141c` (native 0.5.1 is the starting point).

## Why

Owner feedback on native 0.5.1 (2026-10-14), in short: the welcome is boring and empty; its slides show what to type but let you do nothing; the money you actually care about (what is left in each account, spendable vs savings) is not the focus; "Loading" in a corner looks like an error; Settings is empty and highlights the tutorial; there is no reason to open the app and nothing entertaining; the colours are poor. The question behind all of it: *why use this instead of a spreadsheet?*

## Success criteria (what Ced will check on the phone)

1. First launch: within seconds I can type a line, see my sample accounts change, and understand "spendable vs savings" without reading anything.
2. Home answers "how much can I spend?" in one glance and shows every account's balance.
3. No screen ever shows bare "Loading": shaped skeletons appear instantly.
4. Every tab has its own configuration; Settings holds real settings and the tutorial replay is a small "Help" row, not a highlighted block.
5. Logging an entry feels rewarding (balance counts down, XP pop, streak).
6. The look is dark-first and consistent; no screen uses a colour outside the tokens (already enforced by `tests/native-design.test.ts`).

## Constraints (unchanged)

$0 cost; Supabase backend and website untouched; publishable key only; money is integer centavos; dates Asia/Manila; website rules reused rather than re-implemented (`homeNumbers`, `budgetStatus`, `quests`, `missions`, `goals`, `parser`); every new input has limits, a label, and a message that says what to fix; every delete has Undo; judge review before auth/money changes; `npm run verify` stays green.

## Decomposition (each gets its own plan, build and APK)

1. **SP1 Foundation + Home** (this spec's detail): dark tokens, skeleton screens, Home approach A, the save reward moment.
2. **SP2 Hands-on welcome + wizard polish.**
3. **SP3 Per-tab configuration + real Settings.**
4. **SP4 Edit / delete / undo of entries; add accounts, budgets, goals outside the wizard.**
5. **SP5 Remaining parity** (Reports, recurring, CSV, quests detail, streak calendar).

Order is by what Ced complained about first. SP1 and SP2 together are the "first impression" release.

## SP1: Foundation + Home

### Theme (dark-first, chosen by Ced)
Tokens live only in `native/src/uiTokens.ts`. Proposed values (contrast computed, all pass 4.5:1 on `bg`):
`bg #0E0B1A`, `card #1A1530`, `raised #241D42`, `line #33295C`, `ink #F2EFFF`, `mute #A59FC4` (re-check on `card`), `money-in lime #B8F23A`, `money-out coral #FF6B8E`, `warn amber #FFC247`, `primary lime`, `reward amber`. Meaning rules: lime = money in and primary actions; coral = money out; amber = near a limit and rewards; nothing else carries these meanings. Light mode is out of scope for SP1 (follow the system later).
Test: extend the contrast test to the new pairs; the "no raw numbers or hex outside tokens" test stays.

### Skeletons
One `Skeleton` component (rounded blocks with a slow shimmer using `Animated`, respects reduced-motion). Per-screen skeleton layouts that match the final layout (Home hero + cards, list rows, bars). Replaces every "Loading..." text and the blank state while the gate loads. Error state stays a separate, explicit message with Try again.

### Home (approach A)
Top to bottom:
1. Greeting + streak chip.
2. **Spendable** hero: big number = sum of balances of accounts not flagged "counts as savings"; under it `Savings` and `Total`. Uses `homeNumbers` from `src/lib/balances.ts` (one rule for web and native). Until at least one account is flagged or the wizard's spend/save question is answered, show **Total** as the hero (never a misleading Spendable).
3. Account cards: horizontally swipeable, next card peeks, page dots, "See all" opens the full list. Each card: name, balance, a small spend/save tag.
4. One-line game strip: level, XP bar, today's quest (from `src/lib/quests.ts`); tap opens a sheet.
5. Recent entries (latest 5) with "See all" to Activity.
6. **Add** floating button bottom-right above the tab bar (not a pinned input): opens a bottom sheet with the Quick Add field focused, keyboard-safe. Preview card shows amount, category chip, account chip; one tap Save.

### Reward moment on save
After a successful save: the affected balances count down/up (about 600 ms), a "+10 XP" pop, streak flame bumps if it is a new day. A first-ever entry gets a small celebration. Reduced motion: no animation, same information.

### Data / logic
No schema change. New pure functions in `native/src/logic.ts` with unit tests: `spendableSplit(accounts, balances)` (wraps `homeNumbers`), `xpFor(...)` (wraps quests.ts), `streakFromDates` (reuse website helper). Skeleton and animation components are presentational and covered by the design-token test plus a render smoke check where possible.

### Error handling
Every list/card has loading (skeleton), empty (what to do next), and error (message plus Try again) states. A failed save keeps the typed text.

### Testing
Unit tests first (TDD) for each pure function; the design-token and contrast tests; `npm run verify`; judge review for money logic (spendable) before release; an APK for Ced to try each sub-project. No device automation exists yet, so on-phone behaviour is verified by Ced and reported back.

## SP2: Hands-on welcome (outline, detailed in its own spec)

Replaces the four slides. Pre-account sandbox with sample accounts Cash, GCash, Savings:
1. "Type a line": the user types or taps a suggested chip (`lunch 150 gcash`); the real parser runs; balances count down; Spendable vs Savings is visible.
2. "Move money to savings": the user types `move 500 to savings`; Spendable drops, Savings rises.
3. "Watch a goal fill": a sample goal fills as savings grow; shows level/XP and streak.
4. Closing line answers the spreadsheet question ("No formulas. Type a line, see what's left.") and offers "Create my account".
The create-account button appears only after step 2, not from the first screen. The wizard gains one question per account: "Is this money you spend, or save?" (sets `counts_as_savings`), which feeds Spendable. Pure demo logic reuses `src/lib/welcomeDemo.ts`.

## SP3: Per-tab configuration + Settings (outline)

Each tab has a gear opening a bottom sheet: Home (which accounts show, mark savings accounts, order), Activity (default filter, sort), Budgets (month, add/edit limits), Goals (add/edit, connect an account). Settings screen: profile name, appearance (system/dark), notifications placeholder omitted until real, Help (replay tutorial as a small row, never highlighted), Log out. Delete-account and CSV export stay on the website with a link until built.

## Out of scope for SP1

Welcome rewrite (SP2), settings (SP3), edit/delete (SP4), light theme, iOS, Play Store signing.

## Open questions for Ced

1. Is approach A (Spendable hero, account cards, floating Add, game strip) right?
2. Floating Add button with a sheet instead of an always-visible input: OK?
3. SP order above (Foundation+Home, then Welcome) OK, or do you want the welcome first?
