import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The app remembers visited screens in the browser for 30 s (next.config.mjs staleTimes). That is only safe because every action that changes data or the session
// calls done() (revalidatePath), which wipes that memory. These tests keep both halves honest.
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
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
  const files = ['auth', 'emailcode', 'accounts', 'budgets', 'transactions', 'imports', 'customize', 'backup', 'assistant', 'goals'];
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
  assert.doesNotMatch(read('src/components/entries/TxRow.tsx'), /Changed your mind/);
});
test('Content-Security-Policy form-action allows the Google sign-in redirect chain and nothing broader', () => {
  const m = read('next.config.mjs').match(/form-action ('self'[^;"]*)/);
  assert.ok(m, 'form-action is set');
  const origins = m[1].trim().split(/\s+/).sort();
  assert.deepEqual(origins, ["'self'", 'https://accounts.google.com', 'https://vxhgkkzbmrhxayzryake.supabase.co'].sort());
});
test('login page: no standing advice; errors appear right above the form and are highlighted', () => {
  const login = read('src/app/(auth)/login/page.tsx');
  assert.ok(login.indexOf('<GoogleButton />') < login.indexOf('<Flash '), 'error message sits below the Google button, above the form');
  assert.ok(login.indexOf('<Flash ') < login.indexOf('<form action={signIn}'));
  const hint = read('src/components/auth/HideInIosApp.tsx');
  assert.match(hint, /\{blocked && \(/, 'the iPhone-app explanation shows only after the Google button is tapped');
  assert.match(read('src/app/globals.css'), /\.flash\.bad,\s*\.flash\.good \{[^}]*border-left/);
});
test('auth links are built from the pinned site address, never from the project production domain', () => {
  const s = read('src/app/actions/shared.ts');
  assert.match(s, /NEXT_PUBLIC_SITE_URL/);
});
test('a pending Undo is forgotten when the app layout unmounts (logout), so the next user never sees it', () => {
  assert.match(read('src/components/ui/UndoBar.tsx'), /useEffect\(\(\) => \(\) => clearUndo\(\), \[\]\)/);
});
test('the install card is offered on the dashboard and settings, and handles the browser install prompt', () => {
  const card = read('src/components/app/InstallApp.tsx');
  assert.match(card, /beforeinstallprompt/);
  assert.match(card, /display-mode: standalone/, 'hidden once Zovix is already installed');
  assert.match(card, /Add to Home Screen/, 'iPhone instructions');
  assert.ok(card.includes('/zovix.apk'), 'Android app download');
  for (const f of ['src/app/(app)/settings/page.tsx', 'src/app/(app)/(dash)/page.tsx']) assert.match(read(f), /<InstallApp/, f);
});
test('settings no longer shows the developer-only cards (prototype migration, AI configuration)', () => {
  const s = read('src/app/(app)/settings/page.tsx');
  assert.doesNotMatch(s, /Migrate prototype data|AI configuration/);
});
