import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The app remembers visited screens in the browser for 30 s (next.config.mjs staleTimes). That is only safe because every action that changes data or the session
// calls done() (revalidatePath), which wipes that memory. These tests keep both halves honest.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('screen memory is capped at 30 seconds', () => {
  const m = read('next.config.mjs').match(/staleTimes:\s*\{\s*dynamic:\s*(\d+)/);
  assert.ok(m, 'staleTimes.dynamic is set');
  assert.ok(Number(m[1]) <= 30, `dynamic staleTime ${m[1]} must not exceed 30`);
});
// Actions that change nothing visible (or only send an email / start a flow) and so need no refresh.
const READ_ONLY = new Set([
  'askAssistant',
  'parseServer',
  'mfaStart',
  'sendLoginCode',
  'requestReset',
  'resendVerification',
  'requestResetViaBackup',
  'backupStart',
  'signInWithGoogle',
  'signOutOthers',
  'changePassword',
]);
test('every action that changes data or the session refreshes remembered screens', () => {
  const files = ['auth', 'emailcode', 'accounts', 'budgets', 'transactions', 'imports', 'customize', 'backup', 'assistant'];
  const missing: string[] = [];
  let seen = 0;
  for (const f of files) {
    const src = read(`src/app/actions/${f}.ts`);
    const parts = src.split(/^export async function /m).slice(1);
    for (const p of parts) {
      const name = p.match(/^(\w+)/)![1];
      seen++;
      if (READ_ONLY.has(name)) continue;
      if (!/\bdone\(\)|revalidatePath\(/.test(p)) missing.push(`${f}.${name}`);
    }
  }
  assert.ok(seen > 40, `scanned ${seen} actions`);
  assert.deepEqual(missing, [], 'these actions change data but never call done()/revalidatePath()');
});
test('deleting a transaction refreshes the list and the Undo notice lives in the layout', () => {
  const del = read('src/app/actions/transactions.ts').split('export async function deleteTx')[1].split('export async function')[0];
  assert.match(del, /\bdone\(\)/);
  assert.match(read('src/app/(app)/layout.tsx'), /<UndoBar \/>/);
  assert.doesNotMatch(read('src/components/TxRow.tsx'), /Changed your mind/);
});
test('the Android app reloads the login page when you come back from Google in Chrome', () => {
  const s = read('src/components/HideInIosApp.tsx');
  assert.match(s, /visibilitychange/);
  assert.match(s, /window\.location\.reload\(\)/);
  assert.match(s, /android-app:\/\//);
});
test('a pending Undo is forgotten when the app layout unmounts (logout), so the next user never sees it', () => {
  assert.match(read('src/components/UndoBar.tsx'), /useEffect\(\(\) => \(\) => clearUndo\(\), \[\]\)/);
});
