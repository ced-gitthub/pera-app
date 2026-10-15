// Import side of the artifact CSV core, compared with native planImport on real fixture files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkSummary, importMessage, planImport, problemLines } from '../native/src/csvLogic.ts';
import { CSV, TODAY, ctx, snap, artView, nativeView, noHash, HTML, block } from './artifact-core.ts';

const FIX = 'tests/fixtures/csv';
const files = fs
  .readdirSync(FIX)
  .filter((f) => f.endsWith('.csv'))
  .sort();

test('fixtures: there are at least 12 CSV files', () => {
  assert.ok(files.length >= 12, `found ${files.length}`);
});

for (const f of files) {
  const text = fs.readFileSync(path.join(FIX, f), 'utf8');
  test(`same as native: ${f}`, () => {
    const a = artView(text);
    const n = nativeView(text);
    assert.deepEqual(noHash(a), noHash(n as unknown as ReturnType<typeof artView>));
    assert.equal(a.hashes.length, n.hashes.length);
    // Two rows share a key exactly when they share one natively: compare the equality pattern.
    const pat = (h: string[]) => h.map((x) => h.indexOf(x));
    assert.deepEqual(pat(a.hashes), pat(n.hashes));
  });
}

test('amounts: "1,250.50" is 125050 centavos, and 1250.5 the same; no float involved', () => {
  const p = CSV.plan(fs.readFileSync(`${FIX}/05-quoted-amounts.csv`, 'utf8'), ctx, new Set(), TODAY);
  assert.deepEqual(
    p.rows.map((r) => r.amount_minor),
    [125050, 125050, 99999999999], // '.50' (no leading digit) is refused, as native refuses it
  );
  for (const r of p.rows) assert.ok(Number.isInteger(r.amount_minor));
});

test('amounts: bad amounts get the plain message and are never imported', () => {
  const p = CSV.plan(fs.readFileSync(`${FIX}/06-bad-amounts.csv`, 'utf8'), ctx, new Set(), TODAY);
  const bad = p.problems.filter((x) => /Amount must be/.test(x.message));
  assert.ok(bad.length >= 7, `bad rows: ${bad.length}`);
  assert.deepEqual(
    p.rows.map((r) => r.desc),
    ['max ok', 'leading space', 'min ok'].filter((d) => p.rows.some((r) => r.desc === d)),
  );
  assert.equal(CSV.amtMinor('0'), null);
  assert.equal(CSV.amtMinor('0.001'), null);
  assert.equal(CSV.amtMinor('1000000000'), null);
  assert.equal(CSV.amtMinor('0.01'), 1);
  assert.equal(CSV.amtMinor('999999999.99'), 99999999999);
});

test('formula guards: the leading quote is stripped on import and added back on export', () => {
  const p = CSV.plan(fs.readFileSync(`${FIX}/03-formula-guards.csv`, 'utf8'), ctx, new Set(), TODAY);
  assert.equal(p.rows[0].desc, '=SUM(A1)');
  assert.equal(p.rows[0].notes, '+1 note');
  assert.equal(p.rows[1].desc, '-2 off');
  assert.equal(p.rows[3].desc, "It's fine");
  assert.equal(p.rows[3].notes, "'normal quote");
  const tx = p.rows.map((r, i) => ({
    id: 't' + i,
    n: i,
    demo: false,
    amount: r.amount_minor / 100,
    cat: r.cat,
    desc: r.desc,
    notes: r.notes,
    acct: r.acct,
    to: r.to,
    date: r.date,
    type: r.type,
  }));
  const out = CSV.exportRun(tx, '', '', TODAY);
  assert.ok(out.ok && out.text);
  assert.match(out.text!, /"'=SUM\(A1\)"/);
  assert.match(out.text!, /"'\+1 note"/);
});

test('double tap: a second import of the same text with the first rows stored adds 0', () => {
  const text = fs.readFileSync(`${FIX}/01-native-export.csv`, 'utf8');
  const first = CSV.plan(text, ctx, new Set(), TODAY);
  assert.equal(first.rows.length, 5);
  const second = CSV.plan(text, ctx, new Set(first.rows.map((r) => r.ih)), TODAY);
  assert.equal(second.rows.length, 0);
  assert.equal(second.dup, 5);
});

