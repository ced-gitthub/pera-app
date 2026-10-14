import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isEntryDirty } from '../native/src/entryDirty.ts';

const src = (f: string) => readFileSync(new URL(`../native/src/${f}`, import.meta.url), 'utf8');
const base = {
  type: 'expense' as const,
  amount: '150',
  date: '2026-10-14',
  description: 'lunch',
  accountId: 'a1',
  toId: '',
  categoryId: 'c1',
};

test('isEntryDirty: identical forms are clean', () => {
  assert.equal(isEntryDirty(base, { ...base }), false);
});
test('isEntryDirty: each field change is dirty', () => {
  for (const patch of [
    { type: 'income' as const },
    { amount: '151' },
    { date: '2026-10-15' },
    { description: 'dinner' },
    { accountId: 'a2' },
    { categoryId: 'c2' },
    { toId: 'a2' },
  ])
    assert.equal(isEntryDirty(base, { ...base, ...patch }), true, JSON.stringify(patch));
});
test('isEntryDirty: surrounding spaces are not a change', () => {
  assert.equal(isEntryDirty(base, { ...base, amount: ' 150 ', description: 'lunch  ', date: ' 2026-10-14' }), false);
});
test('isEntryDirty: changing back to the original is clean again', () => {
  assert.equal(isEntryDirty(base, { ...base, amount: '200' }), true);
  assert.equal(isEntryDirty(base, { ...base, amount: '150' }), false);
});
test('isEntryDirty: no form loaded is clean', () => {
  assert.equal(isEntryDirty(null, base), false);
  assert.equal(isEntryDirty(base, null), false);
});

test('EntrySheet wires dirty, onSave, a pinned footer and toasts', () => {
  const s = src('EntrySheet.tsx');
  assert.match(s, /isEntryDirty\(/);
  assert.match(s, /dirty=\{/);
  assert.match(s, /onSave=\{/);
  const footer = s.match(/footer=\{([\s\S]*?)\n\s*\}\n?\s*(?:toast|dirty|onSave|>)/);
  assert.ok(s.includes('footer='), 'footer prop');
  assert.ok(footer && /Save changes/.test(footer[1]) && /Save entry/.test(footer[1]), 'Save button is in the footer');
  assert.match(s, /toast\('Entry saved'\)/);
  assert.match(s, /toast\('Entry deleted'\)/);
  assert.match(s, /return true/);
});
test('Home uses the shared Sheet for Quick Add, with dirty and a toast', () => {
  const h = src('Home.tsx');
  assert.doesNotMatch(h, /<Modal/);
  assert.match(h, /<Sheet[\s\S]*title="What did you spend or earn\?"/);
  assert.match(h, /dirty=\{/);
  assert.match(h, /onDirtyChange=\{/);
  assert.match(h, /toast\('Entry saved'\)/);
  assert.match(h, /setPop\(Date\.now\(\)\)/);
});
test('Home Edit chip and See all accounts are 48 tall touch targets', () => {
  const h = src('Home.tsx');
  assert.equal((h.match(/minHeight: TOUCH/g) ?? []).length >= 2, true);
  assert.doesNotMatch(h, /sp\.xxl \+ sp\.l/);
  assert.match(h, /TOUCH[^}]*\} from '\.\/ui'/);
  assert.match(h, /Home settings/);
  assert.match(h, /See all accounts/);
});
test('Home returns the refresh result and shows a failed reload', () => {
  const h = src('Home.tsx');
  assert.match(h, /const problem = await refresh\(\)/);
  assert.match(h, /return problem/);
  assert.match(h, /setErr\(problem\)/);
});
test('Quick Add Save is pinned in the Sheet footer through the layout slot', () => {
  const q = src('QuickAdd.tsx');
  assert.match(q, /layout\?: \(body: ReactNode, actions: ReactNode\) => ReactNode/);
  const h = src('Home.tsx');
  assert.match(h, /layout=\{/);
  assert.match(h, /footer=\{actions\}/);
});
test('QuickAdd reports unsaved text through an optional onDirtyChange', () => {
  const q = src('QuickAdd.tsx');
  assert.match(q, /onDirtyChange\?: \(dirty: boolean\) => void/);
  assert.match(q, /onDirtyChange\?\.\(/);
});

test('Quick Add is reset BEFORE the reload finishes, so text typed while it runs is never wiped', () => {
  const h = src('Home.tsx');
  const onSaved = h.slice(h.indexOf('onSaved={async'), h.indexOf('/>', h.indexOf('onSaved={async')));
  assert.ok(onSaved.indexOf('setAddKey(') >= 0 && onSaved.indexOf('setAddKey(') < onSaved.indexOf('await refresh()'));
});
