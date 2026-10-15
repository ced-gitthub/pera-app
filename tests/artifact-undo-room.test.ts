import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, device, J, type St } from './artifact-undo-kit.ts';

// Real browser limit: 5,242,880 chars, key + value of every key. The undo copy is planned against it, not only against the 2.5M total.
const QUOTA = 5_242_880;
const entry = (i: number, p = 'q') => ({
  id: 'tm' + p + '1ab' + String(i).padStart(7, '0'),
  n: i,
  notes: 'paid in cash at the corner store',
  desc: 'Jollibee lunch ' + i,
  acct: 'GCash',
  created: '2026-10-01',
  updated: '2026-10-01',
  date: '2026-10-01',
  type: 'expense',
  amount: 18550,
  cat: 'Food',
});
const state = (n: number, p = 'q'): St => ({
  tx: Array.from({ length: n }, (_, i) => entry(i, p)),
  trash: [],
  bud: {},
  rec: [],
  open: {},
  accts: ['GCash'],
  cats: { inc: [], exp: ['Food'] },
  fresh: 0,
});
const backups = (chars: number) => {
  const per = Math.floor(chars / 6 / 265);
  return JSON.stringify(
    Array.from({ length: 6 }, (_, k) => ({
      at: 1_700_000_000_000 - k * 1000,
      why: 'daily',
      n: per,
      d: { tx: state(per, 'b' + k).tx, bud: {}, rec: [] },
    })),
  );
};
type Dev = ReturnType<typeof device>;
// Chars one undo copy of this state takes (measured on a roomy device).
const copySize = (n: number) => {
  const d = device({ state: state(n) });
  assert.equal(d.U.clearAll('DELETE').ok, true);
  return (d.mem.get('mt1undo') as string).length - 2;
};
// A device with one undo copy already kept, then n live entries, with `others` chars of other data (value length) on top.
const pressed = (prevN: number, n: number, others: number, bk = '[]') => {
  const d = device({ state: state(prevN, 'p'), limit: QUOTA });
  const prev = d.U.clearAll('DELETE');
  assert.equal(prev.ok, true);
  d.tick(1000);
  d.S.tx = state(n).tx;
  d.mem.set('mt1x', 'z'.repeat(others));
  d.mem.set('mt1bk', bk);
  return { d, prevId: prev.id as string };
};
const part = (start: string, end: string) => {
  const a = HTML.indexOf(start);
  const b = HTML.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return HTML.slice(a, b);
};
const panel = (d: Dev, typed: string) =>
  vm.runInContext(
    `${part('function clrPanel()', '\nconst clrRes')};clrPanel()`,
    vm.createContext({
      UN: d.U,
      CLRT: typed,
      E: (x: unknown) => String(x),
      plu: (k: number, w: string) => k + ' ' + w + (k === 1 ? '' : 's'),
    }),
  ) as string;

// others = value chars of mt1x so that the store has exactly `free` chars left for the undo key (mt1bk is "[]").
const freeFor = (free: number) => QUOTA - 'mt1x'.length - 'mt1bk'.length - 2 - 'mt1undo'.length - free;
const refusing = () => {
  const s = state(8000);
  return device({
    state: s,
    limit: QUOTA,
    preload: { mt1: JSON.stringify(s), mt1sy: 'y'.repeat(400_000), mt1bk: backups(1_500_000), mt1x: 'z'.repeat(1_400_000) },
  });
};
// 1,000-entry copy kept, clear 8,000 entries, ~1.4M of backups: only a free-space check sees that the older copy has to go.
const squeezed = () => {
  const sz = copySize(8000);
  // free space = sz + 1000: the new copy fits, new + old does not (the old copy is replaced, so it is not counted as used)
  return pressed(1000, 8000, freeFor(sz + 1000));
};

test('plan: the older copy that the real free space cannot keep is listed as replaced, nothing is trimmed', () => {
  const { d, prevId } = squeezed();
  const p = d.U.plan(d.U.counts());
  assert.deepEqual(J(p.replaced.map((x) => x.id)), [prevId]);
  assert.equal(p.mayTrim, false);
  assert.equal(p.refuse, false);
});

test('clear: the older copy was replaced and the success message says so', () => {
  const { d, prevId } = squeezed();
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  assert.equal(
    d.U.list().some((x) => x.id === prevId),
    false,
  );
  assert.match(r.message, /1 older undo copy was replaced to make room\./);
  assert.doesNotMatch(r.message, /backups were removed/);
});

test('screen: the panel names the replaced copy and shows no backup-trim note', () => {
  const html = panel(squeezed().d, '');
  assert.match(html, /This will replace your undo copy from/);
  assert.doesNotMatch(html, /Older automatic backups may be removed/);
});

test('plan: mayTrim ignores a copy that would fit anyway even with backups kept (kills: mayTrim without the size check)', () => {
  const d = device({ preload: { mt1bk: backups(600_000) } });
  const p = d.U.plan(d.U.counts());
  assert.equal(p.mayTrim, false);
  assert.equal(p.refuse, false);
});

test('plan: mayTrim is judged on the new copy alone, not on new + older (kills: mayTrim using the kept list)', () => {
  const { d } = squeezed();
  assert.equal(d.U.plan(d.U.counts()).mayTrim, false);
});

test('plan: trimming only counts when there are backups to trim (kills: mayTrim without the backups check)', () => {
  // Free space is 1 char short of the copy. An empty backup list ("[]" + its key = 7 chars) is not something to trim.
  const sz = copySize(2000);
  const others = freeFor(sz - 1);
  const d = device({ state: state(2000), limit: QUOTA, preload: { mt1x: 'z'.repeat(others), mt1bk: '[]' } });
  const p = d.U.plan(d.U.counts());
  assert.equal(p.mayTrim, false);
  assert.equal(p.refuse, true);
  assert.equal(d.U.clearAll('DELETE').kind, 'undo');
});

test('plan: the existing undo copy does not count as used space (kills: room() counting it)', () => {
  const sz = copySize(3000);
  const prev = copySize(1000);
  const { d, prevId } = pressed(1000, 3000, freeFor(sz + 20));
  assert.ok(prev > 0 && d.U.list().length === 1);
  const p = d.U.plan(d.U.counts());
  assert.equal(p.refuse, false, 'the new copy fits once the old one is swapped out');
  assert.equal(p.mayTrim, false);
  assert.deepEqual(J(p.replaced.map((x) => x.id)), [prevId]);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
});

test('plan: a clear that will be refused is known up front, with the copy kept and nothing listed as replaced', () => {
  const d = refusing();
  const p = d.U.plan(d.U.counts());
  assert.equal(p.refuse, true);
  assert.equal(p.mayTrim, false);
  assert.deepEqual(J(p.replaced), []);
  assert.equal(d.U.clearAll('DELETE').kind, 'undo');
});

test('screen: a clear that will be refused shows the reason and the button stays off even with DELETE typed', () => {
  const d = refusing();
  const html = panel(d, 'DELETE');
  assert.match(
    html,
    /role="alert"[^>]*>Nothing can be deleted yet\. This browser has no room to keep an undo copy\. Export a CSV, delete some older entries by hand, then try again\./,
  );
  assert.match(html, /<button[^>]*id="clrc"[^>]*data-big="1"[^>]*disabled/);
  assert.doesNotMatch(html, /Older automatic backups may be removed/);
});
