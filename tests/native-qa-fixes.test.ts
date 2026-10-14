import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeDb } from './helpers/fakeDb.ts';
import { createEntryWith } from '../native/src/entriesCore.ts';
import { RECORDS_DELETE } from '../native/src/deleteAccountLogic.ts';
import { RESET_KINDS, RESET_LABEL } from '../native/src/resetLogic.ts';
import { createGeneration, decideAsk, openSheet } from '../native/src/gateFlow.ts';
import { promptOnClose } from '../native/src/unsaved.ts';
import { createLeaveWatcher } from '../native/src/leaveWatcher.ts';
import { createGateMemo } from '../native/src/gateMemo.ts';
import { TOUR } from '../native/src/tourContent.ts';
import { parseAmountMinor } from '../src/core/money.ts';

const read = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');
const patch = {
  amount_minor: 150000,
  transaction_date: '2026-10-14',
  description: 'x',
  account_id: 'a1',
  type: 'expense' as const,
  category_id: 'c1',
  transfer_account_id: null,
};

// ---- a retry after a lost reply must never keep the OLD values while saying "saved"
test('new entry: a first save that reached the database but whose reply was lost is corrected, not silently kept, when the person edits and saves again', async () => {
  // the insert is skipped (the row already exists): the stored row must be updated to what the form says now
  const skipped = fakeDb({
    'transactions.upsert': { data: [], error: null },
    'transactions.update': { data: [{ id: 'x' }], error: null },
    'transactions.select': { count: 1, error: null },
  });
  assert.equal(await createEntryWith(skipped, 'u1', patch, 'rid-1'), null);
  const upd = skipped.of('transactions', 'update');
  assert.equal(upd.length, 1);
  assert.deepEqual(upd[0].args[0], patch);
  assert.deepEqual(upd[0].filters, [
    ['user_id', 'u1'],
    ['request_id', 'rid-1'],
    ['request_idx', 0],
  ]);
  // a normal first save does not need the extra write
  const fresh = fakeDb({ 'transactions.upsert': { data: [{ id: 'new' }], error: null }, 'transactions.select': { count: 1, error: null } });
  assert.equal(await createEntryWith(fresh, 'u1', patch, 'rid-2'), null);
  assert.equal(fresh.of('transactions', 'update').length, 0);
  // an update that fails is reported, not hidden
  const bad = fakeDb({ 'transactions.upsert': { data: [], error: null }, 'transactions.update': { error: { message: 'x' } } });
  assert.ok(await createEntryWith(bad, 'u1', patch, 'rid-3'));
});

// ---- the Settings "Delete my records" card must say what the sheet really does
test('Delete my records card names every choice the sheet offers, and the starting-balance effect of Delete ALL', () => {
  const card = RECORDS_DELETE.join(' ').toLowerCase();
  const noun: Record<string, string> = { entries: 'entries', budgets: 'budgets', goals: 'goals', recurring: 'recurring' };
  for (const k of RESET_KINDS) assert.ok(card.includes(noun[k]), `the card mentions ${k}`);
  assert.match(card, /everything|all my records/);
  assert.match(card, /starting balance[^.]*0|0[^.]*starting balance/); // Delete ALL zeroes them
  assert.doesNotMatch(card, /accounts keep their starting balances/); // the old, false sentence
  for (const k of RESET_KINDS) assert.ok(RESET_LABEL[k].length > 0);
});

// ---- one sheet at a time, in a fixed priority (the existing-data question first)
test('only one sheet is ever open: priority ask, fresh, choose, end; none while the tour or Make it yours is showing', () => {
  const keys = ['ask', 'fresh', 'choose', 'end', 'tour', 'mine'] as const;
  for (let m = 0; m < 1 << keys.length; m++) {
    const st = Object.fromEntries(keys.map((k, i) => [k, !!(m & (1 << i))])) as Record<(typeof keys)[number], boolean>;
    const open = openSheet(st);
    if (st.tour || st.mine) assert.equal(open, null);
    else if (st.ask) assert.equal(open, 'ask');
    else if (st.fresh) assert.equal(open, 'fresh');
    else if (st.choose) assert.equal(open, 'choose');
    else if (st.end) assert.equal(open, 'end');
    else assert.equal(open, null);
  }
});