test('old stored keys (pesos, 1-based) still match, so re-importing an old file adds 0', () => {
  const text = fs.readFileSync(`${FIX}/11-duplicates.csv`, 'utf8');
  const fresh = CSV.plan(text, ctx, new Set(), TODAY).rows;
  const oldStyle = fresh.map((r) => {
    const m = /^(.*)\|(\d+)\|([^|]*\|[^|]*\|[^|]*)#(\d+)$/.exec(r.ih)!;
    const pesos = `${Math.trunc(Number(m[2]) / 100)}.${String(Number(m[2]) % 100).padStart(2, '0')}`;
    return `${m[1]}|${pesos}|${m[3]}#${Number(m[4]) + 1}`;
  });
  assert.notDeepEqual(
    oldStyle,
    fresh.map((r) => r.ih),
  );
  const again = CSV.plan(text, ctx, new Set(oldStyle.map(CSV.ihNorm)), TODAY);
  assert.equal(again.rows.length, 0);
  assert.equal(again.dup, fresh.length);
  assert.equal(CSV.ihNorm('2026-10-01|expense|120.00|Cash||lunch#1'), '2026-10-01|expense|12000|Cash||lunch#0');
  assert.equal(CSV.ihNorm('2026-10-01|expense|12000|Cash||lunch#0'), '2026-10-01|expense|12000|Cash||lunch#0');
});

test('limits: 5,000 rows pass, 5,001 and over 900,000 characters are blocked, same as native', () => {
  const head = 'date,type,amount,category,description,notes,account,to_account\n';
  const mk = (n: number) => head + Array.from({ length: n }, (_, i) => `2026-10-01,expense,1.00,Food,r${i},,Cash,`).join('\n');
  for (const n of [5000, 5001]) {
    const t = mk(n);
    const a = artView(t);
    const nv = nativeView(t);
    assert.equal(a.blocked, nv.blocked);
    assert.equal(a.rows.length, nv.rows.length);
    assert.equal(a.total, nv.total);
  }
  assert.equal(CSV.plan(mk(5000), ctx, new Set(), TODAY).rows.length, 5000);
  assert.match(CSV.plan(mk(5001), ctx, new Set(), TODAY).blocked!, /Too many rows \(5,001\)/);
  const big = head + 'x'.repeat(900_001);
  assert.equal(artView(big).blocked, nativeView(big).blocked);
  assert.match(artView(big).blocked!, /too large/);
  assert.equal(artView('').blocked, nativeView('').blocked);
  assert.equal(artView(head).blocked, nativeView(head).blocked);
});

test('entry limit: 50,000 entries, same words as native', () => {
  assert.equal(CSV.roomMsg(49999, 1), null);
  assert.equal(
    CSV.roomMsg(49999, 2),
    'You have reached the limit of 50,000 entries, so no more can be added. Delete old entries to make room.',
  );
  assert.equal(CSV.MAXX, 50000);
});

test('messages: summary and result lines are word for word the native ones', () => {
  const text = fs.readFileSync(`${FIX}/06-bad-amounts.csv`, 'utf8');
  const a = CSV.plan(text, ctx, new Set(), TODAY);
  const n = planImport(text, snap, new Set(), TODAY);
  assert.equal(CSV.checkSummary(a), checkSummary(n));
  assert.deepEqual(CSV.problemLines(a.problems), problemLines(n.problems));
  for (const r of [
    { added: 1, dup: 1, problems: 1 },
    { added: 12345, dup: 0, problems: 2 },
  ])
    assert.equal(CSV.importMessage(r), importMessage({ ...r, error: null }));
});

test('no parseFloat on file text anywhere in the new code, and money is integer centavos', () => {
  const core = block('CSVCORE') + block('UNDOCORE');
  assert.doesNotMatch(core, /parseFloat|Number\.parseFloat|\bparseInt\(/);
  const ui = HTML.slice(HTML.indexOf('function commitImport'), HTML.indexOf('function commitImport') + 1200);
  assert.doesNotMatch(ui, /parseFloat/);
  assert.match(ui, /amount_minor\/100/);
});
