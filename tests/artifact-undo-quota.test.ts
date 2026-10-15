import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, device, J, type St } from './artifact-undo-kit.ts';

// Real browser limit: 5,242,880 chars, counting key + value of every key. Live data, sync state and backups share it.
const QUOTA = 5_242_880;
const entry = (i: number) => ({
  id: 'tmgq1ab' + String(i).padStart(7, '0'),
  n: i,
  notes: 'paid in cash at the corner store',
  desc: 'Jollibee lunch ' + i,
  acct: 'GCash',
  created: '2026-10-01',
  updated: '2026-10-01',
  date: '2026-10-01',
  type: 'expense',
  amount: 185.5,
  cat: 'Food',
});
const state = (n: number): St => ({
  tx: Array.from({ length: n }, (_, i) => entry(i)),
  trash: [],
  bud: { Food: 3000 },
  rec: [],
  open: { GCash: 100 },
  accts: ['GCash'],
  cats: { inc: [], exp: ['Food'] },
  fresh: 0,
});
// Six rotating backups (newest first) that together take about `chars`.
const backups = (chars: number) => {
  const per = Math.floor(chars / 6 / 265);
  return JSON.stringify(
    Array.from({ length: 6 }, (_, k) => ({
      at: 1_700_000_000_000 - k * 1000,
      why: 'daily',
      n: per,
      d: { tx: state(per).tx, bud: {}, rec: [] },
    })),
  );
};
const full = (n: number, bkChars: number, extra: Record<string, string> = {}) => {
  const s = state(n);
  return device({
    state: s,
    limit: QUOTA,
    preload: { mt1: JSON.stringify(s), mt1sy: 'y'.repeat(400_000), mt1bk: backups(bkChars), ...extra },
  });
};
type Dev = ReturnType<typeof device>;
const watchSets = (d: Dev) => {
  const sets: string[] = [];
  const set = d.mem.set.bind(d.mem);
  d.mem.set = (k: string, v: string) => (sets.push(k === 'mt1bk' ? 'mt1bk:' + (JSON.parse(v) as unknown[]).length : k), set(k, v));
  return sets;
};

test('8,000 entries with 1.5M of backups on a real 5,242,880-char store: clear succeeds, oldest backups trimmed, exact restore', () => {
  const d = full(8000, 1_500_000);
  const bk0 = JSON.parse(d.mem.get('mt1bk') as string) as { at: number }[];
  assert.equal(bk0.length, 6);
  const mt1 = d.mem.get('mt1');
  const p = d.U.plan(d.U.counts());
  assert.equal(p.tooBig, false);
  assert.equal(p.mayTrim, true, 'the panel is told backups may be trimmed');
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  assert.equal(d.S.tx.length, 0);
  assert.equal(d.mem.get('mt1'), mt1, 'live data key untouched by the undo logic');
  const bk1 = JSON.parse(d.mem.get('mt1bk') as string) as { at: number }[];
  assert.ok(bk1.length < 6, 'some backups were trimmed');
  assert.deepEqual(J(bk1.map((b) => b.at)), J(bk0.slice(0, bk1.length).map((b) => b.at)), 'newest kept, oldest went first');
  const back = d.U.restore(r.id as string);
  assert.equal(back.ok, true);
  assert.equal(back.got?.tx, 8000);
  assert.equal(back.skipped, 0);
  assert.equal(d.S.tx.length, 8000);
});

test('9,000 entries with 1.0M of backups: clear succeeds and restores the exact counts', () => {
  const d = full(9000, 1_000_000);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  const back = d.U.restore(r.id as string);
  assert.equal(back.got?.tx, 9000);
  assert.equal(d.S.tx.length, 9000);
});

test('backups are trimmed one at a time, oldest first', () => {
  const d = full(8000, 1_500_000);
  const sets = watchSets(d);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  const sizes = sets.filter((k) => k.startsWith('mt1bk:')).map((k) => Number(k.slice(6)));
  assert.ok(sizes.length >= 1);
  assert.deepEqual(J(sizes), J(sizes.map((_, i) => 5 - i)), 'one backup fewer each step');
});

test('20,000 entries cannot fit: refused, nothing deleted, backups not even rewritten', () => {
  const d = full(20_000, 1_500_000);
  const bk = d.mem.get('mt1bk');
  const mt1 = d.mem.get('mt1');
  const sets = watchSets(d);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(d.S.tx.length, 20_000);
  assert.equal(d.mem.get('mt1bk'), bk);
  assert.equal(d.mem.get('mt1'), mt1);
  assert.deepEqual(J(sets.filter((k) => k.startsWith('mt1bk'))), []);
});

