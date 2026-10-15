// Words shared with the native app must match native's source text exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { slice } from './artifact-undo-kit.ts';

const nat = (f: string) => fs.readFileSync(new URL(`../native/src/${f}`, import.meta.url), 'utf8');
const NATIVE = [
  'logic.ts',
  'manageLogic.ts',
  'EntrySheet.tsx',
  'Home.tsx',
  'Planning.tsx',
  'Recurring.tsx',
  'TabTour.tsx',
  'SampleSheets.tsx',
]
  .map(nat)
  .join('\n');

const LIM = vm.runInNewContext(`${slice('CSVCORE')};${slice('LIMITSCORE')};LIM`) as { MSG: Record<string, string> };
const TOAST = vm.runInNewContext(`${slice('TOASTCORE')};TOAST`) as { TEXT: Record<string, string> };
const INTRO = vm.runInNewContext(`${slice('INTROCORE')};INTRO`) as { OFFER_TITLE: string };

// Artifact-only wording: the native app has no such text (or words it differently). Keep this list short and explained.
const ARTIFACT_ONLY = new Set<string>([
  'Starting balances saved', // native saves balances on a sheet with its own wording
  'Account saved',
  'Rule deleted',
  'Amount must be at least 0.01', // quick-add messages, native has no quick-add box
  'Amount too large',
]);

test('validation messages are word for word the native ones', () => {
  for (const k of ['AMOUNT', 'DATE', 'BUDGET', 'OPENING']) assert.ok(NATIVE.includes(`'${LIM.MSG[k]}'`), k);
});

test('toast words that native also uses match it', () => {
  for (const [k, v] of Object.entries(TOAST.TEXT)) {
    if (ARTIFACT_ONLY.has(v)) continue;
    assert.ok(NATIVE.includes(`'${v}'`), `${k}: ${v}`);
  }
});

test('the allow-list only holds words that really are missing from native', () => {
  for (const w of ['Starting balances saved', 'Rule deleted']) assert.ok(!NATIVE.includes(`'${w}'`), w);
});

test('the tour offer title is native wording', () => {
  assert.ok(NATIVE.includes(INTRO.OFFER_TITLE));
});
