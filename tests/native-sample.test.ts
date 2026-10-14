import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb } from './helpers/fakeDb.ts';
import { SAMPLE_IDS, buildSampleRows, canOfferSample } from '../native/src/sampleLogic.ts';
import { addSampleWith, countSampleWith, removeSampleWith } from '../native/src/sampleCore.ts';
import { withTimeout } from '../native/src/coachLogic.ts';

const accounts = [
  { id: 'a1', name: 'Cash', short_name: null, counts_as_savings: false, opening_balance_minor: 0, show_on_home: true },
  { id: 'a2', name: 'Savings', short_name: null, counts_as_savings: true, opening_balance_minor: 0, show_on_home: true },
];
const categories = [
  { id: 'c1', name: 'Food', type: 'expense' as const },
  { id: 'c2', name: 'Transport', type: 'expense' as const },
  { id: 'c3', name: 'Salary', type: 'income' as const },
];

test('sample rows: whole centavos, real accounts and categories, recent plausible dates, fixed request ids', () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  assert.ok(rows.length >= 4 && rows.length <= SAMPLE_IDS.length);
  for (const r of rows) {
    assert.ok(Number.isInteger(r.patch.amount_minor) && r.patch.amount_minor > 0);
    assert.ok(accounts.some((a) => a.id === r.patch.account_id));
    assert.match(r.patch.transaction_date, /^2026-(09|10)-\d\d$/);
    assert.ok(r.patch.transaction_date <= '2026-10-14');
    assert.ok(SAMPLE_IDS.includes(r.requestId));
    assert.ok(SAMPLE_IDS.includes(r.requestId));
    assert.match(r.patch.description, /^Sample: /); // it is plain to see that these are samples
    assert.equal(r.patch.type === 'transfer', false);
    if (r.patch.category_id) assert.ok(categories.some((c) => c.id === r.patch.category_id && c.type === r.patch.type));
  }
  assert.equal(new Set(rows.map((r) => r.requestId)).size, rows.length);
});

test('sample rows: needs an account, and works with no categories', () => {
  assert.deepEqual(buildSampleRows([], categories, '2026-10-14'), []);
  const rows = buildSampleRows(accounts, [], '2026-10-14');
  assert.ok(rows.length > 0 && rows.every((r) => r.patch.category_id === null));
});

test('sample data is offered only to an account that has no entries yet', () => {
  assert.equal(canOfferSample({ totalEntries: 0, budgetsCount: 0, goalsCount: 0 }, 2), true);
  assert.equal(canOfferSample({ totalEntries: 1, budgetsCount: 0, goalsCount: 0 }, 2), false);
  assert.equal(canOfferSample({ totalEntries: 0, budgetsCount: 0, goalsCount: 0 }, 0), false);
  assert.equal(canOfferSample(null, 2), false); // unknown: never risk mixing with real data
});

test('adding samples is FAST: one retry-safe upsert for all rows plus one count check, null when all are confirmed', async () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  const db = fakeDb({ 'transactions.upsert': { error: null }, 'transactions.select': { count: rows.length, error: null } });
  assert.equal(await addSampleWith(db, 'u1', rows), null);
  const ups = db.of('transactions', 'upsert');
  assert.equal(ups.length, 1, 'one request for all rows, not one per row');
  const sent = ups[0].args[0] as Record<string, unknown>[];
  assert.ok(Array.isArray(sent) && sent.length === rows.length);
  for (const row of sent) {
    assert.equal(row.user_id, 'u1');
    assert.ok(SAMPLE_IDS.includes(String(row.request_id)));
    assert.equal(row.request_idx, 0);
  }
  assert.deepEqual(ups[0].args[1], { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true });
  const sel = db.of('transactions', 'select');
  assert.equal(sel.length, 1, 'one count check');
  assert.deepEqual(sel[0].filters, [['request_id in', sent.map((r) => r.request_id)]]);
  assert.equal(db.calls.length, 2, 'two requests in total');
});

test('adding samples: a count that does not match, a refused write and a thrown error are all reported', async () => {
  const rows = buildSampleRows(accounts, categories, '2026-10-14');
  const short = fakeDb({ 'transactions.upsert': { error: null }, 'transactions.select': { count: rows.length - 1, error: null } });
  assert.ok(await addSampleWith(short, 'u1', rows));
  const refused = fakeDb({ 'transactions.upsert': { error: { message: 'PRLIM: limit' } } });
  const msg = await addSampleWith(refused, 'u1', rows);
  assert.ok(msg && !/PRLIM/.test(msg));
  assert.ok(await addSampleWith(fakeDb({ 'transactions.upsert': 'throw' }), 'u1', rows));
  assert.ok(await addSampleWith(refused, '', rows));
});

