# Item 7 blueprint: make the artifact LOOK like the native app (Stage 1, Product Manager)

Light track (visual only, no data/behaviour change). Look source: `native/src/uiTokens.ts`, `themes.ts`, `ui.ts`, `Tabs.tsx`, `Home.tsx`, `Btn.tsx`, `Sheet.tsx`, `Fab.tsx`, `Toast.tsx`. Target: `artifact/pera-artifact.html` (single file, $0).

## Instruction ledger (Ced's words verbatim)
| ID | Ced's words | Meaning chosen | He will SEE |
|---|---|---|---|
| IL-1 | "still looks like the old, NOTHING NEAR THE NATIVE APP" | Restyle the whole artifact in the native design language (colors, type, radii, spacing, cards, tab bar, buttons, sheets, toasts, empty states). Same data and behaviour. | Next to the phone app: same colors, rounded dark cards, emoji bottom tab bar, big pill Add button. |
| IL-2 | "Excluded on purpose: accounts/sign-in, app icon, theme/avatar picker, account deletion, phone-only screens." (NEXT.md) | Not copied. No theme picker: one default look (dark = Lime Night, light = Daylight). | No avatar, sign-in or themes screen. |
| IL-3 | "no push to `main` and no artifact republish without QA approval + Ced's yes" (NEXT.md) | Branch only; QA APPROVE, then ask Ced. | Nothing live changes until he says yes. |
| IL-4 | "Cost stays $0" / "Money is integer centavos" (CLAUDE.md) | No fonts/CDNs/libs; no float money. | Nothing new to pay for. |
| IL-5 | items 1-6 are live as Version 29 (NEXT.md) | Keep ALL existing behaviour, marker blocks and ids. | Everything he already approved still works. |

## User stories
- US-1 As Ced, I open the artifact and see the same colors, cards and type as the phone app, so it feels like one product.
- US-2 On a phone-width screen I get a native-style bottom tab bar (emoji above label, active tab in accent), always reachable.
- US-3 Home reads like native Home: hero Total balance card, account tiles, Recent list, floating Add.
- US-4 Buttons, inputs, the unsaved sheet, tour bar and toasts look like native ones.
- US-5 Dark and light both look right; 375px has no sideways scroll.

## Gap table (native vs artifact today)
| Area | Native | Artifact today | Target |
|---|---|---|---|
| Dark palette (default Lime Night) | bg #0E0B1A, card #1A1530, raised #241D42, line #33295C, ink #F2EFFF, mute #A59FC4, primary #B8F23A, onPrimary #0E0B1A, up #B8F23A, down #FF6B8E, warn/reward #FFC247, hero violet #2B1F66 | teal light: bg #eef2f4, acc #0b6e6a, inc #1b7a4a, exp #b4421a | Dark (OS dark or data-theme=dark) = Lime Night |
| Light palette (Daylight) | bg #F0EEF7, card #FFFFFF, raised #E2DEED, line #C1BCD2, ink #140E25, mute #4E4860, primary #5B3DF5, onPrimary #FFFFFF, up #06683A, down #B01A42, warn #8A5600 | same teal | Light = Daylight |
| Tokens | spacing 4/8/12/16/24/32 (clear 120); type 13/16/18/22/28/40; radius 12/18/28/pill; touch 48 | 15px base, ad-hoc 6/10/14 px, radii 4/8/12/14/20 | CSS vars `--sp-*` `--t-*` `--r-*`, used everywhere |
| Font | system sans, titles/amounts weight 800 | Georgia serif h1/h2/.big | System sans, weight 800 |
| Card | card bg, 1px line, radius 18, pad 16, margin-bottom 12 | radius 12, pad 14 | native card |
| Inputs | raised bg, 1px line, radius 12, pad 12, text 18 | bg color, radius 8 | native input |
| Buttons | primary: primary bg, onPrimary text, weight 800, radius 12, min 48; alt: raised + line; danger: down bg; pressed/busy opacity .7 | radius 8, white text, min 44 | `.p`, default, `.dz` mapped; disabled .7 |
| Chip / Edit | pill, raised, line, "⚙︎ Edit" | plain button | pill chip for Edit/Done and tags |
| Tab bar | Home, Activity, Accounts, Budgets, Goals, Settings; emoji 22 + 13 label; active = primary + 800, inactive emoji opacity .55; card bg, top line | 7 text tabs (Home, Transactions, Budgets, Accounts, Reports, Ask, Settings); SVG icons only under 641px; desktop pill row | Emoji bottom bar at all widths (centred, max 980 on desktop); keep the artifact's 7 tabs (A2); 🏠🧾🎯👛📊💬⚙️ |
| Page banner | tinted hero, emoji 44, title 28/800, friendly line, rounded bottom (28), Edit chip | h1 "Pera — tell it what happened" + link | Banner per tab using `eh()` (Edit/Done ids and `data-a="em"` unchanged) |
| Home | Hi row, violet Total balance card (radius 28, value 28/800), 2-col account tiles (radius 12, edge line; spendable up; savings reward), "See all accounts ›", Recent rows with ›, floating "＋ Add" pill | Accounts list card, Spendable/Savings cards, History | Same layout from existing data; no level/XP (A3); quick-add bar styled as native field; floating "＋ Add" pill (A5) |
| Rows | title 16, caption 13 mute, amount bold up/down/mute, › | bordered flex rows | native row look |
| Sheet | card bg, top radius 28, overlay #000000AA, close | `#us` radius 14 | native sheet look |
| Toast | centred card, 2px up border, ✓ 28, title 22, 2200 ms | dark pill at bottom | centred card (id `toast`, role=status, TOASTCORE timing unchanged) |
| Empty state | "Nothing yet. Tap Add to log your first peso." | "Nothing yet." | native sentence |
| Progress bar | height 8, pill, raised track, reward fill | line track, accent fill | native look; over/warn use down/warn |
| Errors | `down` text, Try again | text | down/up colours |

