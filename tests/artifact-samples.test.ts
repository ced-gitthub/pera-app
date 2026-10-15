// Item 3 (AC-30..33): sample records stay labelled, can be deleted from Settings, and the Keep/Clear question appears once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { HTML, slice, J, type St } from './artifact-undo-kit.ts';

type Sample = {
  count(tx: unknown[]): number;
  text(n: number): string;
  tag(x: St): string;
  remove(env: unknown): { ok: boolean; removed: number; message: string };
  showKeepClear(a: { samples: number; answered: boolean }): boolean;
  answer: { read(store: unknown): boolean; write(store: unknown): boolean };
  KEY: string;
  TITLE: string;
  KEEP: string;
  DELETE: string;
  OK: string;
  FAIL: string;
  NONE: string;
  NOTE: string;
  KC_TITLE: string;
  KC_BODY: string;
  KC_KEEP: string;
  KC_CLEAR: string;
  RECORD: string;
};
const SAMPLE = vm.runInNewContext(`${slice('SAMPLECORE')};SAMPLE`) as Sample;

const mk = (): St => ({
  fresh: 1,
  tx: [
    { id: 'd1', n: 1, demo: 1, amount: 5, type: 'expense' },
    { id: 't1', n: 2, amount: 7, type: 'income' },
    { id: 'd2', n: 3, demo: true, amount: 9, type: 'expense' },
    { id: 't2', n: 4, amount: 1, type: 'expense', demo: 0 },
  ],
  bud: { Food: 3000 },
  rec: [{ id: 'r1' }],
  open: { Cash: 100 },
  trash: [{ id: 'x', at: 1 }],
});
const env = (S: St, o: { save?: () => boolean; store?: boolean } = {}) => {
  const calls = { save: 0 };
  return {
    calls,
    env: {
      S: () => S,
      save: () => {
        calls.save++;
        return o.save ? o.save() : true;
      },
      storeOk: () => o.store ?? true,
    },
  };
};

test('AC-30 count and tag: every sample row is labelled in text and for screen readers', () => {
  assert.equal(SAMPLE.count(mk().tx), 2);
  assert.equal(SAMPLE.count([]), 0);
  assert.equal(SAMPLE.count(undefined as unknown as unknown[]), 0);
  assert.equal(SAMPLE.tag({ demo: 1 }), ' <span role="img" aria-label="Sample record" class="tag">Sample</span>');
  assert.equal(SAMPLE.tag({ demo: true }), SAMPLE.tag({ demo: 1 }));
  assert.equal(SAMPLE.tag({}), '');
  assert.equal(SAMPLE.tag({ demo: 0 }), '');
  assert.equal(SAMPLE.RECORD, 'Sample record');
});

