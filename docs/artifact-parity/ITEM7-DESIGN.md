# Item 7 design handoff: artifact looks like native (Stage 2, UI/UX Designer)

Not tested on a phone. Contrast numbers are computed from the hex values (script in Stage 4 test). Visual only: no data or behaviour change. Source of truth: `native/src/uiTokens.ts`, `themes.ts` (LIME, light() at h=255), `ui.ts`, `Tabs.tsx`, `Home.tsx`, `Btn.tsx`, `Sheet.tsx`, `Fab.tsx`, `Toast.tsx`.

## 1. Token block (replaces lines 3-5 of the `<style>`)
Dark = Lime Night is the base when the OS is dark or `data-theme=dark`; Daylight when OS is light or `data-theme=light`. Keep BOTH override selectors and the two-line `@media` + `:root[data-theme=...]` pattern. Old names (`--acc --inc --exp --mut`) are kept as aliases so the 600 lines of inline `class="inc"` etc. keep working.
```css
:root{--bg:#F0EEF7;--card:#FFFFFF;--raised:#E2DEED;--line:#C1BCD2;--ink:#140E25;--mute:#4E4860;--pri:#5B3DF5;--onpri:#FFFFFF;--up:#06683A;--down:#B01A42;--warn:#8A5600;--reward:#8A5600;--overlay:#000000AA;
--h-violet:#D6CBF6;--h-teal:#EEEAC4;--h-plum:#D2F1F4;--h-navy:#D3F4CD;--h-amber:#F9E4B8;
--acc:var(--pri);--inc:var(--up);--exp:var(--down);--mut:var(--mute);
--sp-xs:4px;--sp-s:8px;--sp-m:12px;--sp-l:16px;--sp-xl:24px;--sp-xxl:32px;--sp-clear:120px;
--t-cap:13px;--t-body:16px;--t-lead:18px;--t-title:22px;--t-head:28px;--t-disp:40px;
--r-s:12px;--r-m:18px;--r-l:28px;--r-pill:999px;--touch:48px;
box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0E0B1A;--card:#1A1530;--raised:#241D42;--line:#33295C;--ink:#F2EFFF;--mute:#A59FC4;--pri:#B8F23A;--onpri:#0E0B1A;--up:#B8F23A;--down:#FF6B8E;--warn:#FFC247;--reward:#FFC247;--h-violet:#2B1F66;--h-teal:#0F3D3A;--h-plum:#4A1F4D;--h-navy:#14275E;--h-amber:#4A3510}}
:root[data-theme=dark]{/* same dark values as above, one line */}
```
Default look when no OS signal and no data-theme: Daylight (matches current file order). Dark values are the single source: put them in a shared comment so the two dark blocks stay identical (Stage 4 test compares them).

## 2. Base type and layout
`body{font:var(--t-body)/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}` (no Georgia). `h1,h2,.big{font-weight:800;font-family:inherit}`; `h1{font-size:var(--t-head)}`, `h2{font-size:var(--t-lead);font-weight:700;margin:0 0 var(--sp-s)}`, `.big{font-size:var(--t-head)}`, `.m{color:var(--mute);font-size:var(--t-cap)}`. `.w{max-width:980px;margin:0 auto;padding:0 var(--sp-l) var(--sp-clear)}`. Colours for money: `.inc` up, `.exp` down, `.warn` warn.

