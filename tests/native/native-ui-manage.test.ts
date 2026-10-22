import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isManageDraftDirty, isRuleDraftDirty, type ManageDraft } from '../../native/src/manageDirty.ts';

const src = (f: string) => fs.readFileSync(`native/src/${f}`, 'utf8');

const rule = {
  id: 'a',
  type: 'expense',
  amount: '',
  description: '',
  accountId: 'x',
  categoryId: 'y',
  frequency: 'monthly',
  interval: '1',
  start: '2026-11-01',
} as const;
const draft: ManageDraft = {
  kind: 'account',
  account: { name: 'BPI', type: 'bank', short: 'bpi', opening: '100' },
  catName: '',
  catType: 'expense',
};

test('rule draft: untouched form is not dirty, even with a different request id', () => {
  assert.equal(isRuleDraftDirty(rule, { ...rule }), false);
  assert.equal(isRuleDraftDirty(rule, { ...rule, id: 'b' }), false);
});

test('rule draft: typing in any field makes it dirty', () => {
  assert.equal(isRuleDraftDirty(rule, { ...rule, amount: '15000' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, description: 'Rent' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, frequency: 'weekly' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, interval: '2' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, start: '2026-12-01' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, type: 'income' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, accountId: 'z' }), true);
  assert.equal(isRuleDraftDirty(rule, { ...rule, categoryId: 'q' }), true);
});

test('rule draft: typing then clearing back is not dirty; only spaces added is not dirty', () => {
  assert.equal(isRuleDraftDirty(rule, { ...rule, description: '   ' }), false);
  assert.equal(isRuleDraftDirty({ ...rule, description: 'Rent' }, { ...rule, description: 'Rent' }), false);
});

test('manage draft: unchanged is clean, any changed field is dirty', () => {
  assert.equal(isManageDraftDirty(draft, { ...draft }), false);
  assert.equal(isManageDraftDirty(draft, { ...draft, account: { ...draft.account, name: 'BDO' } }), true);
  assert.equal(isManageDraftDirty(draft, { ...draft, account: { ...draft.account, type: 'cash' } }), true);
  assert.equal(isManageDraftDirty(draft, { ...draft, account: { ...draft.account, short: '' } }), true);
  assert.equal(isManageDraftDirty(draft, { ...draft, account: { ...draft.account, opening: '5' } }), true);
});

test('manage draft: category name or type changes are dirty; trailing spaces are not', () => {
  const cat: ManageDraft = { ...draft, kind: 'category', catName: 'Pets' };
  assert.equal(isManageDraftDirty(cat, { ...cat }), false);
  assert.equal(isManageDraftDirty(cat, { ...cat, catName: 'Pets ' }), false);
  assert.equal(isManageDraftDirty(cat, { ...cat, catName: 'Pet' }), true);
  assert.equal(isManageDraftDirty(cat, { ...cat, catType: 'income' }), true);
});

test('manage draft: account fields do not count while editing a category (and the reverse)', () => {
  const cat: ManageDraft = { ...draft, kind: 'category', catName: 'Pets' };
  assert.equal(isManageDraftDirty(cat, { ...cat, account: { ...cat.account, name: 'ignored' } }), false);
  assert.equal(isManageDraftDirty(draft, { ...draft, catName: 'ignored' }), false);
});

test('Recurring: Sheet gets dirty + onSave, Save rule is in the pinned footer, delete is danger and names the rule', () => {
  const t = src('Recurring.tsx');
  assert.match(t, /isRuleDraftDirty/);
  assert.match(t, /<Sheet[^>]*dirty=/);
  assert.match(t, /<Sheet[^>]*onSave=/);
  assert.match(t, /footer=/);
  const footer = t.slice(t.indexOf('footer='));
  assert.match(footer.slice(0, 400), /Save rule/);
  const content = t.slice(t.indexOf('{adding && ('));
  assert.doesNotMatch(content.slice(0, content.indexOf('</Sheet>')), /label="Save rule"/);
  assert.match(t, /<Btn[^>]*danger/);
  assert.match(t, /Delete rule: \$\{/);
  assert.match(t, /Rule saved/);
  assert.match(t, /useToastMessage\(/);
  // saving from the unsaved prompt must not close the sheet (that would hide the pop-out): onSave always resolves false
  assert.match(t, /onSave=\{saveFromPrompt\}/);
  assert.match(t, /async function saveFromPrompt\(\)[^}]*await save\(\);[^}]*return false;/s);
  assert.match(t, /Deleted/);
});

test('Manage: header Close and back ask Save / Discard / Keep editing when dirty', () => {
  const t = src('Manage.tsx');
  assert.match(t, /isManageDraftDirty/);
  assert.match(t, /Alert\.alert\(UNSAVED_TITLE, UNSAVED_TEXT_ANY, unsavedButtons\(\{ onClose: leave, onSave/);
  assert.doesNotMatch(t, /BackHandler/); // the host Modal takes the back press; the inner Sheet guards itself
  assert.match(t, /<HeaderClose label="Close" onPress=\{onClose\}/);
  assert.match(t, /from '\.\/unsaved'/);
  assert.match(t, /UNSAVED_TITLE/);
});

test('Manage: Save changes is pinned (Sheet footer), toasts name what happened, controls are 48 tall', () => {
  const t = src('Manage.tsx');
  assert.match(t, /footer=\{/);
  const footer = t.slice(t.indexOf('footer={'));
  assert.match(footer.slice(0, 300), /Save changes/);
  assert.match(t, /<Sheet[^>]*dirty=/);
  assert.doesNotMatch(t, /useToast\(/); // Manage is inside a Modal: the app-wide card would sit behind it
  assert.match(t, /useToastMessage\(/);
  assert.match(t, /<LocalToast message=\{toastMsg\} \/>/);
  assert.match(t, /showToast\(/);
  assert.match(t, /minHeight: TOUCH/);
  assert.doesNotMatch(t, /minHeight: 48/);
});

test('files stay under 400 lines', () => {
  for (const f of ['Manage.tsx', 'Recurring.tsx', 'manageDirty.ts']) assert.ok(src(f).split('\n').length < 400, f);
});
