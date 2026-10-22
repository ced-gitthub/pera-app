import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoDismissMs, UNDO_MS } from '../../native/src/entriesLogic.ts';

test('undo bar: auto-dismisses after UNDO_MS, but never while an error is showing', () => {
  assert.equal(autoDismissMs(undefined), UNDO_MS);
  assert.equal(autoDismissMs(''), UNDO_MS);
  assert.equal(autoDismissMs('Could not bring it back. Try again.'), null);
});

const src = readFileSync(new URL('../../native/src/EntrySheet.tsx', import.meta.url), 'utf8');
const bar = src.slice(src.indexOf('export function UndoBar'));

test('undo bar: takes error and lift props, shows the error in the down colour, keeps Undo', () => {
  assert.match(bar, /error\?: string/);
  assert.match(bar, /lift\?: number/);
  assert.match(bar, /c\.down/);
  assert.match(bar, /autoDismissMs\(error\)/);
  assert.match(bar, /accessibilityLabel="Undo"/);
  assert.match(bar, /bottom: bottom \+ lift \+ sp\.l/);
});
