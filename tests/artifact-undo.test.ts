// "Clear everything" and its undo copy in artifact/pera-artifact.html (UNDOCORE block), run in a sandbox with a fake device.
// Also checks that the words on screen match what the code does (Ced: the copy must match the code).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, device, J, DAY, type St } from './artifact-undo-kit.ts';

test('counts: transactions (with the sample ones), budgets, rules and non-zero starting balances', () => {
  const { U } = device();
  assert.deepEqual(J(U.counts()), { tx: 3, sample: 1, bud: 2, rec: 1, open: 1 });
});

test('typed word: anything but DELETE changes nothing; delete in small letters with spaces is accepted', () => {
  const { U, S } = device();
  for (const t of ['', 'delet', 'DELETED', 'yes']) {
    const r = U.clearAll(t);
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'typed');
    assert.equal(r.message, 'Type DELETE to confirm.');
  }
  assert.equal(S.tx.length, 3);
  assert.equal(U.clearAll(' delete ').ok, true);
});

test('clear: removes transactions, budgets, rules and starting balances; keeps accounts, categories, aliases and Recently deleted; never the tour', () => {
  const { U, S } = device();
  S.fresh = 1;
  const r = U.clearAll('DELETE');
  assert.equal(r.ok, true);
  assert.deepEqual([S.tx.length, Object.keys(S.bud).length, S.rec.length, Object.keys(S.open).length], [0, 0, 0, 0]);
  assert.deepEqual(J(S.accts), ['Cash', 'GCash']);
  assert.deepEqual(J(S.cats), { inc: ['Salary'], exp: ['Food', 'Transportation'] });
  assert.deepEqual(J(S.alias), { GCash: ['gc'] });
  assert.equal(S.trash.length, 1);
  assert.equal(S.fresh, 0);
  assert.equal(
    r.message,
    'Cleared 3 transactions, 2 budgets, 1 recurring rule and 1 starting balance. Undo is kept for 30 days in Settings.',
  );
});

test('clear saves once and a second tap while busy or after it is empty does nothing', () => {
  const { U, saves } = device();
  assert.equal(U.clearAll('DELETE').ok, true);
  assert.equal(saves(), 1);
  const again = U.clearAll('DELETE');
  assert.equal(again.ok, false);
  assert.equal(again.kind, 'none');
  assert.equal(again.message, 'Nothing to clear. There are no transactions, budgets, recurring rules or starting balances.');
  assert.equal(saves(), 1);
  assert.equal(U.list().length, 1);
});

test('no recurring rule is left to run again after a clear (a rule run adds 0 entries)', () => {
  const { U, S } = device();
  U.clearAll('DELETE');
  assert.deepEqual(J(S.rec), []);
});

test('undo copy cannot be saved: nothing is deleted', () => {
  const { U, S } = device({ storeFail: (k) => k === 'mt1undo' });
  const r = U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'undo');
  assert.match(
    r.message,
    /^Nothing was deleted\. This browser has no room to keep an undo copy\. Export a CSV, delete some older entries by hand, then try again\.$/,
  );
  assert.equal(S.tx.length, 3);
  assert.equal(Object.keys(S.bud).length, 2);
  assert.equal(S.rec.length, 1);
});

test('undo copy that reads back different (silent storage fault): nothing is deleted', () => {
  const { U, S, mem } = device();
  const orig = mem.set.bind(mem);
  mem.set = (k: string, v: string) => orig(k, v.slice(0, -2));
  const r = U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'undo');
  assert.equal(S.tx.length, 3);
});

test('save fails after the copy was written: everything is put back and the copy is dropped', () => {
  const { U, S } = device({ saveOk: () => false });
  const r = U.clearAll('DELETE');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'save');
  assert.equal(r.message, 'Nothing was deleted. Your data could not be saved on this device. Try again.');
  assert.equal(S.tx.length, 3);
  assert.equal(Object.keys(S.bud).length, 2);
  assert.equal(S.rec.length, 1);
  assert.equal(S.open.Cash, 500);
  assert.equal(U.list().length, 0);
});

