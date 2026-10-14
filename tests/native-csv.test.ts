import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMPORT_ROWS,
  MAX_CSV_CHARS,
  MAX_SHARE_CHARS,
  buildExport,
  checkShareSize,
  checkExportRange,
  exportDoneMessage,
  rangeLabel,
  planImport,
  importMessage,
  importError,
  problemLines,
  type ExportTx,
} from '../native/src/csvLogic.ts';
import type { Snapshot } from '../native/src/logic.ts';

const acct = (id: string, name: string, short: string | null = null) => ({
  id,
  name,
  short_name: short,
  counts_as_savings: false,
  opening_balance_minor: 0,
  show_on_home: true,
});
const snap: Snapshot = {
  accounts: [acct('a', 'Cash'), acct('b', 'GCash', 'gc'), acct('c', 'BDO Savings')],
  categories: [
    { id: 'f', name: 'Food', type: 'expense' },
    { id: 'o', name: 'Other', type: 'expense' },
    { id: 'x', name: 'Pets', type: 'expense' },
    { id: 's', name: 'Salary', type: 'income' },
    { id: 'oi', name: 'Other Income', type: 'income' },
  ],
  balances: {},
  recent: [],
  dates: [],
  totalEntries: 0,
  noAccount: 0,
};
const TODAY = '2026-10-14';
const HEAD = 'date,type,amount,category,description,notes,account,to_account';
const tx = (o: Partial<ExportTx>): ExportTx => ({
  type: 'expense',
  amount_minor: 15000,
  transaction_date: '2026-10-10',
  description: 'Lunch',
  notes: '',
  category_id: 'f',
  account_id: 'a',
  transfer_account_id: null,
  ...o,
});

test('export: header plus one line per entry, names instead of ids, money as pesos.centavos', () => {
  const out = buildExport(
    [tx({}), tx({ type: 'transfer', category_id: null, account_id: 'a', transfer_account_id: 'b', amount_minor: 100005 })],
    snap,
  );
  assert.equal(out.count, 2);
  const lines = out.text.split('\n');
  assert.equal(lines[0], HEAD);
  assert.equal(lines[1], '"2026-10-10","expense","150.00","Food","Lunch","","Cash",""');
  assert.equal(lines[2], '"2026-10-10","transfer","1000.05","Transfer","Lunch","","Cash","GCash"');
});

test('export: unknown category and missing account never crash', () => {
  const out = buildExport([tx({ category_id: 'gone', account_id: null })], snap);
  assert.match(out.text, /"Other"/);
  assert.equal(out.count, 1);
});

test('round trip: export then import gives back the same entries, in integer centavos', () => {
  const src = [
    tx({ amount_minor: 125050, description: 'Groceries, "big" shop', notes: 'line1, still line1', category_id: 'f' }),
    tx({ type: 'income', category_id: 's', account_id: 'b', amount_minor: 5000000, description: 'Pay', transaction_date: '2026-10-01' }),
    tx({ type: 'transfer', category_id: null, account_id: 'a', transfer_account_id: 'c', amount_minor: 99, description: 'Save' }),
  ];
  const plan = planImport(buildExport(src, snap).text, snap, new Set(), TODAY);
  assert.equal(plan.blocked, null);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.rows.length, 3);
  assert.deepEqual(
    plan.rows.map((r) => [r.type, r.amount_minor, r.account_id, r.transfer_account_id, r.category_id, r.description, r.transaction_date]),
    [
      ['expense', 125050, 'a', null, 'f', 'Groceries, "big" shop', '2026-10-10'],
      ['income', 5000000, 'b', null, 's', 'Pay', '2026-10-01'],
      ['transfer', 99, 'a', 'c', null, 'Save', '2026-10-10'],
    ],
  );
  assert.equal(plan.rows[0].notes, 'line1, still line1');
  for (const r of plan.rows) assert.ok(Number.isInteger(r.amount_minor));
});

test('amounts: "1,250.50" is 125050 centavos, no float rounding', () => {
  const csv = `${HEAD}\n2026-10-10,expense,"1,250.50",Food,Rice,,Cash,\n2026-10-10,expense,0.29,Food,Candy,,Cash,\n2026-10-10,expense,19.99,Food,Fries,,Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.deepEqual(
    plan.rows.map((r) => r.amount_minor),
    [125050, 29, 1999],
  );
});

test('quotes, commas and line breaks inside a description survive', () => {
  const csv = `${HEAD}\n2026-10-10,expense,10,Food,"He said ""hi"", then left","a\nb",Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].description, 'He said "hi", then left');
  assert.equal(plan.rows[0].notes, 'a\nb');
});

