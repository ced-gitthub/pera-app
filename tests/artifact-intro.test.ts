// Item 5 (AC-50): an optional first-run tour offer. Core logic here; screen wiring is checked by source scans at the bottom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, J, type St } from './artifact-undo-kit.ts';

type Step = { tab: string; title: string; text: string; target: string };
type Intro = {
  KEY: string;
  OFFER_TITLE: string;
  OFFER_BODY: string;
  START: string;
  NOT_NOW: string;
  SKIP_LABEL: string;
  BACK: string;
  NEXT: string;
  DONE: string;
  steps(): Step[];
  ownData(S: St): boolean;
  introState(a: { fresh: number; ownData: boolean; flag: boolean }): 'offer' | 'done';
  flag: { read(store: unknown): boolean; write(store: unknown): boolean };
  state(S: St, store: unknown): 'offer' | 'done';
  next(i: number): number;
  back(i: number): number;
  skip(i: number): number;
  label(i: number): string;
  counter(i: number): string;
};
const INTRO = vm.runInNewContext(`${slice('INTROCORE')};INTRO`) as Intro;

const mem = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const own = (o: St = {}): St => ({ tx: [], trash: [], rec: [], bud: {}, open: {}, ...o });

test('AC-50 words: native offer title and buttons, artifact-only body', () => {
  assert.equal(INTRO.OFFER_TITLE, 'Take a quick tour?');
  assert.equal(INTRO.OFFER_BODY, 'The tour walks through each tab using what is in your app now.');
  assert.equal(INTRO.START, 'Start the tour');
  assert.equal(INTRO.NOT_NOW, 'Not now');
  assert.equal(INTRO.SKIP_LABEL, 'Skip the tour');
  assert.deepEqual([INTRO.BACK, INTRO.NEXT, INTRO.DONE], ['Back', 'Next', 'Done']);
  assert.equal(INTRO.KEY, 'mt1tour');
});

test('AC-50 introState: only a fresh device with no own data and no flag is offered the tour', () => {
  assert.equal(INTRO.introState({ fresh: 1, ownData: false, flag: false }), 'offer');
  assert.equal(INTRO.introState({ fresh: 0, ownData: false, flag: false }), 'done');
  assert.equal(INTRO.introState({ fresh: 1, ownData: true, flag: false }), 'done');
  assert.equal(INTRO.introState({ fresh: 1, ownData: false, flag: true }), 'done');
  assert.equal(INTRO.introState({ fresh: 0, ownData: true, flag: true }), 'done');
  assert.equal(INTRO.introState({ fresh: undefined as unknown as number, ownData: false, flag: false }), 'done');
});

test('AC-50 ownData: any non-sample entry, anything in the bin, a rule, a budget or a non-zero opening balance counts', () => {
  assert.equal(INTRO.ownData(own()), false);
  assert.equal(INTRO.ownData(own({ tx: [{ id: 'd1', demo: 1 }] })), false, 'sample rows are not own data');
  assert.equal(INTRO.ownData(own({ tx: [{ id: 'd1', demo: 1 }, { id: 'a' }] })), true);
  assert.equal(INTRO.ownData(own({ trash: [{ id: 'x' }] })), true);
  assert.equal(INTRO.ownData(own({ rec: [{ id: 'r' }] })), true);
  assert.equal(INTRO.ownData(own({ bud: { Food: 3000 } })), true);
  assert.equal(INTRO.ownData(own({ open: { Cash: 0 } })), false, 'a zero opening balance is not data');
  assert.equal(INTRO.ownData(own({ open: { Cash: -5 } })), true);
  assert.equal(INTRO.ownData({} as St), false, 'missing fields are tolerated');
  assert.equal(INTRO.ownData(null as unknown as St), true, 'unreadable state: do not nag');
});

test('AC-50 flag: Skip, Not now and Done write it; a broken store never forces the tour', () => {
  const s = mem();
  assert.equal(INTRO.flag.read(s), false);
  assert.equal(INTRO.flag.write(s), true);
  assert.equal(s.m.get('mt1tour'), '1');
  assert.equal(INTRO.flag.read(s), true);
  const bad = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(INTRO.flag.read(bad), true, 'unreadable = treat as done');
  assert.equal(INTRO.flag.write(bad), false);
  assert.equal(INTRO.flag.read(null), true);
});

test('AC-50 state: the three inputs together, reading the flag from the store', () => {
  const s = mem();
  const fresh = own({ fresh: 1, tx: [{ id: 'd1', demo: 1 }] });
  assert.equal(INTRO.state(fresh, s), 'offer');
  INTRO.flag.write(s);
  assert.equal(INTRO.state(fresh, s), 'done');
  assert.equal(INTRO.state({ ...fresh, fresh: 0 }, mem()), 'done');
  assert.equal(INTRO.state({ ...fresh, bud: { A: 1 } }, mem()), 'done');
});

test('AC-50 steps: at most 7, each text at most 150 characters, real tabs, no empty words', () => {
  const st = J(INTRO.steps());
  assert.equal(st.length, 7);
  assert.deepEqual(
    st.map((x: Step) => x.title),
    ['Home', 'Add an entry', 'Transactions', 'Accounts', 'Budgets', 'Reports', 'Ask'],
  );
  assert.deepEqual(
    st.map((x: Step) => x.tab),
    ['home', 'home', 'tx', 'acc', 'bud', 'rep', 'ask'],
  );
  for (const x of st) {
    assert.ok(x.text.length > 10 && x.text.length <= 150, `${x.title}: ${x.text.length}`);
    assert.ok(x.target.length > 0, `${x.title} points at something`);
  }
});

