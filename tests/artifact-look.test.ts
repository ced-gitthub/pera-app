// Item 7: the artifact looks like the native app (Lime Night dark, Daylight light). Visual only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { HTML, slice } from './artifact-undo-kit.ts';

const CSS = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

// Token values are read from the real CSS, so the test cannot drift from the file.
const rootBlock = CSS.slice(CSS.indexOf(':root{'), CSS.indexOf('@media(prefers-color-scheme:dark)'));
const darkMedia = CSS.slice(CSS.indexOf('@media(prefers-color-scheme:dark)'), CSS.indexOf(':root[data-theme=dark]'));
const darkAttr = CSS.slice(CSS.indexOf(':root[data-theme=dark]'));
const tokens = (block: string) => {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):(#[0-9A-Fa-f]{6,8})/g)) out[m[1]] = m[2].toUpperCase();
  return out;
};
const LIGHT = tokens(rootBlock);
const DARK = tokens(darkMedia);

const LIME_NIGHT = {
  bg: '#0E0B1A',
  card: '#1A1530',
  raised: '#241D42',
  line: '#33295C',
  ink: '#F2EFFF',
  mute: '#A59FC4',
  pri: '#B8F23A',
  onpri: '#0E0B1A',
  up: '#B8F23A',
  down: '#FF6B8E',
  warn: '#FFC247',
  reward: '#FFC247',
  'h-violet': '#2B1F66',
  'h-teal': '#0F3D3A',
  'h-plum': '#4A1F4D',
  'h-navy': '#14275E',
  'h-amber': '#4A3510',
};
const DAYLIGHT = {
  bg: '#F0EEF7',
  card: '#FFFFFF',
  raised: '#E2DEED',
  line: '#C1BCD2',
  ink: '#140E25',
  mute: '#4E4860',
  pri: '#5B3DF5',
  onpri: '#FFFFFF',
  up: '#06683A',
  down: '#B01A42',
  warn: '#8A5600',
  reward: '#8A5600',
  'h-violet': '#D6CBF6',
  'h-teal': '#EEEAC4',
  'h-plum': '#D2F1F4',
  'h-navy': '#D3F4CD',
  'h-amber': '#F9E4B8',
};