## 3. Components (CSS, all using tokens)
| Component | Rule |
|---|---|
| card | `background:var(--card);border:1px solid var(--line);border-radius:var(--r-m);padding:var(--sp-l);margin-bottom:var(--sp-m)` |
| input/select/textarea | `background:var(--raised);border:1px solid var(--line);border-radius:var(--r-s);padding:var(--sp-m);font-size:var(--t-lead);color:var(--ink);min-height:var(--touch)` (selects 16px min so iOS never zooms) |
| button (alt, default) | `background:var(--raised);color:var(--ink);border:1px solid var(--line);border-radius:var(--r-s);padding:var(--sp-m) var(--sp-l);min-height:var(--touch);font-weight:600` |
| button.p (primary) | `background:var(--pri);color:var(--onpri);border-color:var(--pri);font-weight:800;font-size:var(--t-body)` |
| .dz (danger) | `background:var(--down);border-color:var(--down);color:var(--onpri)` (dark onpri on pink 7.16, light white on crimson 6.83) |
| pressed/disabled | `button:active{opacity:.7}` `button:disabled{opacity:.7;cursor:not-allowed}` (native uses .7 for busy and pressed) |
| chip | `.chip,button[data-a=em]{border-radius:var(--r-pill);background:var(--raised);border:1px solid var(--line);padding:var(--sp-xs) var(--sp-m);min-height:var(--touch)}`; static tag `.tag{border-radius:var(--r-pill);padding:var(--sp-xs) var(--sp-s);font-size:var(--t-cap)}` (no min-height). Selected chip: `--pri` bg, `--onpri` text, weight 700. Edit label text: "⚙︎ Edit" / "Done" (id/data-a=em unchanged). |
| row (.tx) | `display:flex;justify-content:space-between;gap:var(--sp-s);padding:var(--sp-s) 0;border-bottom:1px solid var(--line)`; title 16 ink, caption 13 mute, amount weight 800 up/down/mute, trailing `›` in `--t-title` mute (aria-hidden, added with `::after` on clickable rows only so no markup change) |
| progress bar | `.bar{height:var(--sp-s);background:var(--raised);border-radius:var(--r-pill);overflow:hidden;margin:var(--sp-s) 0}` `.bar i{background:var(--reward)}` `i.w{background:var(--warn)}` `i.o{background:var(--down)}` (height 8; native Bar is 12 for budgets, we use 8 to match native Home level bar; one size app-wide) |
| quick-add (.say) | card look: `border:1px solid var(--line);border-radius:var(--r-m);background:var(--card)`; the accent 2px border goes; `#q` raised field, `#go` primary pill |
| focus | `:focus-visible{outline:3px solid var(--pri);outline-offset:2px}` on every control (primary vs bg 14.61 dark / 5.33 light, above 3:1) |
| sheet `#us` | overlay `.usb{background:var(--overlay)}`; `.uss{background:var(--card);border:1px solid var(--line);border-radius:var(--r-l) var(--r-l) 0 0;padding:var(--sp-l) var(--sp-l) calc(var(--sp-l) + env(safe-area-inset-bottom,0px));max-width:480px}`; at >=641px `border-radius:var(--r-l)` centred; buttons stacked full width, min 48, primary first (existing order unchanged) |
| tour bar `#tour .tc` | card look with `--r-m`, 1px line, shadow kept; `bottom:calc(var(--bar-h,72px) + 8px + safe-area)`; buttons min 48; `.tourhl{outline:3px solid var(--pri);border-radius:var(--r-s)}` |
| toast `#toast` | centred card: `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--card);border:2px solid var(--up);border-radius:var(--r-l);padding:var(--sp-l) var(--sp-xl);text-align:center;font-size:var(--t-title);font-weight:800;color:var(--ink);pointer-events:none;max-width:calc(100% - 2*var(--sp-l))`; `::before{content:"✓";display:block;color:var(--up);font-size:var(--t-head)}`; pop-in 0.8 to 1 scale 180 ms, none under reduced motion; `:empty{display:none}`. Keep `role=status aria-live=polite` (existing tests); TOASTCORE 2200 ms untouched. Error toasts are not used by TOASTCORE, so border always `--up`. |
| empty state | `<p class="m">` plain mute 16px sentence, never a blank card |
| error | `.err{color:var(--down)}` + visible "Try again" button (existing copy kept) |

