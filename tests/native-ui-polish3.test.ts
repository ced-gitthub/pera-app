import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDraftStore, nameIsDirty, UNSAVED_NAME_LINE } from '../native/src/settingsDirty.ts';

const src = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

test('draft store: set/get/clear per saved name', () => {
  const d = createDraftStore();
  assert.equal(d.get('Ced'), undefined);
  d.set('Ced', 'Cedric');
  assert.equal(d.get('Ced'), 'Cedric');
  assert.equal(d.get('Other'), undefined);
  d.clear('Ced');
  assert.equal(d.get('Ced'), undefined);
});

test('draft store: typing back the saved value leaves no draft', () => {
  const d = createDraftStore();
  d.set('Ced', 'Cedr');
  d.set('Ced', 'Ced');
  assert.equal(d.get('Ced'), undefined);
});

test('nameIsDirty ignores spaces at the ends', () => {
  assert.equal(nameIsDirty('Ced ', 'Ced'), false);
  assert.equal(nameIsDirty('Cedric', 'Ced'), true);
  assert.equal(nameIsDirty('', 'Ced'), true);
});

test('Settings restores the draft, shows the unsaved line and clears it on save', () => {
  const a = src('Settings.tsx');
  assert.ok(UNSAVED_NAME_LINE.length > 0);
  assert.match(a, /nameDrafts\.get\(name\)/);
  assert.match(a, /nameDrafts\.set\(/);
  assert.match(a, /nameDrafts\.clear\(/);
  assert.match(a, /UNSAVED_NAME_LINE/);
  assert.match(a, /nameIsDirty\(nm, lastName\.current\)/);
});

test('DeleteAccount resets the typed word and error when the sheet opens or closes', () => {
  const a = src('DeleteAccount.tsx');
  assert.match(a, /useEffect\(\(\) => \{[\s\S]*setTyped\(''\)[\s\S]*setErr\(''\)[\s\S]*\}, \[open\]\)/);
  assert.match(a, /unconfirmed\.current = false/);
});

test('small targets are at least TOUCH, from the token', () => {
  const e = src('EntrySheet.tsx');
  assert.doesNotMatch(e, /minHeight: 44/);
  assert.equal((e.match(/minHeight: TOUCH/g) ?? []).length, 2);
  assert.match(e, /import \{[^}]*\bTOUCH\b[^}]*\} from '\.\/ui'/);
  const p = src('AvatarPicker.tsx');
  assert.match(p, /import \{[^}]*\bTOUCH\b[^}]*\} from '\.\/ui'/);
  assert.doesNotMatch(p, /width: e\.s,\s*height: e\.s/);
  assert.equal((p.match(/minWidth: TOUCH/g) ?? []).length, 2);
  assert.equal((p.match(/minHeight: TOUCH/g) ?? []).length, 2);
  const l = src('Login.tsx');
  assert.match(l, /<Pressable accessibilityRole="button" onPress=\{\(\) => setSent\(false\)\}[^>]*minHeight: TOUCH/);
  assert.match(l, /import \{[^}]*\bTOUCH\b[^}]*\} from '\.\/ui'/);
});