test('AC-30 wiring: Home rows, Transactions rows and the editor all use the tag', () => {
  assert.ok(/const row0=x=>[^\n]*\$\{SAMPLE\.tag\(x\)\}/.test(HTML), 'Home row');
  assert.ok(/function lst\(\)[\s\S]*?\$\{SAMPLE\.tag\(x\)\}[\s\S]*?function budv/.test(HTML), 'Transactions/search row');
  assert.ok(/id="e-d"[\s\S]{0,200}/.test(HTML) && /x\.demo\?`<div class="m wide">\$\{SAMPLE\.RECORD\}/.test(HTML), 'editor header');
  assert.equal((HTML.match(/<span class="tag">Sample<\/span>/g) || []).length, 0, 'no unlabelled tag left');
});

test('AC-32 confirm text: native wording, singular and plural, "Sample" without the colon', () => {
  assert.equal(
    SAMPLE.text(11),
    'This deletes the 11 sample entries (the ones labelled "Sample"). Your own entries, budgets and goals stay.',
  );
  assert.equal(SAMPLE.text(1), 'This deletes the 1 sample entry (the ones labelled "Sample"). Your own entries, budgets and goals stay.');
  assert.equal(SAMPLE.TITLE, 'Delete sample records?');
  assert.equal(SAMPLE.KEEP, 'Keep them');
  assert.equal(SAMPLE.DELETE, 'Delete sample records');
  assert.equal(SAMPLE.OK, 'Sample records deleted.');
  assert.equal(SAMPLE.FAIL, 'Could not clear the sample entries. They are still there. Try again.');
});

test('AC-32 remove: exactly the sample rows go, nothing else is touched, one save', () => {
  const S = mk();
  const before = J(S);
  const { env: e, calls } = env(S);
  const r = SAMPLE.remove(e);
  assert.deepEqual(J(r), { ok: true, removed: 2, message: 'Sample records deleted.' });
  assert.deepEqual(
    S.tx.map((x: St) => x.id),
    ['t1', 't2'],
  );
  assert.equal(S.fresh, 0);
  assert.equal(calls.save, 1);
  for (const k of ['bud', 'rec', 'open', 'trash']) assert.deepEqual(S[k], before[k], k);
});

test('AC-32 remove: no samples is a calm no-op that does not save', () => {
  const S = mk();
  S.tx = S.tx.filter((x: St) => !x.demo);
  S.fresh = 0;
  const { env: e, calls } = env(S);
  const r = SAMPLE.remove(e);
  assert.deepEqual(J(r), { ok: true, removed: 0, message: 'There are no sample records.' });
  assert.equal(calls.save, 0);
  assert.equal(S.tx.length, 2);
});

test('AC-32 remove: a failed save puts every sample row back, in order, and says so', () => {
  const S = mk();
  const orig = S.tx;
  const before = J(S);
  const { env: e, calls } = env(S, { save: () => false });
  const r = SAMPLE.remove(e);
  assert.deepEqual(J(r), { ok: false, removed: 0, message: SAMPLE.FAIL });
  assert.equal(S.tx, orig, 'same array object');
  assert.deepEqual(J(S), before);
  assert.equal(S.fresh, 1);
  assert.equal(calls.save, 1, 'no retry loop');
});

test('AC-32 remove: a save that throws is a failure with the rollback', () => {
  const S = mk();
  const before = J(S);
  const { env: e } = env(S, {
    save: () => {
      throw new Error('quota');
    },
  });
  const r = SAMPLE.remove(e);
  assert.equal(r.ok, false);
  assert.equal(r.message, SAMPLE.FAIL);
  assert.deepEqual(J(S), before);
});

test('AC-32 remove: blocked storage fails before touching anything', () => {
  const S = mk();
  const before = J(S);
  const { env: e, calls } = env(S, { store: false });
  const r = SAMPLE.remove(e);
  assert.deepEqual(J(r), { ok: false, removed: 0, message: SAMPLE.FAIL });
  assert.equal(calls.save, 0);
  assert.deepEqual(J(S), before);
});

test('AC-32 wiring: Settings button stays while samples exist; Cancel deletes nothing; Delete uses the core', () => {
  assert.ok(/\$\{smp\?'<button data-a="sd">Delete sample records<\/button>':''\}/.test(HTML), 'permanent button');
  assert.ok(/SAMPLE\.text\(smp\)/.test(HTML) && /SAMPLE\.KEEP/.test(HTML), 'confirm panel');
  const sdc = HTML.match(/else if\(a=='sdc'\)\{[^\n]*/)?.[0] ?? '';
  assert.ok(sdc.includes('SAMPLE.remove('), 'sdc calls the core');
  const sd = HTML.match(/else if\(a=='sd'\)\{[^\n]*/)?.[0] ?? '';
  assert.ok(sd && !sd.includes('remove'), 'opening the panel deletes nothing');
});

test('AC-33 the starting-balance note: native words, only while samples exist', () => {
  assert.equal(SAMPLE.NOTE, 'The sample entries are added on top of this until you clear them.');
  assert.ok(/SAMPLE\.count\(S\.tx\)\?`<p class="m">\$\{SAMPLE\.NOTE\}<\/p>`:''/.test(HTML));
});

test('AC-31 Keep/Clear: shown only with samples and no answer yet', () => {
  assert.equal(SAMPLE.showKeepClear({ samples: 3, answered: false }), true);
  assert.equal(SAMPLE.showKeepClear({ samples: 1, answered: false }), true);
  assert.equal(SAMPLE.showKeepClear({ samples: 0, answered: false }), false);
  assert.equal(SAMPLE.showKeepClear({ samples: 3, answered: true }), false);
  assert.equal(SAMPLE.showKeepClear({ samples: 0, answered: true }), false);
});

test('AC-31 Keep/Clear words: native button labels, clear about what Clear does', () => {
  assert.equal(SAMPLE.KC_TITLE, 'Keep the sample entries?');
  assert.equal(SAMPLE.KC_KEEP, 'Keep everything');
  assert.equal(SAMPLE.KC_CLEAR, 'Clear everything');
  for (const w of ['sample entries', 'budgets', 'recurring rules', 'starting balances', 'accounts and categories stay'])
    assert.ok(SAMPLE.KC_BODY.toLowerCase().includes(w), w);
});

test('AC-31 answer flag: Keep persists under mt1sq; a broken store never nags', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(SAMPLE.KEY, 'mt1sq');
  assert.equal(SAMPLE.answer.read(store), false);
  assert.equal(SAMPLE.answer.write(store), true);
  assert.equal(mem.get('mt1sq'), '1');
  assert.equal(SAMPLE.answer.read(store), true);
  const bad = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(SAMPLE.answer.read(bad), true, 'unreadable = treat as answered, nothing is forced');
  assert.equal(SAMPLE.answer.write(bad), false);
  assert.equal(SAMPLE.answer.read(null), true);
});

test('AC-31 wiring: Keep writes the flag; Clear only opens the panel; the flag is device-only', () => {
  const kck = HTML.match(/else if\(a=='kck'\)\{[^\n]*/)?.[0] ?? '';
  assert.ok(kck.includes('SAMPLE.answer.write('), 'kck');
  const kcc = HTML.match(/else if\(a=='kcc'\)\{[^\n]*/)?.[0] ?? '';
  assert.ok(kcc.includes("CF='clr'") && !kcc.includes('clearAll') && !kcc.includes('remove('), 'kcc only opens the panel');
  const toRecs = HTML.slice(HTML.indexOf('function toRecs()'), HTML.indexOf('function rebuild()'));
  assert.ok(!toRecs.includes('mt1sq') && !toRecs.includes('KEY'), 'never synced');
});