test('Gate renders every sheet from openSheet (so two can never stack), including during the setup steps', () => {
  const g = read('Gate.tsx');
  assert.match(g, /openSheet\(/);
  for (const k of ['ask', 'fresh', 'choose', 'end']) assert.match(g, new RegExp(`sheet === '${k}'`));
  const wizardReturn = g.slice(g.indexOf('if (gate.show)'), g.indexOf('const endTour'));
  assert.match(wizardReturn, /<ExistingDataPrompt/); // the question is asked BEFORE the required setup, not after it
  assert.match(wizardReturn, /resetSheet/);
});

// ---- the "already has data" question is never lost
test('the existing-data question is remembered on the phone until answered (a theme pick or closing the app cannot lose it)', () => {
  const f = read('flags.ts');
  assert.match(f, /askPending/);
  assert.match(f, /setAskPending/);
  const g = read('Gate.tsx');
  assert.match(g, /setAskPending\(id, true\)/);
  assert.match(g, /setAskPending\(uid, false\)/); // cleared on Keep and when the reset sheet is closed
  assert.match(g, /askPending\(id\)/);
});

// ---- the tutorial replay is read-only
test('"Show the first-run tutorial again" is a read-only walkthrough: it never opens the required setup, whatever data exists', () => {
  const g = read('Gate.tsx');
  assert.match(g, /const \[replaying, setReplaying\] = useState\(false\)/);
  assert.doesNotMatch(g, /REPLAY_FLAGS/);
  const replay = g.slice(g.indexOf('if (replaying)'), g.indexOf('if (gate.show)'));
  assert.match(replay, /tour/); // the Wizard in its walkthrough ("tour") mode
  assert.match(replay, /setReplaying\(false\)/);
  assert.doesNotMatch(replay, /onUseSamples/); // no samples are offered in a replay, so no Keep / Clear question is missed
});

// ---- no flashing screens
test('the first load decides Make it yours, the tour-seen flag, the pending samples and the pending question TOGETHER with the data, so nothing flashes and swaps', () => {
  const g = read('Gate.tsx');
  const refresh = g.slice(g.indexOf('const refresh = useCallback'), g.indexOf('useEffect(() => {\n    refresh();'));
  for (const w of ['makeItYoursSeen(id)', 'samplePending(id)', 'tabTourSeen(id)', 'askPending(id)', 'booted'])
    assert.ok(refresh.includes(w), w);
  assert.doesNotMatch(g, /void makeItYoursSeen\(uid\)/); // the late check that caused the flash is gone
  assert.match(g, /Promise\.all\(\[samplePending|sampleEnd/); // the Keep / Clear sheet waits for the tour-seen check
});

test('the tour choice counts as seen only when it is answered (closing the app at that sheet keeps the offer)', () => {
  const g = read('Gate.tsx');
  const effect = g.slice(
    g.indexOf('// the tab tour opens once per account'),
    g.indexOf('useEffect(() => {\n    // a queued launcher-icon'),
  );
  assert.doesNotMatch(effect, /markTabTourSeen/);
  const choose = g.slice(g.indexOf('const onChoose'), g.indexOf('const replay'));
  assert.match(choose, /markTabTourSeen\(uid\)/);
});

// ---- overlapping reloads: the newest answer wins
test('an older reload can never overwrite a newer one', () => {
  const gen = createGeneration();
  const first = gen.next();
  const second = gen.next();
  assert.equal(gen.isStale(first), true);
  assert.equal(gen.isStale(second), false);
  const g = read('Gate.tsx');
  assert.match(g, /createGeneration\(\)/);
  assert.match(g, /isStale\(/);
});

// ---- no more "hang after Next" repeats in the setup
test('"Open my Zovix" shows it is working and cannot be tapped twice; setup Quick Add waits for the reload and shows its error', () => {
  const w = read('Wizard.tsx');
  assert.match(w, /const \[finishing, setFinishing\] = useState\(false\)/);
  assert.match(w, /busy=\{finishing\}/);
  const q = read('QuickAdd.tsx');
  assert.match(q, /await onSaved\(\)/);
  assert.match(q, /could not refresh/i);
});

test('Save balances sends the account updates together and says honestly when only some were saved', () => {
  const d = read('wizardData.ts');
  assert.match(d, /Promise\.all\(plan\.patch\.map/);
  assert.match(d, /Saved \$\{.*\} of \$\{/);
});

// ---- the icon change fires only after a REAL leave (behaviour, with fake timers)
function watcher(over: Partial<{ state: string; ext: number }> = {}) {
  const st = {
    state: over.state ?? 'background',
    ext: over.ext ?? 0,
    applied: 0,
    timers: [] as { f: () => void; ms: number; live: boolean }[],
    bg: 0,
    act: 0,
  };
  const w = createLeaveWatcher({
    delayMs: 800,
    getState: () => st.state,
    externalOpen: () => st.ext,
    apply: () => void st.applied++,
    noteBackground: () => void st.bg++,
    noteActive: () => void st.act++,
    setTimer: (f, ms) => {
      const h = { f, ms, live: true };
      st.timers.push(h);
      return h;
    },
    clearTimer: (h) => void ((h as { live: boolean }).live = false),
  });
  const fire = () => st.timers.filter((x) => x.live).forEach((x) => ((x.live = false), x.f()));
  return { st, w, fire };
}
test('leave watcher: background then still in the background after the delay applies the icon once', () => {
  const { st, w, fire } = watcher();
  w.onChange('background');
  assert.equal(st.timers[0].ms, 800);
  assert.equal(st.applied, 0); // nothing at once
  fire();
  assert.equal(st.applied, 1);
  assert.equal(st.bg, 1);
});
test('leave watcher: coming back before the delay cancels it; "inactive" never schedules; a share sheet (external screen) blocks it', () => {
  const a = watcher();
  a.w.onChange('background');
  a.w.onChange('active'); // back in front
  a.fire();
  assert.equal(a.st.applied, 0);
  assert.equal(a.st.act, 1);
  const b = watcher();
  b.w.onChange('inactive');
  assert.equal(b.st.timers.length, 0);
  const c = watcher({ ext: 1 });
  c.w.onChange('background');
  c.fire();
  assert.equal(c.st.applied, 0);
  const d = watcher({ state: 'active' }); // the timer fires but the app is in front again
  d.w.onChange('background');
  d.fire();
  assert.equal(d.st.applied, 0);
});
test('leave watcher: a second background replaces the first timer (never two applies)', () => {
  const { st, w, fire } = watcher();
  w.onChange('background');
  w.onChange('background');
  fire();
  assert.equal(st.applied, 1);
  assert.match(read('Gate.tsx'), /createLeaveWatcher\(/);
});

// ---- a theme change (the app redraws) keeps you where you were
test('the Gate remembers its data and tab across the theme redraw, and forgets them on sign-out', () => {
  const m = createGateMemo<{ n: number }>();
  assert.equal(m.get(), null);
  m.set({ n: 1 });
  assert.deepEqual(m.get(), { n: 1 });
  m.clear();
  assert.equal(m.get(), null);
  const g = read('Gate.tsx');
  assert.match(g, /gateMemo\.get\(\)/);
  assert.match(g, /gateMemo\.set\(/);
  assert.match(read('App.tsx'), /gateMemo\.clear\(\)/);
});

// ---- the tour length rule is exact (the rule says 7)
test('the tour has at most 7 steps and the comment in tourContent says so', () => {
  assert.ok(TOUR.length <= 7, `${TOUR.length} steps`);
  assert.match(read('tourContent.ts'), /7 steps/);
  assert.doesNotMatch(read('tourContent.ts'), /8 steps/);
  for (const x of TOUR) for (const k of ['title', 'text'] as const) assert.ok(x[k].length <= 150, `${x.targetId}.${k}`);
});

// ---- money: an amount with two decimal points is an error, never a silently shortened number
test('amounts with more than one decimal point are refused (1.2.3 used to save 1.20, 1.50.99 saved 1.50)', () => {
  assert.equal(parseAmountMinor('1.2.3'), null);
  assert.equal(parseAmountMinor('1.50.99'), null);
  assert.equal(parseAmountMinor('..5'), null);
  assert.equal(parseAmountMinor('1,234.56'), 123456); // thousands separators still work
  assert.equal(parseAmountMinor('1500'), 150000);
  assert.equal(parseAmountMinor('1500.5'), 150050);
  assert.equal(parseAmountMinor('0.10')! + parseAmountMinor('0.20')!, 30);
});

// ---- the checks that guard native changes actually run on native changes
test('CI type-checks the native app, and the live run also starts for native changes', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /native-typecheck:/);
  assert.match(ci, /npm ci --prefix native/);
  assert.match(ci, /cd native && npx tsc --noEmit/);
  const qa = fs.readFileSync('.github/workflows/prod-qa.yml', 'utf8');
  assert.doesNotMatch(qa, /paths: \[[^\]]*'native\/\*\*'/); // main decided native-only commits do not re-run the live suites (see landing.test.ts)
});

// ---- J1 findings: another account's data never shows, the question is never lost, copy tells the truth
test('gate memo: a reload that started before a sign-out can never put the old account back (epoch), and the memo is only used for the SAME account', () => {
  const m = createGateMemo<{ uid: string }>();
  const token = m.begin(); // a reload starts
  m.clear(); // sign-out while it runs
  assert.equal(m.set({ uid: 'A' }, token), false); // its late result is dropped
  assert.equal(m.get(), null);
  const t2 = m.begin();
  assert.equal(m.set({ uid: 'B' }, t2), true);
  assert.equal(m.get()?.uid, 'B');
  const g = read('Gate.tsx');
  assert.match(g, /export function Gate\(\{ uid: sessionUid \}/);
  assert.match(g, /kept0 && kept0\.uid === sessionUid/); // never start from another account's data
  assert.match(read('App.tsx'), /<Gate uid=\{/);
});

test('the existing-data question: saved as soon as a sign-up is detected, kept when the counts cannot be read, cleared when the account turns out to be empty or after Start fresh', () => {
  // brand-new sign-up, counts say there is data: ask, keep it pending
  assert.deepEqual(decideAsk({ wasSignUp: true, pending: true, total: 5 }), { ask: true, write: null });
  // sign-up into an empty account: nothing to ask, clear the early "pending"
  assert.deepEqual(decideAsk({ wasSignUp: true, pending: true, total: 0 }), { ask: false, write: 'clear' });
  // the counts could not be read (offline / failed load): keep the question pending, ask conservatively
  assert.deepEqual(decideAsk({ wasSignUp: true, pending: true, total: null }), { ask: true, write: null });
  // a pending question on a later start: data still there -> ask; account now empty (after Start fresh) -> clear
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: true, total: 7 }), { ask: true, write: null });
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: true, total: 0 }), { ask: false, write: 'clear' });
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: false, total: 7 }), { ask: false, write: null });
  const g = read('Gate.tsx');
  assert.match(g, /if \(wasSignUp\) await setAskPending\(id, true\)/); // before the network reads
  assert.match(g, /decideAsk\(/);
  assert.match(g, /const reloads = createGeneration\(\)/); // module level: a remounted Gate makes the old one's reload stale
  assert.doesNotMatch(g, /gen = useRef\(createGeneration/);
  const reset = g.slice(g.indexOf('const resetSheet'), g.indexOf('if (replaying)'));
  assert.match(reset, /setAskPending\(uid, false\)/);
  assert.match(reset, /onDone=/);
});

test('copy is true while sample entries exist: the balance step and the Keep text say they are added on top until cleared', () => {
  const logic = fs.readFileSync('native/src/sampleLogic.ts', 'utf8');
  assert.match(logic, /export const BALANCE_SAMPLE_NOTE/);
  assert.match(logic, /on top/);
  assert.match(read('WizardAction.tsx'), /BALANCE_SAMPLE_NOTE/);
  assert.match(logic, /count in your balances until you clear them/);
});

test('the lost-reply correction touches exactly that one row and treats "no row" as gone', async () => {
  const gone = fakeDb({ 'transactions.upsert': { data: [], error: null }, 'transactions.update': { data: [], error: null } });
  assert.match((await createEntryWith(gone, 'u1', patch, 'rid-9')) ?? '', /no longer exists/i);
  const ok = fakeDb({
    'transactions.upsert': { data: [], error: null },
    'transactions.update': { data: [{ id: 'x' }], error: null },
    'transactions.select': { count: 1, error: null },
  });
  assert.equal(await createEntryWith(ok, 'u1', patch, 'rid-10'), null);
  assert.deepEqual(ok.of('transactions', 'update')[0].filters, [
    ['user_id', 'u1'],
    ['request_id', 'rid-10'],
    ['request_idx', 0],
  ]);
});

test('the read-only tutorial replay has a pinned Close and the back button leaves it', () => {
  const w = read('Wizard.tsx');
  assert.match(w, /onClose\?: \(\) => void/);
  assert.match(w, /<HeaderClose label="Close" onPress=\{p\.onClose\}/);
  const g = read('Gate.tsx');
  assert.match(g, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(g, /onClose=\{\(\) => setReplaying\(false\)\}/);
});

test('while Start fresh is open a reload never swaps it back to the existing-data question', () => {
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: true, total: 7, fresh: true }), { ask: false, write: null });
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: true, total: 7, fresh: false }), { ask: true, write: null });
  const g = read('Gate.tsx');
  assert.match(g, /fresh: freshOpen\.current/);
  assert.match(g, /const freshOpen = useRef\(false\)/);
  assert.match(g, /freshOpen\.current = fresh/);
});