test('formula guard from the website export is removed again on import', () => {
  const out = buildExport([tx({ description: '=SUM(A1)' })], snap).text;
  assert.match(out, /"'=SUM\(A1\)"/);
  assert.equal(planImport(out, snap, new Set(), TODAY).rows[0].description, '=SUM(A1)');
});

test('a file without a header row works', () => {
  const plan = planImport('2026-10-10,expense,45,Food,Coffee,,Cash,', snap, new Set(), TODAY);
  assert.equal(plan.total, 1);
  assert.equal(plan.rows.length, 1);
});

test('unknown account: listed per row, other rows still ready', () => {
  const csv = `${HEAD}\n2026-10-10,expense,10,Food,A,,Cash,\n2026-10-10,expense,20,Food,B,,Maya,\n2026-10-11,transfer,30,,C,,Cash,Paluwagan`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.problems.length, 2);
  assert.deepEqual(
    plan.problems.map((p) => p.row),
    [2, 3],
  );
  assert.match(plan.problems[0].message, /Maya/);
  assert.match(plan.problems[0].message, /account/i);
  assert.match(plan.problems[1].message, /Paluwagan/);
});

test('account names match without caring about case, and by short name', () => {
  const csv = `${HEAD}\n2026-10-10,expense,10,Food,A,,gcash,\n2026-10-10,expense,10,Food,B,,gc,\n2026-10-10,expense,10,Food,C,,,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.deepEqual(
    plan.rows.map((r) => r.account_id),
    ['b', 'b', 'a'], // empty account = Cash, like the website
  );
});

test('transfer needs two different accounts', () => {
  const csv = `${HEAD}\n2026-10-10,transfer,10,,Same,,Cash,Cash\n2026-10-10,transfer,10,,Missing,,Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.problems.length, 2);
  assert.match(plan.problems[0].message, /different/i);
  assert.match(plan.problems[1].message, /to_account|goes to/i);
});

test('unknown category falls back to Other / Other Income; custom categories match', () => {
  const csv = `${HEAD}\n2026-10-10,expense,10,Mystery,A,,Cash,\n2026-10-10,income,10,Mystery,B,,Cash,\n2026-10-10,expense,10,Pets,C,,Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.deepEqual(
    plan.rows.map((r) => r.category_id),
    ['o', 'oi', 'x'],
  );
});

test('bad rows say what to fix and keep their row number', () => {
  const csv = `${HEAD}\n2026-13-45,expense,10,Food,A,,Cash,\n2026-10-10,spend,10,Food,B,,Cash,\n2026-10-10,expense,abc,Food,C,,Cash,\n2026-10-10,expense,5,Food,OK,,Cash,\n1999-01-01,expense,5,Food,Old,,Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.equal(plan.total, 5);
  assert.equal(plan.rows.length, 1);
  assert.deepEqual(
    plan.problems.map((p) => p.row),
    [1, 2, 3, 5],
  );
  assert.match(plan.problems[0].message, /date/i);
  assert.match(plan.problems[1].message, /type/i);
  assert.match(plan.problems[2].message, /amount/i);
  assert.match(plan.problems[3].message, /date/i);
});

test('cap: more than 5000 rows is refused with a clear message and nothing is mapped', () => {
  const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `2026-10-10,expense,${i + 1},Food,r${i},,Cash,`);
  const plan = planImport([HEAD, ...lines].join('\n'), snap, new Set(), TODAY);
  assert.equal(MAX_IMPORT_ROWS, 5000);
  assert.equal(plan.rows.length, 0);
  assert.match(plan.blocked ?? '', /5,000/);
  assert.match(plan.blocked ?? '', /5,001/);
  assert.match(plan.blocked ?? '', /split/i);
});

test('cap: exactly 5000 rows is accepted', () => {
  const lines = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => `2026-10-10,expense,${i + 1},Food,r${i},,Cash,`);
  const plan = planImport([HEAD, ...lines].join('\n'), snap, new Set(), TODAY);
  assert.equal(plan.blocked, null);
  assert.equal(plan.rows.length, 5000);
});

test('cap: text longer than the size limit is refused before parsing', () => {
  const plan = planImport('x'.repeat(MAX_CSV_CHARS + 1), snap, new Set(), TODAY);
  assert.match(plan.blocked ?? '', /too large/i);
});

test('empty or whitespace text asks for pasted rows', () => {
  assert.match(planImport('   \n ', snap, new Set(), TODAY).blocked ?? '', /paste/i);
  assert.match(planImport(HEAD, snap, new Set(), TODAY).blocked ?? '', /no rows/i);
});

test('no accounts at all: every row is a clear problem, not a crash', () => {
  const plan = planImport(`${HEAD}\n2026-10-10,expense,10,Food,A,,,`, { ...snap, accounts: [] }, new Set(), TODAY);
  assert.equal(plan.rows.length, 0);
  assert.match(plan.problems[0].message, /account/i);
});