test('under the 2.5M copy limit but no room even with every backup gone: refused as undo, backups untouched', () => {
  const d = full(8000, 1_500_000, { mt1x: 'z'.repeat(1_400_000) });
  const bk = d.mem.get('mt1bk');
  const sets = watchSets(d);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'undo');
  assert.equal(d.S.tx.length, 8000);
  assert.equal(d.mem.get('mt1bk'), bk);
  assert.deepEqual(J(sets.filter((k) => k.startsWith('mt1bk'))), []);
});

test('if trimming runs out of backups and the write still fails, the backups are put back', () => {
  const bk = backups(1_500_000);
  const d = device({ state: state(8000), preload: { mt1bk: bk }, storeFail: (k) => k === 'mt1undo' });
  const r = d.U.clearAll('DELETE');
  assert.equal(r.kind, 'undo');
  assert.equal(d.mem.get('mt1bk'), bk);
  assert.equal(d.S.tx.length, 8000);
});

test('plan: no trim warning when there is plenty of room', () => {
  assert.equal(device().U.plan(device().U.counts()).mayTrim, false);
});

// ---- the screen: run the real panel and the real typing handler from the page source ----
const part = (start: string, end: string) => {
  const a = HTML.indexOf(start);
  const b = HTML.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return HTML.slice(a, b);
};
const panel = (d: Dev, typed: string) => {
  const ctx = vm.createContext({
    UN: d.U,
    CLRT: typed,
    E: (x: unknown) => String(x),
    plu: (k: number, w: string) => k + ' ' + w + (k === 1 ? '' : 's'),
  });
  return vm.runInContext(`${part('function clrPanel()', '\nconst clrRes')};clrPanel()`, ctx) as string;
};

test('screen: a too-big copy shows the alert text and the button stays off even with DELETE typed', () => {
  const html = panel(device({ state: state(12_000) }), 'DELETE');
  assert.match(
    html,
    /role="alert"[^>]*>12,000 entries is more than this browser can keep an undo copy of\. Export a CSV first, delete some entries by hand, then try Clear everything again\./,
  );
  assert.match(html, /<button[^>]*id="clrc"[^>]*data-big="1"[^>]*disabled/);
});

test('screen: a normal copy shows no alert and the button turns on with DELETE', () => {
  const html = panel(device({ state: state(5) }), 'delete');
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, /data-big/);
  assert.doesNotMatch(html, /id="clrc"[^>]*disabled/);
  assert.doesNotMatch(html, /Older automatic backups may be removed/);
});

test('screen: the trim warning is on screen when backups may be trimmed', () => {
  assert.match(panel(full(8000, 1_500_000), ''), /Older automatic backups may be removed to make room for the undo copy\./);
});

test('typing handler: DELETE enables the button, anything else disables it, a too-big copy never re-enables it', () => {
  let handler: ((e: unknown) => void) | undefined;
  const btn = { disabled: true, dataset: {} as Record<string, string> };
  const ctx = vm.createContext({
    CLRT: '',
    IBOX: '',
    IRES: '',
    XF: '',
    XT: '',
    F: {},
    lst: () => {},
    $: (q: string) => (q === '#clrc' ? btn : { value: '', innerHTML: '' }),
    document: { addEventListener: (t: string, f: (e: unknown) => void) => void (t === 'input' && (handler = f)) },
  });
  vm.runInContext(part("document.addEventListener('input'", '\n'), ctx);
  assert.ok(handler, 'input listener found');
  const type = (v: string) => handler!({ target: { id: 'clrt', value: v, dataset: {} } });
  type('DELETE');
  assert.equal(btn.disabled, false);
  type('DELET');
  assert.equal(btn.disabled, true);
  btn.dataset.big = '1';
  type('DELETE');
  assert.equal(btn.disabled, true, 'too-big copy: typing DELETE must not turn the button on');
});

test('UNDOONE is pinned at 2,500,000: 8,000 entries pass, 12,000 are refused', () => {
  const head = part('const UNDOKEY=', 'function UNDOCORE');
  const k = vm.runInNewContext(`${head};({UNDOONE,UNDOTOTAL})`) as { UNDOONE: number; UNDOTOTAL: number };
  assert.equal(k.UNDOONE, 2_500_000);
  assert.equal(k.UNDOTOTAL, 2_500_000);
  assert.equal(device({ state: state(8000) }).U.clearAll('DELETE').ok, true);
  assert.equal(device({ state: state(12_000) }).U.clearAll('DELETE').kind, 'toobig');
});
