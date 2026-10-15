import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HTML, slice, device, J, type St, type Res } from './artifact-undo-kit.ts';

// ---- QA defects after a55d454: sizes are measured on realistic entries (what add() really stores) ----
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
const bigState = (n: number): St => ({
  tx: Array.from({ length: n }, (_, i) => entry(i)),
  trash: [],
  bud: { Food: 3000 },
  rec: [],
  open: { GCash: 100 },
  accts: ['GCash'],
  cats: { inc: [], exp: ['Food'] },
  fresh: 0,
});
const SIZE = (n: number) => JSON.stringify(bigState(n).tx).length;

test('measured size: a realistic entry is under 300 chars, so 8,000 fit the 2,500,000 limit', () => {
  const per = SIZE(1000) / 1000;
  assert.ok(per > 150 && per < 300, `per entry ${per}`);
  assert.ok(SIZE(8000) < 2_500_000, `8,000 entries = ${SIZE(8000)}`);
});

test('clear 8,000 entries succeeds and restores the exact counts', () => {
  const { U, S } = device({ state: bigState(8000) });
  const r = U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  assert.equal(S.tx.length, 0);
  const back = U.restore(r.id as string);
  assert.equal(back.ok, true);
  assert.equal(back.got?.tx, 8000);
  assert.equal(S.tx.length, 8000);
  assert.equal(back.skipped, 0);
});

test('with three small copies already kept, a 4th clear succeeds: oldest is evicted, newest kept', () => {
  const d = device();
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    d.S.tx.push(entry(100 + i));
    ids.push(d.U.clearAll('DELETE').id as string);
    d.tick(1000);
  }
  d.S.tx.push(entry(200));
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(J(d.U.list().map((x) => x.id)), [r.id, ids[2], ids[1]]);
});

test('with a big copy kept, a new big clear evicts the older one to stay inside the total', () => {
  const d = device({ state: bigState(8000) });
  const first = d.U.clearAll('DELETE');
  assert.equal(first.ok, true);
  d.S.tx.push(...bigState(8000).tx);
  d.tick(1000);
  const second = d.U.clearAll('DELETE');
  assert.equal(second.ok, true, second.message);
  assert.deepEqual(J(d.U.list().map((x) => x.id)), [second.id]);
});

test('a copy over the one-copy limit is refused with the too-many-entries text; nothing is deleted or evicted', () => {
  const d = device();
  const small = d.U.clearAll('DELETE');
  d.S.tx.push(...bigState(12000).tx);
  const before = d.mem.get('mt1undo');
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'toobig');
  assert.equal(
    r.message,
    'Nothing was deleted. 12,000 entries is more than this browser can keep an undo copy of. Export a CSV first, delete some entries by hand, then try Clear everything again.',
  );
  assert.doesNotMatch(r.message, /storage/);
  assert.equal(d.S.tx.length, 12000);
  assert.equal(d.mem.get('mt1undo'), before);
  assert.equal(d.U.list()[0].id, small.id);
});

test('storage full: older copies are evicted one at a time (oldest first) and the write is retried', () => {
  const d0 = device();
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    d0.S.tx.push(entry(300 + i));
    ids.push(d0.U.clearAll('DELETE').id as string);
    d0.tick(1000);
  }
  const seeded = d0.mem.get('mt1undo') as string;
  const sets: number[] = [];
  const d = device({
    uidp: 'z',
    storeFail: (k, v) => (k === 'mt1undo' ? (sets.push(v.length), (JSON.parse(v) as unknown[]).length > 2) : false),
  });
  d.mem.set('mt1undo', seeded);
  d.tick(1000);
  d.S.tx.push(entry(400));
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true, r.message);
  const L = d.U.list().map((x) => x.id);
  assert.equal(L[0], r.id);
  assert.deepEqual(J(L), [r.id, ids[2]]);
  assert.ok(!L.includes(ids[0]), 'oldest went first');
  assert.ok(sets.length >= 2, 'the write was retried');
});