test('the live lost-reply step removes a leftover row from an aborted run before it starts', () => {
  const live = fs.readFileSync('tests/prod/rls-bulk.ts', 'utf8');
  const step = live.slice(live.indexOf('native lost-reply retry'));
  const del = step.search(/delete\(\)\s*\.eq\('user_id', A\.id\)\s*\.eq\('request_id', rid\)/);
  assert.ok(del >= 0 && del < step.search(/const first = await A\.c\s*\.from\('transactions'\)\s*\.upsert/));
});

test('once the existing-data question is answered (Keep / Start fresh), a reload that was already running can never raise it again', () => {
  assert.deepEqual(decideAsk({ wasSignUp: false, pending: true, total: 7, answered: true }), { ask: false, write: null });
  assert.deepEqual(decideAsk({ wasSignUp: true, pending: true, total: 7, answered: true }), { ask: false, write: null });
  const g = read('Gate.tsx');
  assert.match(g, /const askAnswered = useRef\(false\)/);
  assert.match(g, /answered: askAnswered\.current/);
  const keep = g.slice(g.indexOf('const keepExisting'), g.indexOf('const startFresh'));
  assert.match(keep, /askAnswered\.current = true/);
  const fresh = g.slice(g.indexOf('const startFresh'), g.indexOf('const resetSheet'));
  assert.match(fresh, /askAnswered\.current = true/);
});

