import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shouldAskAboutExistingData, JUST_SIGNED_UP_KEY, EXISTING_DATA_TEXT } from '../native/src/freshLogic.ts';

const none = { totalEntries: 0, budgetsCount: 0, goalsCount: 0 };

test('after a sign-up, existing data is ASKED about, never deleted silently', () => {
  assert.equal(shouldAskAboutExistingData(true, { ...none, totalEntries: 3 }), true);
  assert.equal(shouldAskAboutExistingData(true, { ...none, budgetsCount: 1 }), true);
  assert.equal(shouldAskAboutExistingData(true, { ...none, goalsCount: 2 }), true);
});

test('a truly new account has nothing to ask about, and a plain sign-in or unreadable counts never ask', () => {
  assert.equal(shouldAskAboutExistingData(true, none), false);
  assert.equal(shouldAskAboutExistingData(false, { ...none, totalEntries: 50 }), false); // signed in, not signed up
  assert.equal(shouldAskAboutExistingData(true, null), false); // counts could not be read: do nothing
  assert.equal(JUST_SIGNED_UP_KEY, 'zv_just_signed_up');
});

test('the prompt says what was found, offers keep and start fresh, and that nothing happens until the owner chooses', () => {
  assert.match(EXISTING_DATA_TEXT, /already has/i);
  assert.match(EXISTING_DATA_TEXT, /keep/i);
  assert.match(EXISTING_DATA_TEXT, /start fresh/i);
  assert.match(EXISTING_DATA_TEXT, /nothing (has been|was) deleted/i);
});

test('there is no automatic delete left in the sign-up path', () => {
  for (const f of ['fresh.ts', 'Login.tsx', 'Gate.tsx']) {
    const src = fs.readFileSync(`native/src/${f}`, 'utf8');
    assert.doesNotMatch(src, /cleanNewAccount|cleanIfNewlySignedUp/, f);
  }
  assert.equal(fs.existsSync('native/src/freshCore.ts'), false);
});

test('the sign-up flag is taken exactly once: removed before anything else can use it', () => {
  const src = fs.readFileSync('native/src/fresh.ts', 'utf8');
  assert.match(src, /removeItem\(JUST_SIGNED_UP_KEY\)/);
  assert.match(src, /takeSignUpFlag/);
});

import { flagValueFor, flagMatches } from '../native/src/freshLogic.ts';
test('the sign-up flag belongs to one email, so a leftover flag can never fire for another account', () => {
  const v = flagValueFor(' Ced@Example.COM ');
  assert.equal(flagMatches(v, 'ced@example.com'), true);
  assert.equal(flagMatches(v, 'other@example.com'), false);
  assert.equal(flagMatches(null, 'ced@example.com'), false);
  assert.equal(flagMatches('1', 'ced@example.com'), false); // the old flag format is ignored
  assert.equal(flagMatches(v, ''), false);
});

test('Gate really renders the existing-data prompt and the typed-DELETE sheet, and holds the tour back while asking', () => {
  const src = fs.readFileSync('native/src/Gate.tsx', 'utf8');
  assert.match(src, /<ExistingDataPrompt/);
  assert.match(src, /<ResetData/);
  assert.match(src, /ask/);
  assert.ok(src.includes('|| ask) return'), 'the tab tour must wait while the question is open');
});

test('signing out forgets a pending sign-up flag', () => {
  assert.match(fs.readFileSync('native/src/signout.ts', 'utf8'), /JUST_SIGNED_UP_KEY/);
});

test('the live delete-account group no longer skips on 404 (a 404 after deploy means the route is broken)', () => {
  const src = fs.readFileSync('tests/prod/security.mjs', 'utf8');
  assert.doesNotMatch(src, /SKIPPED \(endpoint not deployed/);
});

test('the new native dependency is pinned exactly', () => {
  const pkg = JSON.parse(fs.readFileSync('native/package.json', 'utf8'));
  assert.equal(pkg.dependencies['expo-alternate-app-icons'], '8.0.0');
});