test('clear then restore gives back exactly the counts, sample records are not restored', () => {
  const { U, S } = device();
  const before = J({ tx: S.tx.filter((x: St) => !x.demo), bud: S.bud, rec: S.rec, open: { Cash: 500 } });
  const c = U.clearAll('DELETE');
  const r = U.restore(c.id as string);
  assert.equal(r.ok, true);
  assert.deepEqual(J(r.got), { tx: 2, bud: 2, rec: 1, open: 1 });
  assert.equal(r.skipped, 0);
  assert.deepEqual(J({ tx: S.tx, bud: S.bud, rec: S.rec, open: { Cash: S.open.Cash } }), before);
  assert.ok(!S.tx.some((x: St) => x.demo));
  assert.match(r.message, /^Restored 2 transactions, 2 budgets, 1 recurring rule and 1 starting balance\./);
  assert.match(r.message, /1 sample record was not restored\./);
  assert.match(r.message, /The copy was removed\.$/);
  assert.notEqual(r.kept, true);
  assert.equal(U.list().length, 0);
});

test('restore: what you have now wins (same id, existing budget, non-zero balance) and is counted as skipped', () => {
  const { U, S } = device();
  const c = U.clearAll('DELETE');
  S.tx.push({ id: 't1', n: 1, date: '2026-10-01', type: 'expense', amount: 999, cat: 'Food', acct: 'Cash' }); // same id, new value
  S.bud.Food = 7777;
  S.open.Cash = 42;
  const r = U.restore(c.id as string);
  assert.equal(r.ok, true);
  assert.equal(S.tx.find((x: St) => x.id === 't1').amount, 999);
  assert.equal(S.bud.Food, 7777);
  assert.equal(S.bud.Transportation, 1000);
  assert.equal(S.open.Cash, 42);
  assert.deepEqual(J(r.got), { tx: 1, bud: 1, rec: 1, open: 0 });
  assert.equal(r.skipped, 3);
  assert.match(r.message, /3 skipped because they already exist or no longer apply\./);
});

test('restore: a deleted account or category is skipped, not recreated', () => {
  const { U, S } = device();
  const c = U.clearAll('DELETE');
  S.accts = ['GCash'];
  S.cats.exp = ['Food'];
  const r = U.restore(c.id as string);
  assert.equal(r.ok, true);
  assert.equal(S.open.Cash, undefined);
  assert.equal(S.bud.Transportation, undefined);
  assert.equal(S.bud.Food, 3000);
});

test('restore: a transaction already in Recently deleted is not brought back twice', () => {
  const { U, S } = device();
  const c = U.clearAll('DELETE');
  S.trash.push({ id: 't2', date: '2026-10-02', type: 'income', amount: 20, cat: 'Salary', acct: 'Cash' });
  const r = U.restore(c.id as string);
  assert.equal(r.got?.tx, 1);
  assert.ok(!S.tx.some((x: St) => x.id === 't2'));
});

test('restore: save fails, state is put back and the copy is kept', () => {
  let ok = true;
  const { U, S } = device({ saveOk: () => ok });
  const c = U.clearAll('DELETE');
  ok = false;
  const r = U.restore(c.id as string);
  assert.equal(r.ok, false);
  assert.match(r.message, /^Nothing was restored\./);
  assert.equal(S.tx.length, 0);
  assert.equal(S.rec.length, 0);
  assert.equal(U.list().length, 1);
  ok = true;
  assert.equal(U.restore(c.id as string).ok, true);
});

test('restore twice: the second tap finds the copy gone and adds nothing', () => {
  const { U, S } = device();
  const c = U.clearAll('DELETE');
  U.restore(c.id as string);
  const n = S.tx.length;
  const r = U.restore(c.id as string);
  assert.equal(r.ok, false);
  assert.equal(r.message, 'That undo copy is gone or has expired.');
  assert.equal(S.tx.length, n);
});

test('expiry: a copy is gone after 30 days and not before', () => {
  const d = device();
  const c = d.U.clearAll('DELETE');
  d.tick(29 * DAY);
  assert.equal(d.U.list().length, 1);
  d.tick(2 * DAY);
  assert.equal(d.U.list().length, 0);
  assert.equal(d.U.restore(c.id as string).ok, false);
  assert.equal(d.U.DAYS, 30);
});