## 4. Bottom tab bar (`#nav`), all widths
Position fixed bottom, full width; inner row `max-width:980px;margin:0 auto`. `background:var(--card);border-top:1px solid var(--line);padding:var(--sp-s) 0 calc(var(--sp-s) + env(safe-area-inset-bottom,0px));z-index:5;display:flex`. Button: `flex:1;min-width:0;min-height:var(--touch);border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:var(--sp-xs);padding:var(--sp-xs) 0;color:var(--mute);font-size:var(--t-cap);font-weight:500;border-radius:0`. Emoji span `font-size:var(--t-title);opacity:.55` (`aria-hidden="true"`), label span below with `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%`. Active: `.on{color:var(--pri);font-weight:800}` `.on .em{opacity:1}`. Light-mode label: primary on card 6.12 ok.
Markup change (nav draw only): `<button role="tab" aria-selected="true|false" aria-label="{long name}" data-a="v" data-k=".." class="on?"><span class="em" aria-hidden="true">🏠</span><span>Home</span></button>`; `#nav` gets `role="tablist"`. Drop the SVG `IC` set and `.lf/.ls/.ic` rules. `aria-current` is no longer used (no test greps it).
Order and glyphs (artifact keeps its 7 tabs, A2): 🏠 Home · 🧾 History · 🎯 Budgets · 👛 Accounts · 📊 Reports · 💬 Ask · ⚙️ Settings. Short label = existing `sh` word; `aria-label` = existing long name (Dashboard, Transactions...).
375px fit: 7 tabs = 53.5 px each. "Accounts" at 13px is about 56 px and would clip. Rule: `@media(max-width:480px){#nav button{font-size:12px}}` (one documented size exception to the token scale; at 12px "Accounts" is about 51 px). Ellipsis is the safety net; labels also carry aria-label so nothing is lost. Height about 68 px; body bottom padding `--sp-clear` (120) so the last row and the Add pill clear the bar. Set `--bar-h` from CSS only (72px default); no JS.

## 5. Page banner (every tab, from `eh()` and each tab's top)
`<div class="ban" style>` is replaced by classes `ban b-violet|b-navy|b-teal|b-plum|b-amber`: `margin:0 calc(-1*var(--sp-l)) var(--sp-l);padding:calc(var(--sp-l) + env(safe-area-inset-top,0px)) var(--sp-l) var(--sp-xl);border-radius:0 0 var(--r-l) var(--r-l);background:var(--h-*)`. Row 1: emoji `font-size:44px` (native `e.s`, only allowed extra size) left, Edit chip right (`data-a="em"`, id `emsg` kept after). Title `h2` at `--t-head` 800 ink; line `--t-body` mute. The top of the page: the old `h1` "Pera — tell it what happened" and the "Full app" link move into Settings-less footer text: keep the h1 text as a visually quiet `.m` line under the banner on Home only (do not delete: `#syhd` and the link stay in DOM, order unchanged).
| Tab (S.v) | Emoji | Title | Line (native words) | Tint | Dark / Light banner bg |
|---|---|---|---|---|---|
| tx | 🧾 | History | "Your latest entries." (native: "Your latest 200 entries.") | navy | #14275E / #D3F4CD |
| bud | 🎯 | Budgets | "What is left to spend this month." | plum | #4A1F4D / #D2F1F4 |
| acc | 👛 | Accounts | "Where your money sits right now." | teal | #0F3D3A / #EEEAC4 |
| rep | 📊 | Reports | "Where your money went." | amber | #4A3510 / #F9E4B8 |
| ask | 💬 | Ask | "Ask about your own entries." | violet | #2B1F66 / #D6CBF6 |
| set | ⚙️ | Settings | "Make Zovix yours." | violet | #2B1F66 / #D6CBF6 |
Home has no banner (native Home has none). "Reports/Ask" lines are new but use only plain words already in the app; Product Manager to confirm copy test.
Light tint hex come from native `light(h:255)` (hue-rotated, so teal looks yellow, plum looks cyan, navy looks green: this is exactly what native renders, copied on purpose for parity; Ced may veto).