test('duplicates: rows already imported are counted and left out; identical rows in one file stay separate', () => {
  const csv = `${HEAD}\n2026-10-10,expense,120,Food,Lunch,,Cash,\n2026-10-10,expense,120,Food,Lunch,,Cash,\n2026-10-11,expense,50,Food,Snack,,Cash,`;
  const first = planImport(csv, snap, new Set(), TODAY);
  assert.equal(first.rows.length, 3);
  assert.equal(new Set(first.hashes).size, 3); // the two lunches have different occurrence indexes
  const again = planImport(csv, snap, new Set(first.hashes), TODAY);
  assert.equal(again.rows.length, 0);
  assert.equal(again.dup, 3);
  const partly = planImport(csv, snap, new Set([first.hashes[0]]), TODAY);
  assert.equal(partly.rows.length, 2);
  assert.equal(partly.dup, 1);
  assert.deepEqual(
    partly.rows.map((r) => r.import_hash),
    [first.hashes[1], first.hashes[2]],
  );
});

test('date range of the file is reported for the duplicate lookup', () => {
  const csv = `${HEAD}\n2026-10-12,expense,1,Food,A,,Cash,\n2026-09-30,expense,1,Food,B,,Cash,`;
  const plan = planImport(csv, snap, new Set(), TODAY);
  assert.deepEqual(plan.range, { from: '2026-09-30', to: '2026-10-12' });
  assert.equal(planImport(`${HEAD}\n2026-10-12,expense,1,Food,A,,Zzz,`, snap, new Set(), TODAY).range, null);
});

test('result message: N added, M skipped as duplicates, K rows with problems', () => {
  assert.equal(importMessage({ added: 7, dup: 2, problems: 3, error: null }), '7 added, 2 skipped as duplicates, 3 rows with problems.');
  assert.equal(importMessage({ added: 1, dup: 1, problems: 1, error: null }), '1 added, 1 skipped as duplicate, 1 row with a problem.');
  assert.match(importMessage({ added: 4, dup: 0, problems: 0, error: 'Boom.' }), /^Stopped early\. 4 added/);
  assert.match(importMessage({ added: 4, dup: 0, problems: 0, error: 'Boom.' }), /Boom\./);
});

test('database errors become plain messages, never raw text', () => {
  assert.match(importError({ message: 'PRLIM: row cap', code: 'P0001' }), /50,000/);
  assert.match(importError({ message: 'PRLIM' }), /50,000/);
  const raw = importError({ message: 'insert or update on table "transactions" violates foreign key constraint', code: '23503' });
  assert.doesNotMatch(raw, /violates|table|constraint/i);
  assert.match(importError(null), /try again/i);
});

test('problem list is capped for display with a count of the rest', () => {
  const ps = Array.from({ length: 25 }, (_, i) => ({ row: i + 1, message: `bad ${i + 1}` }));
  const lines = problemLines(ps, 10);
  assert.equal(lines.length, 11);
  assert.equal(lines[0], 'Row 1: bad 1');
  assert.match(lines[10], /15 more/);
  assert.deepEqual(problemLines(ps.slice(0, 2), 10), ['Row 1: bad 1', 'Row 2: bad 2']);
});

// ---- share size cap, date range, messages
test('share cap: exactly at the cap is fine, one character over is refused', () => {
  assert.equal(MAX_SHARE_CHARS, 200000);
  assert.deepEqual(checkShareSize('x'.repeat(MAX_SHARE_CHARS)), { ok: true });
  assert.equal(checkShareSize('x'.repeat(MAX_SHARE_CHARS + 1)).ok, false);
});

test('share cap: the refusal says how many entries and tells the person to narrow From/To', () => {
  const rows = Array.from({ length: 3000 }, (_, i) => tx({ description: `Lunch number ${i} with a long description to add size` }));
  const out = buildExport(rows, snap);
  assert.ok(out.text.length > MAX_SHARE_CHARS);
  const r = checkShareSize(out.text, out.count);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.message, /3,000 entries/);
    assert.match(r.message, /From/);
    assert.match(r.message, /To/);
    assert.match(r.message, /date range/i);
  }
});

test('share cap: without an explicit count the entries are counted from the text', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => tx({ description: `Lunch ${i} padded padded padded padded` }));
  const r = checkShareSize(buildExport(rows, snap).text);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /5,000 entries/);
});

