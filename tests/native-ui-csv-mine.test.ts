import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { csvDirty, importedToast, seenUid } from '../native/src/csvMineLogic.ts';

const src = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

test('csvDirty: pasted text that is not imported is unsaved; blank text is not', () => {
  assert.equal(csvDirty(''), false);
  assert.equal(csvDirty('  \n '), false);
  assert.equal(csvDirty('date,type'), true);
});

test('importedToast: plural aware with thousands separators', () => {
  assert.equal(importedToast(1), 'Imported 1 entry');
  assert.equal(importedToast(2), 'Imported 2 entries');
  assert.equal(importedToast(1200), 'Imported 1,200 entries');
});

test('seenUid: uses the loaded profile, else the local session, else nothing', () => {
  assert.equal(seenUid('a', 'b'), 'a');
  assert.equal(seenUid(undefined, 'b'), 'b');
  assert.equal(seenUid(undefined, undefined), null);
});

test('Csv: dirty guard, pinned import button, toast, flexible date inputs', () => {
  const f = src('Csv.tsx');
  assert.match(f, /dirty=\{csvDirty\(text\)\}/);
  assert.match(f, /footer=/);
  assert.match(f, /toast\(importedToast\(/);
  assert.match(f, /useToast/);
  assert.match(f, /flexWrap: 'wrap'/);
  assert.doesNotMatch(f, /minWidth: \d|width: \d/);
});

test('MakeItYours: pinned header + footer, unsaved prompt, toast, always marked seen', () => {
  const f = src('MakeItYours.tsx');
  assert.match(f, /HeaderClose label="Maybe later"/);
  assert.match(f, /Alert\.alert\(UNSAVED_TITLE, UNSAVED_TEXT_ANY, unsavedButtons\(/);
  assert.match(f, /isProfileDirty\(/);
  assert.match(f, /toast\(PROFILE_SAVED_TOAST\)/);
  assert.match(f, /markMakeItYoursSeen\(/);
  assert.match(f, /seenUid\(/);
  assert.doesNotMatch(f, /if \(state\) await markMakeItYoursSeen/);
  // the primary button is outside the ScrollView
  assert.ok(f.indexOf('</ScrollView>') < f.indexOf('label="Looks good"'));
});
