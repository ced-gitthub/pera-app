import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pinnedLabel } from '../native/src/wizardPinned.ts';

const read = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

test('pinned action per step: balance/budget/goal pin their button; first has its own Save; tour pins nothing', () => {
  assert.equal(pinnedLabel('balance', false), 'Save balances');
  assert.equal(pinnedLabel('budget', false), 'Set budget');
  assert.equal(pinnedLabel('goal', false), 'Add goal');
  assert.equal(pinnedLabel('first', false), null);
  for (const st of ['first', 'balance', 'budget', 'goal'] as const) assert.equal(pinnedLabel(st, true), null);
});

test('setup chips are at least 48 px tall (TOUCH) with centred content', () => {
  const src = read('WizardAction.tsx');
  const chip = src.slice(src.indexOf('const chip ='), src.indexOf('const chip =') + 900);
  assert.match(src, /import \{[^}]*\bTOUCH\b[^}]*\} from '\.\/ui'/);
  assert.match(chip, /minHeight: TOUCH/);
  assert.match(chip, /justifyContent: 'center'/);
});

test('the primary buttons are rendered in the pinned footer, not in the scrolling body', () => {
  const src = read('WizardAction.tsx');
  const body = src.slice(src.indexOf('const body ='), src.indexOf('const footer ='));
  for (const label of ['Save balances', 'Set budget', 'Add goal']) {
    assert.ok(!body.includes(`label="${label}"`), `${label} must not be in the scrolling body`);
  }
  const footer = src.slice(src.indexOf('const footer ='));
  assert.match(src, /pinnedLabel[(]step, tour[)]/);
  assert.match(footer, /label === 'Save balances'/);
  assert.match(footer, /Save balances/);
  assert.match(footer, /Set budget/);
  assert.match(footer, /Add goal/);
});

test('Wizard renders the footer outside the ScrollView, keeps Log out and the finishing guard, and is under 400 lines', () => {
  const w = read('Wizard.tsx');
  assert.ok(w.indexOf('</ScrollView>') < w.indexOf('act.footer'), 'footer after the ScrollView');
  assert.match(w, /Log out/);
  assert.match(w, /if \(finishing\) return/);
  assert.match(w, /Open my Zovix/);
  assert.ok(w.split('\n').length < 400);
  assert.ok(read('WizardAction.tsx').split('\n').length < 400);
});