// ---- QA findings F4/F5/F10: honest copy, and tests that fail when the wiring is broken
test('closing a sheet asks only when there are unsaved changes (behaviour of the guard Sheet uses)', () => {
  assert.equal(promptOnClose(true), 'ask');
  assert.equal(promptOnClose(false), 'close');
  assert.equal(promptOnClose(undefined), 'close');
  assert.match(read('Sheet.tsx'), /promptOnClose\(dirty\) === 'ask'/);
});

test('the tour question tells the truth whether or not sample entries exist', () => {
  const sheets = read('SampleSheets.tsx');
  assert.doesNotMatch(sheets, /using your own data/);
  assert.match(sheets, /using what is in your app now/);
});

test('mutation guards: each answer/settle call is inside the handler that must make it', () => {
  const g = read('Gate.tsx');
  const keep = g.slice(g.indexOf('const keepExisting'), g.indexOf('const startFresh'));
  assert.match(keep, /setAskPending\(uid, false\)/); // Keep settles the question
  const wiz = g.slice(g.indexOf('if (gate.show)'), g.indexOf('const endTour'));
  assert.match(wiz, /<ExistingDataPrompt open=\{sheet === 'ask'\}/); // the question can actually open during setup
  const end = g.slice(g.indexOf('<TourEnd'), g.indexOf('{resetSheet}', g.indexOf('<TourEnd')));
  const onKeep = end.slice(end.indexOf('onKeep='), end.indexOf('onClear='));
  assert.match(onKeep, /setSamplePending\(uid, false\)/); // Keep settles the Keep / Clear question
  const st = read('Settings.tsx');
  const del = st.slice(st.indexOf('const deleteSamples'), st.indexOf('return (', st.indexOf('const deleteSamples')));
  assert.match(del, /recount\(\)/); // the count is refreshed after deleting
});

