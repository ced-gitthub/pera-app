// Item 4 (AC-34..40): the unsaved-changes prompt. Core logic only; the screen wiring is in artifact-unsaved-ui.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { slice, J, type St } from './artifact-undo-kit.ts';

type Form = { initial: St; current: St; save(): boolean; discard(): void };
type Guard = { nav(fn: () => void): string; choose(c: string): string; open(): boolean };
type Un = {
  TITLE: string;
  TEXT: string;
  KEEP: string;
  DISCARD: string;
  SAVE: string;
  buttons(): string[];
  normMoney(s: string): string;
  snap(f: St, money?: string[]): St;
  isDirty(a: St, b: St): boolean;
  onClose(dirty: boolean): string;
  guard(env: { form(): Form | null; ask(): void; close(): void }): Guard;
};
const UN = vm.runInNewContext(`${slice('UNSAVEDCORE')};UNSAVED`) as Un;

test('AC-34 words and order match the native sheet', () => {
  assert.equal(UN.TITLE, 'Save your changes?');
  assert.equal(UN.TEXT, 'You changed something but have not saved it yet.');
  assert.deepEqual(J(UN.buttons()), ['Keep editing', 'Discard', 'Save']);
  assert.equal(UN.KEEP, 'Keep editing');
  assert.equal(UN.DISCARD, 'Discard');
  assert.equal(UN.SAVE, 'Save');
});

test('onClose: a clean form closes, a changed form asks', () => {
  assert.equal(UN.onClose(false), 'close');
  assert.equal(UN.onClose(true), 'ask');
});

test('AC-35 money is compared as text without floats: 5 equals 5.00, -0 equals 0, commas ignored', () => {
  assert.equal(UN.normMoney('5'), '5.00');
  assert.equal(UN.normMoney('5.0'), '5.00');
  assert.equal(UN.normMoney('5.00'), '5.00');
  assert.equal(UN.normMoney('005.5'), '5.50');
  assert.equal(UN.normMoney('-0'), '0.00');
  assert.equal(UN.normMoney('-0.00'), '0.00');
  assert.equal(UN.normMoney('-5'), '-5.00');
  assert.equal(UN.normMoney('1,250.5'), '1250.50');
  assert.equal(UN.normMoney('.5'), '0.50');
  assert.equal(UN.normMoney(''), '');
  assert.equal(UN.normMoney('  7 '), '7.00');
  assert.equal(UN.normMoney('abc'), 'abc');
  assert.equal(UN.normMoney('1e5'), '1e5');
  assert.equal(UN.normMoney('0.1234'), '0.1234', 'more than 2 decimals is kept as typed so a change shows');
  assert.equal(UN.normMoney('99999999999.99'), '99999999999.99', 'no float rounding on big values');
});

test('AC-35 snap trims text and normalises only the named money fields', () => {
  const s = UN.snap({ d: '  hi ', a: '5', n: '5' }, ['a']);
  assert.deepEqual(J(s), { d: 'hi', a: '5.00', n: '5' });
  assert.deepEqual(J(UN.snap({ x: 3, y: true })), { x: 3, y: true });
});

test('AC-35 isDirty: equal after trimming and money normalising is clean; any real change is dirty', () => {
  const a = UN.snap({ s: 'Lunch', a: '120' }, ['a']);
  assert.equal(UN.isDirty(a, UN.snap({ s: ' Lunch ', a: '120.00' }, ['a'])), false);
  assert.equal(UN.isDirty(a, UN.snap({ s: 'Lunch!', a: '120' }, ['a'])), true);
  assert.equal(UN.isDirty(a, UN.snap({ s: 'Lunch', a: '120.01' }, ['a'])), true);
  assert.equal(UN.isDirty(a, UN.snap({ s: 'Lunch' }, ['a'])), true, 'a missing key is a change');
  assert.equal(UN.isDirty(UN.snap({ s: 'Lunch' }), a), true, 'an extra key is a change');
  assert.equal(UN.isDirty({}, {}), false);
  assert.equal(UN.isDirty(a, a), false);
});

const make = (o: { dirty?: boolean; save?: () => boolean; discard?: () => void; form?: () => Form | null } = {}) => {
  const log: string[] = [];
  const f: Form = {
    initial: { a: '1' },
    current: { a: o.dirty === false ? '1' : '2' },
    save: () => {
      log.push('save');
      return o.save ? o.save() : true;
    },
    discard: () => {
      log.push('discard');
      if (o.discard) o.discard();
    },
  };
  const g = UN.guard({
    form: o.form ?? (() => f),
    ask: () => log.push('ask'),
    close: () => log.push('close'),
  });
  return { g, log, run: () => log.push('went') };
};