test('keeps the 3 newest copies; a 4th evicts the oldest', () => {
  const d = device();
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    d.S.tx.push({ id: 'n' + i, n: 10 + i, date: '2026-10-05', type: 'expense', amount: 1, cat: 'Food', acct: 'Cash' });
    ids.push(d.U.clearAll('DELETE').id as string);
    d.tick(1000);
  }
  const L = d.U.list().map((r) => r.id);
  assert.equal(L.length, 3);
  assert.deepEqual(J(L), [ids[3], ids[2], ids[1]]);
  assert.equal(d.U.MAX, 3);
});

test('copy is stored under its own key, which the rotating backups never touch', () => {
  const d = device();
  d.U.clearAll('DELETE');
  assert.ok(d.mem.has('mt1undo'));
  assert.equal(d.U.KEY, 'mt1undo');
  const bk = HTML.slice(HTML.indexOf('function bkAdd'), HTML.indexOf('function bkAdd') + 700);
  assert.doesNotMatch(bk, /mt1undo|UN\./);
  assert.doesNotMatch(HTML.replace(slice('UNDOCORE'), ''), /setItem\(['"`]mt1undo|\bDB\.set[^;]*undo/);
});

test('the undo copy is never sent to other devices', () => {
  const rest = HTML.replace(slice('UNDOCORE'), '');
  const sync = rest.slice(rest.indexOf('toRecs(){'), rest.indexOf('toRecs(){') + 900);
  assert.doesNotMatch(sync, /undo/i);
});

test('screen words match what the code does', () => {
  const rest = HTML.replace(slice('CSVCORE'), '').replace(slice('UNDOCORE'), '');
  assert.match(rest, /for \$\{UN\.DAYS\} days/); // 30 comes from the code, not from typed text
  assert.match(HTML, /UNDODAYS=30/);
  assert.match(HTML, /UNDOMAX=3/);
  assert.match(rest, /Stays: accounts, categories, renames, view settings and Recently deleted\./);
  assert.doesNotMatch(rest, /tour/i);
  assert.match(rest, /Sample records are not restored\./);
  assert.doesNotMatch(HTML, /Reset everything|Delete everything\?|>demo</);
  assert.match(HTML, /class="tag[^"]*">Sample</);
});

test('screen controls: DELETE gate, labels, and live-region roles', () => {
  assert.match(
    HTML,
    /id="clrc"[^>]*aria-label="Clear everything now"[^>]*\$\{CLRT\.trim\(\)\.toUpperCase\(\)=='DELETE'&&!pn\.tooBig\?'':'disabled'\}/,
  );
  assert.match(HTML, /id="clrt"[^>]*aria-label="Type DELETE to confirm clearing everything"/);
  assert.match(HTML, /aria-label="CSV text to import"/);
  assert.match(HTML, /role="\$\{r\.ok\?'status':'alert'\}"/);
  assert.match(HTML, /id="clrsync"/);
  assert.match(HTML, /<label class="lb">From<input id="xf"/);
  assert.match(HTML, /<label class="lb">To<input id="xt"/);
  // deleting sample records asks first
  assert.match(HTML, /data-a="sdc"/);
  assert.match(HTML, /Delete sample records\?/);
  // clear is blocked until the word is typed, also in the handler
  assert.match(HTML, /UN\.clearAll\(\$\('#clrt'\)\?\$\('#clrt'\)\.value:CLRT\)/);
});

test('sync line says what is true for each state', () => {
  const src = HTML.slice(HTML.indexOf('function clrSync'), HTML.indexOf('function clrPanel'));
  const f = vm.runInNewContext(`(DBS,SUB,ST,EN)=>{${src};return clrSync()}`) as (
    a: string,
    b: boolean,
    c: string,
    d: Map<string, { p?: boolean }>,
  ) => string;
  const none = f('none', false, 'ok', new Map());
  assert.equal(none, 'Cleared on this device only. Sync is unavailable here.');
  assert.match(f('db', false, 'ok', new Map()), /reconnects\.$/);
  assert.equal(f('db', true, 'error', new Map()), 'Sync paused, retrying.');
  assert.match(f('db', true, 'ok', new Map([['a', { p: true }]])), /^Cleared here\. Sending/);
  assert.match(f('db', true, 'ok', new Map()), /^Sent to your other devices\./);
});