test('removing samples deletes ONLY the untouched sample rows (fixed ids AND the "Sample:" label), then confirms none are left', async () => {
  const db = fakeDb({ 'transactions.delete': { data: [{ id: 'x' }], error: null }, 'transactions.select': { count: 0, error: null } });
  assert.equal(await removeSampleWith(db, 'u1'), null);
  const del = db.of('transactions', 'delete');
  assert.equal(del.length, 1);
  assert.deepEqual(del[0].filters, [
    ['user_id', 'u1'],
    ['request_id in', SAMPLE_IDS],
    ['description like', 'Sample:%'], // an entry the person edited into a real one is never deleted
  ]);
  assert.ok(await removeSampleWith(fakeDb({ 'transactions.delete': { error: { message: 'nope' } } }), 'u1'));
  assert.ok(await removeSampleWith(fakeDb({ 'transactions.delete': 'throw' }), 'u1'));
  assert.ok(await removeSampleWith(db, '')); // no user id: refuse, delete nothing more
  assert.equal(db.of('transactions', 'delete').length, 1);
});

test('removing samples: a delete that RLS filtered to nothing is reported, not called success', async () => {
  const left = fakeDb({ 'transactions.delete': { data: [], error: null }, 'transactions.select': { count: 3, error: null } });
  assert.ok(await removeSampleWith(left, 'u1'));
  const unknown = fakeDb({
    'transactions.delete': { data: [], error: null },
    'transactions.select': { count: null, error: { message: 'x' } },
  });
  assert.ok(await removeSampleWith(unknown, 'u1'));
});

test('withTimeout: a promise that never settles still resolves to the fallback', async () => {
  assert.equal(await withTimeout(new Promise<number>(() => {}), 20, -1), -1);
  assert.equal(await withTimeout(Promise.resolve(5), 20, -1), 5);
  assert.equal(await withTimeout(Promise.reject(new Error('x')), 20, -1), -1);
});

import fs from 'node:fs';
import { startSamplesWith } from '../native/src/sampleCore.ts';
import { decideGate } from '../native/src/logic.ts';

test('sample ids are valid uuids (transactions.request_id is a uuid column)', () => {
  for (const id of SAMPLE_IDS) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(SAMPLE_IDS).size, SAMPLE_IDS.length);
});

test('start samples: the pending flag is set BEFORE anything is written, and stays on success', async () => {
  const log: string[] = [];
  const m = await startSamplesWith({
    setPending: async (on) => void log.push(`pending:${on}`),
    add: async () => (log.push('add'), null),
    remove: async () => (log.push('remove'), null),
  });
  assert.equal(m, null);
  assert.deepEqual(log, ['pending:true', 'add']);
});

test('start samples: a partial failure is cleaned up, and the flag is cleared only if the clean-up worked', async () => {
  const a: string[] = [];
  const m = await startSamplesWith({
    setPending: async (on) => void a.push(`pending:${on}`),
    add: async () => (a.push('add'), 'could not add'),
    remove: async () => (a.push('remove'), null),
  });
  assert.equal(m, 'could not add');
  assert.deepEqual(a, ['pending:true', 'add', 'remove', 'pending:false']);
  const b: string[] = [];
  await startSamplesWith({
    setPending: async (on) => void b.push(`pending:${on}`),
    add: async () => 'could not add',
    remove: async () => (b.push('remove'), 'still there'),
  });
  assert.deepEqual(b, ['pending:true', 'remove']); // rows may remain: the flag stays so the Keep / Clear question still appears
});

test('a brand-new account sees the wizard first step, where samples are offered; after them it moves on', () => {
  const off = { onboarded: false, wizard: false, balances: false, toured: false };
  const none = { totalEntries: 0, budgetsCount: 0, goalsCount: 0 };
  const d = decideGate(none, accounts, off);
  assert.ok(d.gate.show && d.gate.step === 'first');
  assert.equal(canOfferSample(none, accounts.length), true); // this is when the wizard shows "Use sample entries"
  const after = decideGate({ ...none, totalEntries: SAMPLE_IDS.length }, accounts, off);
  assert.ok(!after.gate.show || after.gate.step !== 'first');
});

test('the wizard offers samples only on its first step with no entries, and the tour has a hard deadline for its tooltip', () => {
  const w = fs.readFileSync('native/src/Wizard.tsx', 'utf8');
  assert.match(w, /onUseSamples/);
  assert.match(w, /totalEntries === 0/);
  const t = fs.readFileSync('native/src/TabTour.tsx', 'utf8');
  assert.match(t, /DEADLINE_MS/);
});