## 6. Home layout
Order top to bottom: intro/keep cards (unchanged) · "Hi there" row (title `h1` 28/800, Edit chip right: only if `EM` exists, else omitted) · hero Total balance card · tiles grid · "See all accounts ›" · Recent · floating Add.
- Hero: `background:var(--h-violet);border-radius:var(--r-l);padding:var(--sp-l) var(--sp-xl);margin-bottom:var(--sp-m)`; caption "Total balance" 13 mute; amount `--t-head` 800 ink (red `--down` if negative). Mute on violet: 5.61 dark / 5.68 light.
- Tiles: `display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-s)`. Tile: card bg, `border:1px solid var(--line)`, `border-radius:var(--r-s)`, padding 12; caption 13 mute (name, ellipsis), amount `--t-lead` 800 ink or down. Spendable tile border `--up`, "🐷 Savings" border `--reward`. Order: each account, then Spendable, then Savings. Copy: "Spendable", "🐷 Savings" (native words; replaces "Spendable balance"/"Savings (not included)"; keep a `title` on the Savings tile "Not counted in Spendable"). Tile is a button (`data-a="v" data-k="acc"`) so it opens Accounts.
- "See all accounts ›": right-aligned link-button, primary 700, min 48.
- Recent: `h2` "Recent"; empty = "Nothing yet. Tap Add to log your first peso."; rows via `row0` (up to 6), trailing `›`.
- Floating Add: `<button class="fab" data-a="fab">` hidden label "＋ Add" (A5: focuses `#q`, scrolls top; Stage 3 decides the data-a value and adds it to the id list). `position:fixed;right:var(--sp-l);bottom:calc(var(--bar-h,72px) + var(--sp-l) + env(safe-area-inset-bottom,0px));background:var(--pri);color:var(--onpri);border-radius:var(--r-pill);padding:var(--sp-l) var(--sp-xl);font-size:var(--t-lead);font-weight:800;min-height:var(--touch)`; shown on every tab except Settings/Ask. Hidden while `#us` or `#tour` is open (`body.ov .fab{display:none}` is optional; use z-index 6 < tour 20 < toast 25 < sheet 30 instead).
- 375px: single column, `.w` side gutter 16, tiles 2 columns (each about 165 px wide), amounts use `font-size:clamp(14px,4.4vw,18px)` fallback so "₱ 123,456.78" never wraps; `.fab` bottom right does not overlap the last row (120 bottom padding).
- 980px: `.w` max-width 980 centred; banner full-bleed within `.w`; tiles `repeat(auto-fit,minmax(200px,1fr))` (3 to 4 per row); tab bar spans the viewport with its buttons centred inside 980; `.fab` sits at `right:max(var(--sp-l),calc(50% - 490px + var(--sp-l)))`.

## 7. States (every screen)
| State | Look |
|---|---|
| loading | existing "Loading your data..." card; add `.sk` skeleton blocks (raised bg, radius 12, shimmer off under reduced motion) matching card heights when the sync card shows |
| empty | single mute sentence, native wording (see tables); never a blank card |
| error | `--down` text + Try again button (alt style) |
| success | centred toast card, 2200 ms, replaces the old one |
| focus | 3px `--pri` ring, offset 2 |
| disabled/busy | opacity .7, `cursor:not-allowed`, button label unchanged |
| pressed | opacity .7 |
| reduced motion | all new animations removed (toast pop, shimmer, outline transitions) |

## 8. Contrast (computed, WCAG ratio; need >= 4.5 for text)
Dark Lime Night: ink/bg 17.17, ink/card 15.55, ink/raised 13.97; mute/bg 7.73, /card 7.00, /raised 6.29; primary=up on bg 14.61, card 13.23, raised 11.88; down on bg 7.16, card 6.49, raised 5.83; warn on card 10.94; onPrimary/primary 14.61; banner ink >= 10.27 and mute >= 4.62 (amber lowest) on all five tints.
Light Daylight: ink/bg 16.33, /card 18.76, /raised 14.21; mute/bg 7.55, /card 8.68, /raised 6.57; primary on bg 5.33, card 6.12, raised 4.64 (lowest, passes); up on card 6.89, raised 5.22; down on card 6.83, raised 5.18; warn on card 6.16, raised 4.66; onPrimary/primary 6.12; banner ink >= 12.27, mute >= 5.68.
Rule: warn/primary text never sits on a banner tint (only ink and mute do). All pass 4.5:1. The `line` token is a border, not text (decorative; 3:1 not required).