test('storage full for good: the clear stops with the storage text, nothing deleted, older copies still there', () => {
  const d0 = device();
  d0.S.tx.push(entry(500));
  const old = d0.U.clearAll('DELETE');
  const seeded = d0.mem.get('mt1undo') as string;
  const d = device({ storeFail: (k, v) => k === 'mt1undo' && v !== seeded });
  d.mem.set('mt1undo', seeded);
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'undo');
  assert.equal(
    r.message,
    'Nothing was deleted. This browser has no room to keep an undo copy. Export a CSV, delete some older entries by hand, then try again.',
  );
  assert.equal(d.S.tx.length, 3);
  assert.equal(d.mem.get('mt1undo'), seeded);
  assert.equal(d.U.list()[0].id, old.id);
});

test('plan: says which copies a new clear would replace, and when it is too big', () => {
  const d = device();
  assert.deepEqual(J(d.U.plan(d.U.counts())), { tooBig: false, mayTrim: false, refuse: false, n: 3, replaced: [] });
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    d.S.tx.push(entry(600 + i));
    ids.push(d.U.clearAll('DELETE').id as string);
    d.tick(1000);
  }
  d.S.tx.push(entry(700));
  const p = d.U.plan(d.U.counts());
  assert.equal(p.tooBig, false);
  assert.deepEqual(J(p.replaced.map((x) => x.id)), [ids[0]]);
  assert.ok(p.replaced[0].at > 0 && p.replaced[0].counts.tx >= 1);
  d.S.tx.push(...bigState(12000).tx);
  const big = d.U.plan(d.U.counts());
  assert.equal(big.tooBig, true);
  assert.deepEqual(J(big.replaced), []);
  assert.equal(big.n, d.S.tx.length);
});

test('restore: the copy cannot be removed afterwards: the message says so, it stays listed, kept is true', () => {
  let failDrop = false;
  const d = device({ storeFail: (k) => failDrop && k === 'mt1undo' });
  const c = d.U.clearAll('DELETE');
  failDrop = true;
  const r = d.U.restore(c.id as string);
  assert.equal(r.ok, true);
  assert.equal(r.kept, true);
  assert.match(r.message, /The undo copy could not be removed and stays in the list\. Do not restore it twice\.$/);
  assert.doesNotMatch(r.message, /The copy was removed/);
  assert.equal(d.U.list().length, 1);
  const n = d.S.tx.length;
  const again = d.U.restore(c.id as string);
  assert.equal(again.got?.tx, 0);
  assert.equal(d.S.tx.length, n);
});

test('clearAll re-reads storage first (env.sync) and counts what it finds', () => {
  let syncs = 0;
  const d = device({
    sync: () => {
      syncs++;
      d.S.tx.push(entry(800), entry(801));
    },
  });
  const r = d.U.clearAll('DELETE');
  assert.equal(syncs, 1);
  assert.equal(r.ok, true);
  assert.equal(r.counts?.tx, 5);
  assert.equal(d.S.tx.length, 0);
  assert.equal(d.U.list()[0].counts.tx, 5);
});

test('a second clearAll while the first is still running is refused as busy', () => {
  let inner: Res | null = null;
  const d = device({
    saveOk: () => {
      inner = d.U.clearAll('DELETE');
      return true;
    },
  });
  const r = d.U.clearAll('DELETE');
  assert.equal(r.ok, true);
  assert.equal((inner as Res | null)?.ok, false);
  assert.equal((inner as Res | null)?.kind, 'busy');
  assert.equal(d.U.list().length, 1);
});

test('panel: the plan text and the too-big text are on screen and the button honours them', () => {
  const rest = HTML.replace(slice('CSVCORE'), '').replace(slice('UNDOCORE'), '');
  assert.match(rest, /This will replace your undo copy from/);
  assert.match(rest, /is more than this browser can keep an undo copy of/);
  assert.match(rest, /UN\.plan\(/);
  assert.match(rest, /data-big/);
});