test('AC-36 nav: a clean form just goes', () => {
  const t = make({ dirty: false });
  assert.equal(t.g.nav(t.run), 'run');
  assert.deepEqual(t.log, ['went']);
  assert.equal(t.g.open(), false);
});

test('AC-36 nav: no form at all just goes', () => {
  const t = make({ form: () => null });
  assert.equal(t.g.nav(t.run), 'run');
  assert.deepEqual(t.log, ['went']);
});

test('AC-36 nav: if the form cannot be read the app does not trap the user', () => {
  const t = make({
    form: () => {
      throw new Error('dom');
    },
  });
  assert.equal(t.g.nav(t.run), 'run');
  assert.deepEqual(t.log, ['went']);
});

test('AC-36 nav: a changed form asks and does not go yet', () => {
  const t = make();
  assert.equal(t.g.nav(t.run), 'ask');
  assert.deepEqual(t.log, ['ask']);
  assert.equal(t.g.open(), true);
});

test('AC-37 Keep editing: stay, nothing saved, nothing lost, the move is forgotten', () => {
  const t = make();
  t.g.nav(t.run);
  assert.equal(t.g.choose('keep'), 'keep');
  assert.deepEqual(t.log, ['ask', 'close']);
  assert.equal(t.g.open(), false);
  assert.equal(t.g.choose('discard'), 'none', 'a stale tap on a closed sheet does nothing');
  assert.deepEqual(t.log, ['ask', 'close']);
});

test('AC-38 Discard: drops the changes, then goes where the user was going', () => {
  const t = make();
  t.g.nav(t.run);
  assert.equal(t.g.choose('discard'), 'discard');
  assert.deepEqual(t.log, ['ask', 'discard', 'close', 'went']);
});

test('AC-38 Discard always works, even when save is broken', () => {
  const t = make({
    save: () => {
      throw new Error('quota');
    },
  });
  t.g.nav(t.run);
  assert.equal(t.g.choose('discard'), 'discard');
  assert.deepEqual(t.log, ['ask', 'discard', 'close', 'went']);
});

test('AC-38 Discard always works, even when the form helper throws while discarding', () => {
  const t = make({
    discard: () => {
      throw new Error('dom gone');
    },
  });
  t.g.nav(t.run);
  assert.equal(t.g.choose('discard'), 'discard');
  assert.ok(t.log.includes('went'), 'the move still happens');
  assert.equal(t.g.open(), false);
});

test('AC-39 Save: saves, then goes', () => {
  const t = make();
  t.g.nav(t.run);
  assert.equal(t.g.choose('save'), 'saved');
  assert.deepEqual(t.log, ['ask', 'save', 'close', 'went']);
});

test('AC-39 Save that fails: the user stays on the form, nothing is lost, the move is dropped', () => {
  const t = make({ save: () => false });
  t.g.nav(t.run);
  assert.equal(t.g.choose('save'), 'failed');
  assert.deepEqual(t.log, ['ask', 'save', 'close']);
  assert.equal(t.g.open(), false);
});

test('AC-39 Save that throws is the same as failing', () => {
  const t = make({
    save: () => {
      throw new Error('x');
    },
  });
  t.g.nav(t.run);
  assert.equal(t.g.choose('save'), 'failed');
  assert.ok(!t.log.includes('went'));
  assert.equal(t.g.open(), false);
});

test('AC-40 a second move while the sheet is open does not replace the first or stack sheets', () => {
  const t = make();
  const other: string[] = [];
  t.g.nav(t.run);
  assert.equal(
    t.g.nav(() => other.push('second')),
    'ask',
  );
  assert.equal(t.log.filter((x) => x === 'ask').length, 1, 'one sheet');
  t.g.choose('discard');
  assert.ok(t.log.includes('went'));
  assert.deepEqual(other, [], 'first move wins');
});

test('AC-40 choosing twice quickly runs the move once', () => {
  const t = make();
  t.g.nav(t.run);
  t.g.choose('save');
  assert.equal(t.g.choose('save'), 'none');
  assert.equal(t.log.filter((x) => x === 'went').length, 1);
  assert.equal(t.log.filter((x) => x === 'save').length, 1);
});

test('an unknown choice is treated as Keep editing, never as a silent discard or save', () => {
  const t = make();
  t.g.nav(t.run);
  assert.equal(t.g.choose('whatever'), 'keep');
  assert.ok(!t.log.includes('discard') && !t.log.includes('save') && !t.log.includes('went'));
});