## 9. MUST stay unchanged (R1/R2)
- ids: `q go nav view warn toast tour us syhd emsg`, `e-*`, `nc-*`, `clrt`, `clrc`, `xf`, `xt`, `csv`; classes used by JS: `.tx .row .acts .tourhl .usb .uss .usbt .tc .tt .tb .pend .lb .ed .wide .flt .hint .more .tag .big .m .inc .exp .warn .bar i.o i.w`.
- every `data-a` value found in the file (adc adr am ask bkc bkr ca cdc cdr cf cfx chk clr clrc cm ct cx del dup ed em exp impgo kcc kck more na neg ok pc pd per ps pt rest rm rra rrd sd sdc sy tb tn tno tst tx0 undo urc urr v) and `data-k`; `data-a="v"` still sets `S.v`.
- roles/aria: `role=status aria-live=polite` on toast; `role=region aria-label` on intro/keep cards; `aria-modal`, `aria-labelledby` on `#us`; `aria-label` on `#q`; text strings `tourGo`, `holdForm()`, `curForm()`, `S.v=`.
- the 8 marker blocks (CSVCORE, UNDOCORE, SAMPLECORE, UNSAVEDCORE, INTROCORE, LIMITSCORE, TOASTCORE, KEEPCORE) byte for byte.
- the `V` array and `drawNow` routing; the nav `aria-label` long names; no `parseFloat`, no new `any`, no new library or font.
- Only deliberate markup changes: `#nav` role=tablist and button inner spans (section 4); banner wrapper in `eh()` and Home template; `.fab` button added.

## 10. Copy (match native)
"Total balance", "Spendable", "🐷 Savings", "See all accounts ›", "Recent", "＋ Add", "Edit"/"Done", "Nothing yet. Tap Add to log your first peso." Banner lines above. Run `tests/artifact-copy.test.ts` after.

## 11. Coverage review and open design issues
Every blueprint AC has a spec home: AC-1/2 sections 1-3, AC-3 section 4, AC-4 sections 4 and 6, AC-5 section 8, AC-6 section 6, AC-7 section 3, AC-8 section 3, AC-9 section 9, AC-10 sections 4 and 6. Ledger IL-1..IL-5 all map (IL-2: no picker, no avatar).
Open: (1) Reports/Ask banner lines are new copy. (2) Light banner tints look odd (yellow/cyan/green) but equal native. (3) 12px tab label under 480px deviates from the 13px token. (4) Floating Add data-a name is for Stage 3.

## Stage 3/4 handoff prompt
"You are the Mobile App Developer (Stage 3 backend is not needed: no data change). Implement docs/artifact-parity/ITEM7-DESIGN.md in artifact/pera-artifact.html by editing ONLY: the `<style>` block, the `#nav` draw line in drawNow, `eh()`, the `home()` template, row0 chevron, and a `.fab` button. First write tests: (a) CSS holds the Lime Night and Daylight hex values and the three var families, no `#0b6e6a`/`Georgia`; (b) contrast helper >= 4.5 for the pairs in section 8; (c) `#nav` has 7 `role=tab` buttons with `aria-selected` and aria-hidden emoji; (d) every id/data-a in section 9 still present; (e) marker blocks byte-identical (hash). Then `npm run verify`, `npm test`, `npm run format`, and a browser check at 375 and 980 px (no sideways scroll, tap targets >= 44, dark and light) saying it is not tested on a phone. Submit to the QA Engineer before any republish; no push to main, no republish without Ced's yes."
