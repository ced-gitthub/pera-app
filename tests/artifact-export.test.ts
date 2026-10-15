// Export side of the artifact CSV core, compared with native buildExport / checkExportRange.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, checkExportRange, type ExportTx } from '../native/src/csvLogic.ts';
import { CSV, TODAY, ctx, snap } from './artifact-core.ts';

test('export: same bytes as native for the same entries, sample records left out', () => {
  const rows = [
    { d: '2026-10-02', t: 'expense', m: 15050, c: 'Food', de: 'Lunch, with team', no: 'said "hi"', a: 'GCash', to: '' },
    { d: '2026-10-01', t: 'income', m: 2500000, c: 'Salary', de: '=cmd', no: '', a: 'Cash', to: '' },
    { d: '2026-10-03', t: 'transfer', m: 100005, c: '', de: 'Top up', no: 'a\nb', a: 'Cash', to: 'GCash' },
    { d: '2026-10-04', t: 'expense', m: 1, c: 'Other', de: '', no: '', a: '', to: '' },
  ];
  const art = rows.map((r, i) => ({
    id: 'x' + i,
    n: i + 1,
    demo: false,
    date: r.d,
    type: r.t,
    amount: r.m / 100,
    cat: r.c,
    desc: r.de,
    notes: r.no,
    acct: r.a,
    to: r.to,
  }));
  const demo = {
    id: 'dm',
    n: 9,
    demo: true,
    date: '2026-10-05',
    type: 'expense',
    amount: 5,
    cat: 'Food',
    desc: 'sample',
    notes: '',
    acct: 'Cash',
    to: '',
  };
  const idOf = (n: string) => snap.accounts.find((a) => a.name === n)?.id ?? null;
  const catOf = (n: string) => snap.categories.find((c) => c.name === n)?.id ?? null;
  const nat: ExportTx[] = rows.map((r) => ({
    type: r.t as ExportTx['type'],
    amount_minor: r.m,
    transaction_date: r.d,
    description: r.de,
    notes: r.no,
    category_id: r.t === 'transfer' ? null : catOf(r.c),
    account_id: idOf(r.a),
    transfer_account_id: idOf(r.to),
  }));
  const a = CSV.exportRun([...art, demo], '', '', TODAY);
  const n = buildExport(
    [...nat].sort((x, y) => x.transaction_date.localeCompare(y.transaction_date)),
    snap,
  ); // native reads rows already ordered by date
  assert.ok(a.ok);
  assert.equal(a.count, 4);
  assert.equal(a.text, n.text);
  // ranges
  const a2 = CSV.exportRun(art, '2026-10-02', '2026-10-03', TODAY);
  const n2 = buildExport(
    [...nat].sort((x, y) => x.transaction_date.localeCompare(y.transaction_date)),
    snap,
    { from: '2026-10-02', to: '2026-10-03' },
  );
  assert.equal(a2.text, n2.text);
  assert.equal(a2.count, n2.count);
});

test('export: range checks and empty cases say what to fix, same words as native', () => {
  for (const [f, t] of [
    ['2026-13-01', ''],
    ['', 'nope'],
    ['2026-10-05', '2026-10-01'],
    ['1999-01-01', ''],
    ['', '2032-01-01'],
    ['2026-10-01', '2026-10-01'],
    ['', ''],
  ]) {
    const a = CSV.exportRange(f, t, TODAY);
    const n = checkExportRange(f, t, TODAY);
    assert.equal(a.ok, n.ok, `${f}|${t}`);
    if (!n.ok) assert.equal(a.message, n.message);
  }
  assert.equal(CSV.exportRun([], '', '', TODAY).message, 'Nothing to export yet. Add an entry first.');
  const one = [
    { id: 'q', n: 1, demo: false, date: '2026-10-01', type: 'expense', amount: 1, cat: 'Food', desc: '', notes: '', acct: 'Cash', to: '' },
  ];
  assert.equal(CSV.exportRun(one, '2026-11-01', '', TODAY).message, 'No entries in that date range. Change From or To.');
  assert.equal(CSV.exportRun([{ ...one[0], demo: true }], '', '', TODAY).message, 'Nothing to export yet. Add an entry first.');
});

test('export then import round trip adds the same entries, and importing twice adds 0', () => {
  const art = [
    {
      id: 'a',
      n: 1,
      demo: false,
      date: '2026-10-01',
      type: 'expense',
      amount: 150.5,
      cat: 'Food',
      desc: 'Lunch, "big"',
      notes: 'x\ny',
      acct: 'GCash',
      to: '',
    },
    {
      id: 'b',
      n: 2,
      demo: false,
      date: '2026-10-01',
      type: 'transfer',
      amount: 1000,
      cat: 'Transfer',
      desc: 'Top up',
      notes: '',
      acct: 'Cash',
      to: 'GCash',
    },
    {
      id: 'c',
      n: 3,
      demo: false,
      date: '2026-10-01',
      type: 'expense',
      amount: 150.5,
      cat: 'Food',
      desc: 'Lunch, "big"',
      notes: 'x\ny',
      acct: 'GCash',
      to: '',
    },
  ];
  const out = CSV.exportRun(art, '', '', TODAY);
  const p1 = CSV.plan(out.text!, ctx, new Set(), TODAY);
  assert.equal(p1.rows.length, 3);
  assert.equal(p1.problems.length, 0);
  assert.deepEqual(
    p1.rows.map((r) => r.amount_minor),
    [15050, 100000, 15050],
  );
  const stored = new Set(p1.rows.map((r) => r.ih));
  const p2 = CSV.plan(out.text!, ctx, new Set([...stored].map(CSV.ihNorm)), TODAY);
  assert.equal(p2.rows.length, 0);
  assert.equal(p2.dup, 3);
});