test('(a) Lime Night and Daylight values, token families, no old look', () => {
  for (const [k, v] of Object.entries(LIME_NIGHT)) assert.equal(DARK[k], v, `dark --${k}`);
  for (const [k, v] of Object.entries(DAYLIGHT)) assert.equal(LIGHT[k], v, `light --${k}`);
  assert.deepEqual(tokens(darkAttr), DARK, 'both dark selectors hold the same values');
  assert.match(CSS, /:root\[data-theme=dark\]/);
  assert.match(CSS, /:root:not\(\[data-theme=light\]\)/);
  for (const n of [4, 8, 12, 16, 24, 32]) assert.ok(CSS.includes(`:${n}px`) || CSS.includes(`${n}px;`), `space ${n}`);
  for (const n of ['--sp-xs:4px', '--sp-s:8px', '--sp-m:12px', '--sp-l:16px', '--sp-xl:24px', '--sp-xxl:32px', '--sp-clear:120px'])
    assert.ok(rootBlock.includes(n), n);
  for (const n of ['--t-cap:13px', '--t-body:16px', '--t-lead:18px', '--t-title:22px', '--t-head:28px', '--t-disp:40px'])
    assert.ok(rootBlock.includes(n), n);
  for (const n of ['--r-s:12px', '--r-m:18px', '--r-l:28px', '--r-pill:999px', '--touch:48px']) assert.ok(rootBlock.includes(n), n);
  assert.ok(!/#0b6e6a/i.test(HTML), 'old teal gone');
  assert.ok(!/Georgia/.test(HTML), 'serif gone');
  assert.match(CSS, /\.card\{[^}]*var\(--r-m\)/);
  assert.match(CSS, /button[^{]*\{[^}]*var\(--touch\)/);
  assert.match(CSS, /:focus-visible\{outline:3px solid var\(--pri\)/);
  assert.match(CSS, /prefers-reduced-motion:reduce/);
});

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS: [string, string][] = [
  ['ink', 'bg'],
  ['ink', 'card'],
  ['ink', 'raised'],
  ['mute', 'bg'],
  ['mute', 'card'],
  ['mute', 'raised'],
  ['pri', 'bg'],
  ['pri', 'card'],
  ['pri', 'raised'],
  ['up', 'card'],
  ['up', 'raised'],
  ['down', 'card'],
  ['down', 'raised'],
  ['warn', 'card'],
  ['onpri', 'pri'],
  ['onpri', 'down'],
  ['ink', 'h-violet'],
  ['ink', 'h-teal'],
  ['ink', 'h-plum'],
  ['ink', 'h-navy'],
  ['ink', 'h-amber'],
  ['mute', 'h-violet'],
  ['mute', 'h-teal'],
  ['mute', 'h-plum'],
  ['mute', 'h-navy'],
  ['mute', 'h-amber'],
];

test('(b) contrast >= 4.5 for the spec pairs in both palettes', () => {
  for (const [name, t] of [
    ['dark', DARK],
    ['light', LIGHT],
  ] as const)
    for (const [fg, bg] of PAIRS) {
      if (name === 'light' && fg === 'warn' && bg === 'raised') continue;
      assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${name} ${fg} on ${bg} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
    }
  assert.ok(Math.abs(ratio(DARK.ink, DARK.bg) - 17.17) < 0.05, 'helper matches the design numbers');
});

test('(c) #nav is a tablist of 7 role=tab buttons with aria-selected and hidden emoji', () => {
  const line = HTML.split('\n').find((l) => l.includes("$('#nav').innerHTML"));
  assert.ok(line, 'nav draw line');
  const rows = [...line.matchAll(/\['(\w+)','([A-Za-z]+)','([A-Za-z]+)','[^']+'\]/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['home', 'tx', 'bud', 'acc', 'rep', 'ask', 'set']);
  assert.match(HTML, /<nav id="nav" role="tablist"/);
  const tpl = line.slice(line.indexOf('.map(')).match(/`<button[^`]*`/)![0];
  assert.match(tpl, /role="tab"/);
  assert.match(tpl, /aria-selected="\$\{S\.v==k\?'true':'false'\}"/);
  assert.match(tpl, /<span class="em" aria-hidden="true">/);
  assert.match(tpl, /data-a="v" data-k="\$\{k\}"/);
  assert.match(tpl, /aria-label="\$\{n\}"/);
  for (const e of ['🏠', '🧾', '🎯', '👛', '📊', '💬', '⚙️']) assert.ok(line.includes(e), e);
  assert.ok(!/<svg/.test(line), 'svg icons dropped');
  assert.ok(!line.includes('aria-current'));
});

const DATA_A =
  'adc adr am ask bkc bkr ca cdc cdr cf cfx chk clr clrc cm ct cx del dup ed em exp impgo kcc kck more na neg ok pc pd per ps pt rest rm rra rrd sd sdc sy tb tn tno tst tx0 undo urc urr v'.split(
    ' ',
  );
const IDS = 'q go nav view warn toast syhd emsg clrt clrc xf xt csv'.split(' ');

test('(d) every id and data-a from the spec is still present; new fab is wired', () => {
  for (const a of DATA_A) assert.ok(HTML.includes(`data-a="${a}"`), `data-a ${a} must exist as real markup`);
  for (const a of DATA_A)
    assert.ok(
      HTML.includes(`a=='${a}'`) || HTML.includes(`a=="${a}"`) || a === 'v' || /^us-/.test(a) || HTML.includes(`'${a}'`),
      `handler ${a}`,
    );
  for (const id of IDS) assert.match(HTML, new RegExp(`id=\\\\?["']${id}`), `id ${id}`);
  assert.match(HTML, /\btour\b/);
  for (const s of ['tourGo', 'holdForm()', 'curForm()', 'S.v=', 'role="status" aria-live="polite"', 'aria-label="What happened?"'])
    assert.ok(HTML.includes(s), s);
  for (const c of [
    'tx',
    'row',
    'acts',
    'tourhl',
    'usb',
    'uss',
    'usbt',
    'tc',
    'tt',
    'tb',
    'pend',
    'lb',
    'ed',
    'wide',
    'flt',
    'hint',
    'more',
    'tag',
    'big',
    'm',
    'inc',
    'exp',
    'warn',
  ])
    assert.match(CSS, new RegExp(`\\.${c}[{.,: >\\[]`), `class .${c}`);
  assert.match(HTML, /<button class="fab" data-a="fab"/);
  assert.match(HTML, /a=='fab'/);
  assert.ok(!/parseFloat/.test(HTML), 'no parseFloat');
});

// Hashes of the 8 marker blocks taken from HEAD before this change (4cee31b).
const MARKERS: Record<string, string> = {
  CSVCORE: '78d4623bb0dd2abd',
  UNDOCORE: '64b8e2f6e10a855c',
  SAMPLECORE: '192619924cfe3dd6',
  UNSAVEDCORE: 'b582a08e5640bc91',
  INTROCORE: 'c14d258ade1db611',
  LIMITSCORE: 'e3daa6c6a9869221',
  TOASTCORE: '36a471e38c3b963b',
  KEEPCORE: '0da93e158c293800',
};

test('(e) the 8 marker blocks are byte-identical to HEAD', () => {
  for (const [n, h] of Object.entries(MARKERS)) assert.equal(crypto.createHash('sha256').update(slice(n)).digest('hex').slice(0, 16), h, n);
});

test('home and banners use the native layout', () => {
  assert.ok(
    HTML.includes('Total balance') && HTML.includes('See all accounts ›') && HTML.includes('Nothing yet. Tap Add to log your first peso.'),
  );
  assert.ok(HTML.includes('>Spendable<') && HTML.includes('🐷 Savings'));
  assert.ok(!/class="chev"/.test(slice2('const row0=', '\n')), 'Recent rows are not tappable, so no arrow');
  const eh = vm.runInNewContext(`let EM=0;${HTML.slice(HTML.indexOf('const BAN='), HTML.indexOf('\n', HTML.indexOf('const eh=')))};eh`) as (
    t: string,
  ) => string;
  assert.ok(eh('Transactions').includes('<h2>History</h2>'), 'banner title is History');
  const out = eh('Budgets');
  assert.ok(out.includes('data-a="em"') && out.includes('id="emsg"') && out.includes('Budgets') && out.includes('ban b-plum'));
});

const slice2 = (from: string, to: string) => {
  const a = HTML.indexOf(from);
  assert.ok(a >= 0, from);
  return HTML.slice(a, HTML.indexOf(to, a + from.length));
};
const zOf = (sel: string) => {
  const m = CSS.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\{[^}]*z-index:(\\d+)'));
  assert.ok(m, 'z-index for ' + sel);
  return Number(m[1]);
};

test('QA fixes: no old header, Home starts with Hi + hero, quick-add below, one Add on Home', () => {
  assert.ok(!HTML.includes('tell it what happened'), 'old header gone');
  assert.match(HTML, /<div class="w">\s*<div id="warn"><\/div><div id="view"><\/div>\s*<div class="say">/);
  assert.ok(!/<button class="p" id="go">Add<\/button>/.test(HTML), 'quick-add button is not also called Add');
  const home = slice2('function home()', '\nfunction summ');
  const iHi = home.indexOf('class="hi">Hi');
  assert.ok(iHi > 0, 'greeting Hi on Home');
  const iHero = home.indexOf('class="hero"');
  assert.ok(iHero > iHi && iHero < home.indexOf('${introCard()}'), 'hero before the intro card');
  assert.ok(iHero < home.indexOf('${kcCard()}'), 'hero before the sample-entries card');
  assert.ok(!home.includes('<div class="card"><h2>Recent'), 'Recent rows are loose, not in a card');
  assert.ok(home.includes('See all history ›'));
  assert.match(HTML, /Full app: <a href="https:\/\/pera-app-beta\.vercel\.app"/);
  assert.ok(slice2('function setv()', '\nfunction ').includes('id="syhd"') || HTML.includes('<span id="syhd"></span>Full app'));
  assert.ok(HTML.indexOf('<span id="syhd">') > HTML.indexOf('function setv()'), 'sync status and Full app link live in Settings');
});

test('QA fixes: banners sit at the top of each tab, outside cards, History title', () => {
  assert.ok(slice2('function setv()', '\n').startsWith("function setv(){return`${ban('Settings')}"), 'Settings banner first');
  assert.ok(slice2('function repv()', '\nfunction ').includes("return ban('Reports')+summ()"));
  assert.ok(slice2('function askv()', '\n').startsWith("function askv(){return`${ban('Ask')}"));
  assert.ok(slice2('function txv()', '\n').includes('return`${eh(\'Transactions\')}<div class="card">'));
  assert.ok(slice2('function budv()', '\nfunction ').includes("return`${eh('Budgets')}"));
  assert.ok(slice2('function accv()', '\nfunction ').includes("return`${eh('Accounts')}"));
  const bans = slice2('const BAN=', '\nconst eh');
  for (const s of ["'History'", '📊', 'Where your money went.', '💬', 'Ask about your own entries.', 'Make Zovix yours.'])
    assert.ok(bans.includes(s), s);
  assert.match(CSS, /\.ban\{[^}]*flex-wrap:wrap/);
  assert.match(CSS, /\.ban \.bt\{[^}]*min-width:0/);
  assert.match(CSS, /\.b-amber\{/);
  assert.match(CSS, /button\[data-a=em\]|\.chip/);
});

test('QA fixes: history rows do not inherit the tour class; caption on its own line', () => {
  const lst = slice2('function lst()', '\nfunction budv');
  assert.ok(!lst.includes('class="tt"'), 'row class .tt collides with the tour rule');
  assert.match(lst, /class="rd"/);
  assert.match(CSS, /\.rd>\.m\{display:block/);
  assert.match(CSS, /\.tt\{display:flex;justify-content:space-between/);
});

test('QA fixes: tab bar is fixed, fab hidden on Settings and Ask, stacking order', () => {
  assert.match(CSS, /#nav\{position:fixed;left:0;right:0;bottom:0/);
  assert.match(CSS, /\.fab\{position:fixed/);
  assert.match(CSS, /\[data-k=set\]\) \.fab,body:has\(#nav \[aria-selected=true\]\[data-k=ask\]\) \.fab\{display:none\}/);
  const bar = Math.max(zOf('#nav'), zOf('.fab'));
  for (const s of ['#tour', '.toast', '#us']) assert.ok(zOf(s) > bar, s + ' is above the tab bar and fab');
  assert.ok(zOf('#us') > zOf('.toast') && zOf('.toast') > zOf('#tour'));
});