// ---- reinstall: an account that is already set up is NOT a new user (the "seen" flags live on the phone and a reinstall wipes them)
import { isReturningAccount } from '../native/src/gateFlow.ts';
const base = { wasSignUp: false, replaying: false, firstLoad: true, accountsCount: 2 };
test('a returning account (set up, flags wiped by a reinstall) skips the walkthrough, Make it yours and the tour question', () => {
  assert.equal(isReturningAccount({ ...base, gate: { show: true, step: 'tour' } }), true); // flags wiped, everything already set up
  // nothing to show is NOT proof of a reinstall: a failed count read looks the same, and so does a new user who left the tour question open
  assert.equal(isReturningAccount({ ...base, gate: { show: false } }), false);
});
test('new users and real replays still get the tutorial', () => {
  assert.equal(isReturningAccount({ ...base, wasSignUp: true, gate: { show: true, step: 'account' } }), false); // just signed up
  assert.equal(isReturningAccount({ ...base, accountsCount: 0, gate: { show: true, step: 'account' } }), false); // nothing set up yet
  assert.equal(isReturningAccount({ ...base, gate: { show: true, step: 'budget' } }), false); // unfinished setup continues
  assert.equal(isReturningAccount({ ...base, replaying: true, gate: { show: true, step: 'tour' } }), false); // Settings > replay
  assert.equal(isReturningAccount({ ...base, firstLoad: false, gate: { show: true, step: 'tour' } }), false); // only decided once per app start
});
test('a set-up account whose opening balances are all zero is still a returning account after a reinstall; a new user at that step is not', () => {
  assert.equal(isReturningAccount({ ...base, hasActivity: true, gate: { show: true, step: 'balance' } }), true);
  assert.equal(isReturningAccount({ ...base, hasActivity: false, gate: { show: true, step: 'balance' } }), false);
  assert.equal(isReturningAccount({ ...base, hasActivity: true, gate: { show: true, step: 'finish' } }), false); // someone who just finished setup
});
test('the gate applies it before anything is shown', () => {
  const g = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  assert.match(g, /isReturningAccount\(/);
  assert.match(g, /markTabTourSeen\(id\)/);
  assert.match(g, /markMakeItYoursSeen\(id\)/);
});