test('range: only entries inside From..To (inclusive) are exported', () => {
  const txs = [
    tx({ transaction_date: '2026-01-31', description: 'aaa' }),
    tx({ transaction_date: '2026-02-01', description: 'bbb' }),
    tx({ transaction_date: '2026-02-28', description: 'ccc' }),
    tx({ transaction_date: '2026-03-01', description: 'ddd' }),
  ];
  const out = buildExport(txs, snap, { from: '2026-02-01', to: '2026-02-28' });
  assert.equal(out.count, 2);
  assert.ok(out.text.includes('"bbb"') && out.text.includes('"ccc"'));
  assert.ok(!out.text.includes('"aaa"') && !out.text.includes('"ddd"'));
  assert.equal(buildExport(txs, snap, { from: '2026-02-28' }).count, 2);
  assert.equal(buildExport(txs, snap, { to: '2026-01-31' }).count, 1);
  assert.equal(buildExport(txs, snap, {}).count, 4);
  assert.equal(buildExport(txs, snap).count, 4);
});

test('range: empty means everything; whitespace is ignored', () => {
  assert.deepEqual(checkExportRange('', '', TODAY), { ok: true, range: {} });
  assert.deepEqual(checkExportRange('  ', ' ', TODAY), { ok: true, range: {} });
  assert.deepEqual(checkExportRange(' 2026-01-01 ', '', TODAY), { ok: true, range: { from: '2026-01-01' } });
  assert.deepEqual(checkExportRange('2026-01-01', '2026-01-01', TODAY), { ok: true, range: { from: '2026-01-01', to: '2026-01-01' } });
});

test('range: invalid, impossible or out-of-range dates say what to fix', () => {
  for (const bad of ['2026-13-01', '2026-02-30', 'yesterday', '10/14/2026', '1999-12-31', '2040-01-01']) {
    const a = checkExportRange(bad, '', TODAY);
    assert.equal(a.ok, false, bad);
    if (!a.ok) {
      assert.match(a.message, /^From /);
      assert.match(a.message, /YYYY-MM-DD/);
    }
    const b = checkExportRange('', bad, TODAY);
    assert.equal(b.ok, false, bad);
    if (!b.ok) assert.match(b.message, /^To /);
  }
});

test('range: From after To is refused with both dates named', () => {
  const r = checkExportRange('2026-05-02', '2026-05-01', TODAY);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.message, /2026-05-02/);
    assert.match(r.message, /2026-05-01/);
    assert.match(r.message, /after/i);
  }
});

test('range label and success text say exactly how many entries and the range', () => {
  assert.equal(rangeLabel({}), '');
  assert.equal(rangeLabel({ from: '2026-01-01', to: '2026-03-31' }), 'from 2026-01-01 to 2026-03-31');
  assert.equal(rangeLabel({ from: '2026-01-01' }), 'from 2026-01-01 onwards');
  assert.equal(rangeLabel({ to: '2026-03-31' }), 'up to 2026-03-31');
  assert.match(exportDoneMessage(1234, {}), /^1,234 entries shared\./);
  assert.match(exportDoneMessage(1, {}), /^1 entry shared\./);
  const m = exportDoneMessage(12, { from: '2026-01-01', to: '2026-03-31' });
  assert.match(m, /12 entries shared from 2026-01-01 to 2026-03-31/);
  assert.match(m, /zovix-export\.csv/);
  assert.ok(!/ready/.test(m));
});

test('the export-row comment no longer claims it never cuts anything off', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../native/src/csvLogic.ts', import.meta.url), 'utf8');
  assert.ok(!/never cuts anything off/.test(src));
});

// ---- the web artifact's own export: "id,date,type,amount,category,description,notes,account,to" (an extra id column in front, and "to" instead of "to_account")
const ARTIFACT_CSV = [
  'id,date,type,amount,category,description,notes,account,to',
  '"tdemo1","2026-10-01","expense","120.00","Food","Lunch","","Cash",""',
  '"tdemo2","2026-10-02","income","5000.00","Salary","Pay","","GCash",""',
  '"tdemo3","2026-10-03","transfer","1000.00","Transfer","","","Cash","GCash"',
].join('\n');
test('a CSV exported from the web artifact imports (the leading id column and the "to" header are understood)', () => {
  const plan = planImport(ARTIFACT_CSV, snap, new Set(), TODAY);
  assert.equal(plan.blocked, null);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.rows.length, 3);
  assert.equal(plan.rows[0].amount_minor, 12000);
  assert.equal(plan.rows[0].transaction_date, '2026-10-01');
  assert.equal(plan.rows[2].type, 'transfer');
  assert.equal(plan.rows[2].transfer_account_id, 'b');
});
test('the normal export still imports, and a file that only looks similar is left alone', () => {
  const plain = planImport(buildExport([], snap).text + '\n2026-10-01,expense,10.00,Food,x,,Cash,', snap, new Set(), TODAY);
  assert.equal(plain.rows.length, 1);
  const odd = planImport('id,name\n1,abc', snap, new Set(), TODAY);
  assert.ok(odd.problems.length >= 1 || odd.blocked);
});