test('choosing "Not now" on the tour sheet still asks Keep / Clear when samples came from the wizard', () => {
  const g = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  const skip = g.slice(g.indexOf("if (k === 'skip')"), g.indexOf("if (k === 'sample')"));
  assert.match(skip, /samplePending/);
  assert.match(skip, /setSampleEnd\(true\)/);
});

import { TOUR_END_TITLE, TOUR_END_TEXT, TOUR_END_KEEP, TOUR_END_CLEAR, TOUR_END_CONFIRM } from '../native/src/sampleLogic.ts';

test('"Clear" after the tour means clear ALL of it: the sheet says everything, and the code runs the full reset then starts over', () => {
  // the words promise exactly what the code does
  for (const w of ['sample entries', 'budget', 'goal', 'starting balances', 'recurring']) assert.ok(TOUR_END_TEXT.includes(w), w);
  assert.match(TOUR_END_TEXT, /everything/i);
  assert.doesNotMatch(TOUR_END_TEXT, /only those sample entries|first step|start over/i); // not the narrow promise, and no restart of the tutorial
  assert.equal(TOUR_END_KEEP, 'Keep everything');
  assert.equal(TOUR_END_CLEAR, 'Clear everything');
  assert.match(TOUR_END_TEXT, /empty app/);
  assert.match(TOUR_END_CONFIRM, /Yes, delete everything/);
  assert.ok(TOUR_END_TITLE.length > 0);
  const sheets = fs.readFileSync('native/src/SampleSheets.tsx', 'utf8');
  assert.match(sheets, /resetWarning\('all'/); // the confirm step lists exactly what will go
  assert.match(sheets, /countFor/);
  const gate = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  const clear = gate.slice(gate.indexOf('onClear={'), gate.indexOf('<ResetData'));
  assert.match(clear, /resetChoice\('all'\)/);
  assert.doesNotMatch(clear, /replay/); // clearing does NOT send the person back into the first-run tutorial
  assert.match(clear, /await refresh\(\)/); // it just shows the empty app
  assert.doesNotMatch(clear, /removeSamples/); // not just the samples
});

test('the Delete-ALL option is available even when only starting balances are left to clear', () => {
  const src = fs.readFileSync('native/src/ResetData.tsx', 'utf8');
  assert.match(src, /const empty = n === 0 && k !== 'all'/);
});

test('the end-of-tour full reset needs the typed word DELETE, like Delete ALL in Settings (real data can reach this sheet)', () => {
  const sheets = fs.readFileSync('native/src/SampleSheets.tsx', 'utf8');
  assert.match(sheets, /TextInput/);
  assert.match(sheets, /canConfirm\(typed, 'all'\)/);
  assert.match(sheets, /Type \{confirmPhrase\('all'\)\} to confirm/); // the word shown is the one the reset logic checks (DELETE)
  const confirmBtn = sheets.slice(sheets.indexOf('TOUR_END_CONFIRM}'), sheets.indexOf('Go back'));
  assert.match(confirmBtn, /disabled|ready/); // the red button does nothing until the word matches
});

test('a failed clear recounts what is really left and refreshes the screen behind the sheet', () => {
  const sheets = fs.readFileSync('native/src/SampleSheets.tsx', 'utf8');
  const clear = sheets.slice(sheets.indexOf('const clear = async'), sheets.indexOf('return (', sheets.indexOf('const clear = async')));
  assert.match(clear, /setErr\(m\)/);
  assert.match(clear, /await review\(\)/);
  const gate = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  const onClear = gate.slice(gate.indexOf('onClear={'), gate.indexOf('<ResetData'));
  assert.match(onClear, /if \(r\.error\) \{[\s\S]*await refresh\(\)/);
});

test('clearing after the tour never re-runs the mandatory first-run tutorial; the first-run flags are left alone', () => {
  const gate = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  const onClear = gate.slice(gate.indexOf('onClear={'), gate.indexOf('<ResetData'));
  assert.doesNotMatch(onClear, /setFlags|REPLAY_FLAGS|replay/);
  assert.doesNotMatch(gate, /replay\(true\)|startOver|TOUR_END_RESTART_FAIL/);
  assert.match(gate, /onReplay=\{\(\) => void replay\(\)\}/); // the Settings "show the tutorial again" button is unchanged
  // with the "onboarded" flag set (it is, once the first-run steps were finished) the gate never shows the wizard, whatever the data
  const src = fs.readFileSync('src/lib/onboarding.ts', 'utf8');
  assert.match(src, /if \(cookies\.onboarded\) return \{ show: false/);
});

test('the sample writes use the local session (no extra network round trip for getUser)', () => {
  const api = fs.readFileSync('native/src/sampleApi.ts', 'utf8');
  assert.doesNotMatch(api, /auth\.getUser\(/);
  assert.match(api, /auth\.getSession\(/);
});

test('counting samples: a head count with the same filters as the delete (only untouched sample rows of this user), null when unknown', async () => {
  const db = fakeDb({ 'transactions.select': { count: 4, error: null } });
  assert.equal(await countSampleWith(db, 'u1'), 4);
  const sel = db.of('transactions', 'select');
  assert.equal(sel.length, 1);
  assert.deepEqual(sel[0].filters, [
    ['user_id', 'u1'],
    ['request_id in', SAMPLE_IDS],
    ['description like', 'Sample:%'],
  ]);
  assert.equal(await countSampleWith(fakeDb({ 'transactions.select': { count: null, error: { message: 'x' } } }), 'u1'), null);
  assert.equal(await countSampleWith(fakeDb({ 'transactions.select': 'throw' }), 'u1'), null);
  assert.equal(await countSampleWith(db, ''), null);
});

test('Settings always offers "Delete sample records" (in the Help / tutorial card) while sample entries exist, with a confirmation that says only Sample: entries go', () => {
  const st = fs.readFileSync('native/src/Settings.tsx', 'utf8');
  assert.match(st, /Delete sample records/);
  assert.match(st, /countSamples\(\)/);
  assert.match(st, /removeSamples\(\)/);
  assert.match(st, /sampleCount !== null && sampleCount > 0/); // shown only while there are sample entries
  assert.match(st, /Alert\.alert\(/);
  assert.match(st, /Sample:/);
  const help = st.slice(st.indexOf('id="settings:help"'), st.indexOf('<Text style={s.h2}>Account</Text>'));
  assert.match(help, /Delete sample records/); // inside the Help / tutorial card
  const api = fs.readFileSync('native/src/sampleApi.ts', 'utf8');
  assert.match(api, /countSamples/);
  assert.match(api, /setSamplePending\(/); // deleting them also settles the Keep / Clear question
});

test('the version shown in Settings is the real app version, not a hard-coded old number', () => {
  const st = fs.readFileSync('native/src/Settings.tsx', 'utf8');
  assert.doesNotMatch(st, /APP_VERSION = '\d/);
  assert.match(st, /Constants\.expoConfig\?\.version/);
});

test('Delete sample records shows it is working: the button is busy (and cannot be tapped twice) from the confirmation until the delete and refresh are done', () => {
  const st = fs.readFileSync('native/src/Settings.tsx', 'utf8');
  assert.match(st, /const \[sampleBusy, setSampleBusy\] = useState\(false\)/);
  assert.match(st, /busy=\{sampleBusy\}/);
  const del = st.slice(st.indexOf('const deleteSamples'), st.indexOf('return (', st.indexOf('const deleteSamples')));
  assert.match(del, /setSampleBusy\(true\)/);
  assert.match(del, /finally/);
  assert.match(del, /setSampleBusy\(false\)/);
  assert.match(del, /if \(sampleBusy\) return/);
});

test('if the sample entries cannot be counted, Settings says so and offers Try again (the option never silently disappears)', () => {
  const st = fs.readFileSync('native/src/Settings.tsx', 'utf8');
  assert.match(st, /sampleCount === null/);
  assert.match(st, /Could not check for sample entries/);
  const nullBranch = st.slice(st.indexOf('sampleCount === null'), st.indexOf('sampleCount !== null && sampleCount > 0'));
  assert.match(nullBranch, /Try again/);
  assert.match(nullBranch, /recount/);
  // while the first count is still running nothing flashes: a separate flag distinguishes "not counted yet" from "could not count"
  assert.match(st, /sampleChecked/);
});

test('PROGRESS.md carries the gate records and the instruction ledger for the 0.9.8 task (the judge reads them)', () => {
  const p = fs.readFileSync('PROGRESS.md', 'utf8');
  const i = p.indexOf('0.9.8');
  assert.ok(i >= 0);
  const entry = p.slice(i);
  for (const w of ['IL-1', 'IL-2', 'IL-3', 'IL-4', 'Gate G1', 'Gate G2', 'Gate G3', 'Gate G4', 'Gate G5a', 'deferred'])
    assert.ok(entry.includes(w), w);
  assert.match(entry, /the delete sample records was gone in the tutorial tab/); // verbatim
});