## In scope
Colors, type scale, radii, spacing, cards, tab bar (all widths), page banners, Home layout, buttons/inputs/chips, `#us` sheet look, tour bar, toast look, empty-state text, dark + light, focus rings, reduced motion kept.
## Out of scope
Accounts/sign-in, app icon, theme/avatar picker, account deletion, phone-only screens (Welcome, Wizard, Coach), level/XP/quests, Goals tab, any new data or logic, new fonts/libs, republish.

## Acceptance criteria (testable)
- AC-1 (Must) The dark CSS block holds the Lime Night hex values above and the light block the Daylight values; `#0b6e6a` and `Georgia` are gone from the file.
- AC-2 (Must) CSS vars exist for spacing (4,8,12,16,24,32), type (13,16,18,22,28,40) and radii (12,18,28,999), and card, button and input rules use them (a test greps the values).
- AC-3 (Must) `#nav` has 7 buttons, each emoji (aria-hidden) + label, `role=tab`, `aria-selected`, active marked; fixed to the bottom at <=640px and reachable on desktop; clicking sets `S.v` as before.
- AC-4 (Must) At 375px every tab has `scrollWidth <= 375` (browser check) and tap targets are at least 44px high.
- AC-5 (Should) A unit test computes contrast from the hex values: ink and mute on bg/card/raised, onPrimary on primary >= 4.5:1, in both palettes.
- AC-6 (Should) Home shows the hero Total balance card, 2-col account tiles, "See all accounts ›", Recent rows with ›, floating "＋ Add"; empty state sentence when there are no entries.
- AC-7 (Should) Toast is a centred card with ✓, `role=status`, 2200 ms, replace-old (artifact-toast tests green).
- AC-8 (Should) Primary/alt/danger button styles; `button:disabled` opacity .7; min-height 48 on touch widths.
- AC-9 (Must) No behaviour diff: `npm run verify` and `npm test` green, `parseFloat` still absent, no `any` added, the 8 marker blocks unchanged byte for byte.
- AC-10 (Should) The tab bar never overlaps the floating Add, toast, tour bar or `#us`; bottom padding keeps the last row visible.

## Constraints
$0 (system fonts, emoji and inline SVG only); integer centavos and Asia/Manila untouched; visible 3px primary focus ring; 375px; reduced motion respected.

## Risks
- R1 Tests grep the HTML (`data-a="`, `role="`, `aria-modal`, `aria-labelledby`, `S.v=`, `holdForm()`, `curForm()`, `tourGo` text): keep JS, ids (`q go nav view warn toast tour us syhd`, `e-*`, `nc-*`, `clrt`, `clrc`, `xf`, `xt`, `csv`) and `data-a` values; restyle by CSS and wrapper markup only.
- R2 Marker blocks (CSVCORE, UNDOCORE, SAMPLECORE, UNSAVEDCORE, INTROCORE, LIMITSCORE, TOASTCORE, KEEPCORE) are vm-extracted: no edits inside them.
- R3 Tab labels live in the `V` array and `nav` draw; `artifact-copy.test.ts` compares words with native, so run it after any label change.
- R4 Emoji render differently per OS; labels carry the meaning, emoji are `aria-hidden`.
- R5 A fixed bottom bar can cover inputs on mobile keyboards; keep >=104px bottom padding (native 120).
- R6 Dark becomes the first look; Daylight must stay readable (AC-5).
- R7 The file has very long lines; keep edits surgical (CSS block, nav draw, Home template).

## Assumptions (labelled)
A1 Follow OS light/dark, no picker. A2 Keep the artifact's 7 tabs (no Goals/level data). A3 Home keeps current data, no XP/streak. A4 Desktop shows the same bar, centred. A5 Floating Add focuses the existing quick-add input.
## Open questions
None blocking.

## G1 checklist
- [x] Every ledger row has requirements (US-1..5, AC-1..10)
- [x] Every AC testable, with priority
- [x] No architecture or code
- [x] Exclusions listed, assumptions labelled

## Stage 2 handoff prompt
"You are the UI/UX Designer. Read docs/artifact-parity/ITEM7-BLUEPRINT.md and native/src (uiTokens, themes, ui, Tabs, Home, Btn, Sheet, Fab, Toast). Produce a Design Handoff Spec for artifact/pera-artifact.html: the CSS token block (dark Lime Night, light Daylight), component styles (card, input, button primary/alt/danger, chip, row, bar, sheet, toast, tab bar, banner, empty state), per-tab banner tint/emoji/line, Home layout at 375 and 980px, and states (loading, empty, error, success, focus, disabled). Keep ids and data-a untouched. Say 'not tested on a phone'."