test('AC-50 navigation: Next walks forward, the last Next is Done and ends the tour, Back stops at the first step', () => {
  assert.equal(INTRO.next(0), 1);
  assert.equal(INTRO.next(5), 6);
  assert.equal(INTRO.next(6), -1, 'Done ends it');
  assert.equal(INTRO.back(3), 2);
  assert.equal(INTRO.back(0), 0);
  assert.equal(INTRO.back(-1), 0);
  assert.equal(INTRO.label(0), 'Next');
  assert.equal(INTRO.label(5), 'Next');
  assert.equal(INTRO.label(6), 'Done');
  assert.equal(INTRO.counter(0), '1 of 7');
  assert.equal(INTRO.counter(6), '7 of 7');
});

test('AC-50 Skip at every step ends the tour', () => {
  for (let i = 0; i < 7; i++) assert.equal(INTRO.skip(i), -1, 'step ' + i);
});

test('AC-50 the core never touches the data it is asked about', () => {
  const S = own({ fresh: 1, tx: [{ id: 'd1', demo: 1 }], bud: {}, open: { Cash: 5 } });
  const before = J(S);
  INTRO.ownData(S);
  INTRO.state(S, mem());
  assert.deepEqual(J(S), before);
});

// ---- wiring ----
const handler = (a: string) => HTML.match(new RegExp(`else if\\(a=='${a}'\\)[^\\n]*`))?.[0] ?? '';

test('AC-50 wiring: the offer is one card on Home, not a modal; Start does not write the flag; Not now does', () => {
  const card = HTML.match(/const introCard=[^\n]*/)?.[0] ?? '';
  assert.ok(
    card.includes('INTRO.state(') && card.includes('INTRO.OFFER_TITLE') && card.includes('data-a="tst"') && card.includes('data-a="tno"'),
  );
  assert.ok(!/role="(alert)?dialog"/.test(card), 'not a dialog');
  assert.ok(
    /function home\(\)[^\n]*\n[^\n]*\$\{introCard\(\)\}/.test(HTML) ||
      /\$\{introCard\(\)\}\$\{kcCard\(\)\}|\$\{kcCard\(\)\}\$\{introCard\(\)\}/.test(HTML),
    'on Home',
  );
  assert.ok(handler('tst').includes('tourGo(0)') && !handler('tst').includes('flag.write'), 'Start');
  assert.ok(handler('tno').includes('INTRO.flag.write('), 'Not now');
});

test('AC-50 wiring: Keep/Clear stays hidden while the tour is on offer or running', () => {
  const kc = HTML.match(/const kcCard=[^\n]*/)?.[0] ?? '';
  assert.ok(kc.includes("INTRO.state(S,localStorage)!='offer'"), 'only when the offer is settled');
});

test('AC-50 wiring: every tour step has Back, Next/Done and Skip; Esc ends it; reload does not resume it', () => {
  const t = HTML.slice(HTML.indexOf('function tourDraw'), HTML.indexOf('function tourEnd') + 400);
  for (const w of ['data-a="tb"', 'data-a="tn"', 'data-a="tx0"', 'INTRO.SKIP_LABEL', 'INTRO.label(', 'INTRO.counter('])
    assert.ok(t.includes(w), w);
  assert.ok(handler('tx0').includes('tourEnd('), 'Skip');
  assert.ok(/function tourEnd\([^)]*\)\{[^\n]*INTRO\.flag\.write\(/.test(HTML), 'ending writes the flag');
  assert.ok(/e\.key=='Escape'[^\n]*TOUR>=0/.test(HTML) || /TOUR>=0[^\n]*e\.key=='Escape'/.test(HTML), 'Esc');
  assert.ok(/let TOUR=-1/.test(HTML), 'a reload starts with no tour running');
});

test('AC-50 wiring: the tour switches tabs without data changes and the flag is never synced', () => {
  const t = HTML.slice(HTML.indexOf('function tourGo'), HTML.indexOf('function tourEnd'));
  assert.ok(t.includes('S.v=') && !t.includes('S.tx') && !/\bsave\(/.test(t), 'only the open tab changes, nothing is saved');
  const toRecs = HTML.slice(HTML.indexOf('function toRecs()'), HTML.indexOf('function rebuild()'));
  assert.ok(!toRecs.includes('mt1tour') && !toRecs.includes('INTRO'), 'never synced');
});

test('Back never ends the tour: from step 0 (and any bad index) it stays on a real step; the button only shows after step 0', () => {
  for (const i of [-5, -1, 0]) assert.equal(INTRO.back(i), 0, String(i));
  for (let i = 1; i < 7; i++) assert.equal(INTRO.back(i), i - 1, String(i));
  for (let i = -1; i < 8; i++) assert.ok(INTRO.back(i) >= 0, 'tourGo(back) must not hit its end branch: ' + i);
  assert.ok(HTML.includes("(TOUR>0?'<button data-a=\"tb\">'+INTRO.BACK+'</button>':'')"), 'Back is hidden on the first step');
  assert.ok(HTML.includes('function tourGo(i){if(i<0){tourEnd();return}'));
  assert.ok(HTML.includes("else if(a=='tb'){gnav(()=>tourGo(INTRO.back(TOUR)))}"), 'Back goes through the guard');
});
