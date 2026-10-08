'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseProbe } from '@/lib/supabase/probe';
import { backupConfigured, getBackup, getBackupRaw, saveBackup, patchBackup, clearBackup, findVerified, emailOf, recoveryToken } from '@/lib/backup';
import { sendMail } from '@/lib/mail';
import { newCode, hashCode, checkCode, nextSend, cooldownPassed, CODE_TTL_MS, MAX_ATTEMPTS } from '@/lib/backupcode';
import { passwordProblem, isPwned, isEmail, safeNext, PWNED } from '@/lib/password';
import { ctx } from '@/lib/data';
import { manilaToday, parseAmountMinor, isDate, formatMinor } from '@/core/money';
import { categoryFor, type Parsed } from '@/core/parser';
import { totals, type Tx } from '@/core/aggregate';
import { fromCsv, mapLegacy, type Row } from '@/core/io';
import { parseWithFallback, getProvider } from '@/ai/provider';
import { validateItems, parseOptionalMinor, defaultAccount } from '@/lib/validate';
import { parseQuestion } from '@/lib/assistant';
import { safeMessage, authMessage, logErr } from '@/lib/safe';
import { MAX_CSV_BYTES, MAX_CSV_LABEL } from '@/lib/limits';
import { commandOf, NOTHING_TO_UNDO } from '@/lib/commands';

function go(path: string, k: 'err' | 'ok', m: string): never { redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(m.slice(0, 200))}`); }
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const done = () => revalidatePath('/', 'layout');

// ---- auth
// Origin used inside emailed links. A pinned value wins over request headers, so a forged Host header can never point a reset link at another site.
const siteUrl = async () => { const h = await headers(), pinned = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''); return (pinned || h.get('origin') || `https://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`).replace(/\/$/, ''); };
const verifyUrl = (email: string) => '/verify' + (isEmail(email) ? `?email=${encodeURIComponent(email)}` : '');
const errCode = (e: unknown) => (e as { code?: string } | null)?.code ?? '';
const code6 = (fd: FormData) => str(fd, 'code').replace(/\s/g, '');
async function authed() { const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) redirect('/login'); return { sb, user }; }
async function needsSecondStep(sb: Awaited<ReturnType<typeof supabaseServer>>) { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2'; }
export async function signIn(fd: FormData) {
  const email = str(fd, 'email').trim(), sb = await supabaseServer(); const { error } = await sb.auth.signInWithPassword({ email, password: str(fd, 'password') });
  if (error) { if (errCode(error) === 'email_not_confirmed') go(verifyUrl(email), 'err', authMessage(error, 'signIn')); go('/login', 'err', authMessage(error, 'signIn')); }
  if (await needsSecondStep(sb)) redirect('/2fa'); redirect('/');
}
export async function signUp(fd: FormData) {
  const email = str(fd, 'email').trim(), password = str(fd, 'password');
  if (!isEmail(email)) go('/register', 'err', 'Enter a valid email address.');
  const bad = passwordProblem(password); if (bad) go('/register', 'err', bad); if (await isPwned(password)) go('/register', 'err', PWNED);
  const sb = await supabaseServer(); const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: str(fd, 'name').slice(0, 60) }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/&welcome=1` } });
  if (error) go('/register', 'err', authMessage(error, 'signUp')); if (!data.session) redirect(verifyUrl(email)); redirect('/');
}
// Sends the confirmation link again. The reply never reveals whether an address has an account.
export async function resendVerification(fd: FormData) {
  const email = str(fd, 'email').trim(); if (!isEmail(email)) go('/verify', 'err', 'Enter a valid email address.');
  const sb = await supabaseServer(); const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${await siteUrl()}/auth/callback?next=/&welcome=1` } });
  if (error && /rate_limit/.test(errCode(error))) go(verifyUrl(email), 'err', authMessage(error, 'resendVerification')); if (error) logErr('resendVerification', error);
  go(verifyUrl(email), 'ok', 'If that address is waiting for confirmation, a new link is on its way. Check your inbox and spam folder.');
}
// ---- password recovery (the reply never reveals whether an email has an account)
export async function requestReset(fd: FormData) {
  const email = str(fd, 'email').trim(); if (!isEmail(email)) go('/forgot', 'err', 'Enter a valid email address.');
  const sb = await supabaseServer(); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/callback?next=/reset` });
  if (error && /rate_limit/.test(errCode(error))) go('/forgot', 'err', authMessage(error, 'requestReset')); if (error) logErr('requestReset', error);
  go('/forgot', 'ok', 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.');
}
export async function updatePassword(fd: FormData) {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) go('/forgot', 'err', 'That link is invalid or has expired. Request a new one.');
  const p = str(fd, 'password'), c = str(fd, 'confirm'), bad = passwordProblem(p); if (bad) go('/reset', 'err', bad); if (p !== c) go('/reset', 'err', 'The two passwords do not match.'); if (await isPwned(p)) go('/reset', 'err', PWNED);
  const { error } = await sb.auth.updateUser({ password: p }); if (error) go('/reset', 'err', authMessage(error, 'updatePassword'));
  await sb.auth.signOut(); go('/login', 'ok', 'Password updated. Log in with your new password.');
}
export async function signOut() { const sb = await supabaseServer(); await sb.auth.signOut(); redirect('/login'); }

// ---- security page: change password, log out other devices, two-step verification (authenticator app)
export async function changePassword(fd: FormData) {
  const { sb, user } = await authed(), cur = str(fd, 'current'), p = str(fd, 'password'), c = str(fd, 'confirm'), bad = passwordProblem(p);
  if (bad) go('/security', 'err', bad); if (p !== c) go('/security', 'err', 'The two new passwords do not match.'); if (p === cur) go('/security', 'err', 'Choose a password different from your current one.');
  const { error: wrong } = await supabaseProbe().auth.signInWithPassword({ email: user.email ?? '', password: cur }); if (wrong) go('/security', 'err', errCode(wrong) === 'invalid_credentials' || /invalid login/i.test(String((wrong as Error).message)) ? 'Your current password is not right.' : authMessage(wrong, 'changePassword'));
  if (await isPwned(p)) go('/security', 'err', PWNED);
  const { error } = await sb.auth.updateUser({ password: p }); if (error) go('/security', 'err', authMessage(error, 'changePassword'));
  await sb.auth.signOut({ scope: 'others' }); go('/security', 'ok', 'Password changed. Every other device was logged out.');
}
export async function signOutOthers() { const { sb } = await authed(); await sb.auth.signOut({ scope: 'others' }); go('/security', 'ok', 'Every other device was logged out.'); }
export async function signOutEverywhere() { const sb = await supabaseServer(); await sb.auth.signOut({ scope: 'global' }); go('/login', 'ok', 'Logged out of every device.'); }
// Second step after the password. Only reachable with a password session; the middleware blocks everything else until this succeeds.
export async function verifyMfa(fd: FormData) {
  const next = safeNext(str(fd, 'next')), back = '/2fa' + (next === '/' ? '' : `?next=${encodeURIComponent(next)}`), { sb } = await authed(), code = code6(fd);
  if (!/^\d{6}$/.test(code)) go(back, 'err', 'Enter the 6-digit code from your authenticator app.');
  const { data: f } = await sb.auth.mfa.listFactors(), factor = f?.totp?.[0]; if (!factor) redirect(next);
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code }); if (error) go(back, 'err', authMessage(error, 'verifyMfa'));
  redirect(next);
}
// ---- backup email (recovery when the login inbox is lost). Needs SUPABASE_SECRET_KEY + SMTP_* on the server; hidden otherwise.
const BACKUP_OFF = 'Backup email is not available right now.', BACKUP_REPLY = 'If that backup email is on file, a reset link is on its way. Check your inbox and spam folder.';
const mailSafe = async (to: string, subject: string, text: string) => { try { await sendMail(to, subject, text); return true; } catch (e) { logErr('mail', e); return false; } };
export async function backupStart(fd: FormData) {
  if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  const { user } = await authed(), email = str(fd, 'email').trim().toLowerCase();
  if (!isEmail(email)) go('/security', 'err', 'Enter a valid email address.'); if (email === (user.email ?? '').toLowerCase()) go('/security', 'err', 'Use a different address than the one you log in with.');
  const { error: wrong } = await supabaseProbe().auth.signInWithPassword({ email: user.email ?? '', password: str(fd, 'current') }); if (wrong) go('/security', 'err', errCode(wrong) === 'invalid_credentials' || /invalid login/i.test(String((wrong as Error).message)) ? 'Your current password is not right.' : authMessage(wrong, 'backupStart'));
  let fail = '';
  try {
    const row = await getBackupRaw(user.id), n = nextSend(row, Date.now());
    if (!n.ok) fail = 'Too many codes. Try again in an hour.';
    else {
      const code = newCode(); await saveBackup({ user_id: user.id, email, verified_at: null, code_hash: hashCode(user.id, code), code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(), code_attempts: 0, sends_in_hour: n.sends, sends_window_start: n.start, last_recovery_at: row?.last_recovery_at ?? null });
      if (!(await mailSafe(email, 'Your Pera backup email code', `Your Pera backup email code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for this, ignore this email and nothing changes.`))) fail = 'We could not send that email. Check the address and try again.';
    }
  } catch (e) { fail = safeMessage(e, 'backupStart'); }
  if (fail) go('/security', 'err', fail); go('/security', 'ok', `We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
}
export async function backupConfirm(fd: FormData) {
  if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  const { user } = await authed(), code = code6(fd); if (!/^\d{6}$/.test(code)) go('/security', 'err', 'Enter the 6-digit code from the email.');
  let fail = '';
  try {
    const row = await getBackup(user.id), r = !row || row.verified_at ? 'gone' : checkCode(row, user.id, code, Date.now());
    if (r === 'gone') fail = 'Ask for a new code first.'; else if (r === 'none' || r === 'expired') fail = 'That code expired. Ask for a new one.'; else if (r === 'locked') fail = 'Too many wrong codes. Ask for a new one.';
    else if (r === 'wrong') { await patchBackup(user.id, { code_attempts: row!.code_attempts + 1 }); fail = row!.code_attempts + 1 >= MAX_ATTEMPTS ? 'Too many wrong codes. Ask for a new one.' : 'That code is not right.'; }
    else if (await patchBackup(user.id, { verified_at: new Date().toISOString(), code_hash: null, code_expires_at: null, code_attempts: 0 })) { await clearBackup(user.id); fail = "That address can't be used as a backup. Try another."; }
  } catch (e) { fail = safeMessage(e, 'backupConfirm'); }
  if (fail) go('/security', 'err', fail);
  if (user.email) await mailSafe(user.email, 'A backup email was added to Pera', 'A backup email address was just added to your Pera account, so you can reset your password if you lose access to this inbox.\n\nIf this was not you, log in, remove it under Security, and change your password.');
  go('/security', 'ok', 'Backup email saved.');
}
export async function backupRemove() {
  const { user } = await authed(); if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  try { await clearBackup(user.id); } catch (e) { go('/security', 'err', safeMessage(e, 'backupRemove')); }
  if (user.email) await mailSafe(user.email, 'A backup email was removed from Pera', 'The backup email on your Pera account was removed. If this was not you, change your password under Security.');
  go('/security', 'ok', 'Backup email removed.');
}
// Recovery through the backup address. The reply is identical whether or not the address is on file (no account enumeration), and each address is rate-limited.
export async function requestResetViaBackup(fd: FormData) {
  if (!backupConfigured()) go('/forgot', 'err', BACKUP_OFF);
  const email = str(fd, 'email').trim().toLowerCase(); if (!isEmail(email)) go('/forgot', 'err', 'Enter a valid email address.');
  try {
    const row = await findVerified(email);
    if (row && cooldownPassed(row, Date.now())) {
      const primary = await emailOf(row.user_id), token = primary ? await recoveryToken(primary) : null;
      if (primary && token) {
        await patchBackup(row.user_id, { last_recovery_at: new Date().toISOString() });
        const link = `${await siteUrl()}/auth/callback?token_hash=${encodeURIComponent(token)}&type=recovery&next=/reset`;
        await mailSafe(email, 'Reset your Pera password', `Use this link to choose a new password for your Pera account:\n\n${link}\n\nIt works once and expires soon. If you did not ask for this, ignore this email.`);
        await mailSafe(primary, 'Password reset requested through your backup email', 'Someone asked to reset your Pera password using the backup email on your account. If that was you, no action is needed. If not, log in, change your password and review Security.');
      }
    }
  } catch (e) { logErr('requestResetViaBackup', e); }
  go('/forgot', 'ok', BACKUP_REPLY);
}
type Enroll = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };
export async function mfaStart(): Promise<Enroll> {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) return { ok: false, error: 'Session expired. Please sign in again.' };
  const { data: l } = await sb.auth.mfa.listFactors(); if (l?.totp?.length) return { ok: false, error: 'Two-step verification is already on.' };
  for (const f of l?.all ?? []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id }); // drop abandoned setups
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Pera', friendlyName: `Pera ${Date.now()}` });
  if (error || !data) return { ok: false, error: authMessage(error, 'mfaStart') }; return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}
export async function mfaConfirm(factorId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) return { ok: false, error: 'Session expired. Please sign in again.' };
  const c = String(code).replace(/\s/g, ''); if (!/^\d{6}$/.test(c)) return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: String(factorId), code: c }); if (error) return { ok: false, error: authMessage(error, 'mfaConfirm') };
  revalidatePath('/security'); return { ok: true };
}
export async function disableMfa(fd: FormData) {
  const { sb } = await authed(), code = code6(fd); if (!/^\d{6}$/.test(code)) go('/security', 'err', 'Enter the 6-digit code from your authenticator app.');
  const { data: f } = await sb.auth.mfa.listFactors(), factor = f?.totp?.[0]; if (!factor) go('/security', 'ok', 'Two-step verification is already off.');
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code }); if (error) go('/security', 'err', authMessage(error, 'disableMfa'));
  const { error: e2 } = await sb.auth.mfa.unenroll({ factorId: factor.id }); if (e2) go('/security', 'err', authMessage(e2, 'disableMfa'));
  go('/security', 'ok', 'Two-step verification is off.');
}

// ---- quick add (writes only after server-side validation; success is reported only after the rows are re-counted)
type Saved = { ok: true; n: number } | { ok: false; error: string };
export async function saveItems(requestId: string, items: unknown): Promise<Saved> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: 'Not saved: bad request id' };
  try {
    const { sb, user, accounts, categories } = await ctx(true); const v = validateItems(items, { categories, accounts }); if (!v.ok) return { ok: false, error: 'Not saved: ' + v.error };
    const rows = v.rows.map((r, i) => ({ ...r, user_id: user.id, request_id: requestId, request_idx: i }));
    const { error } = await sb.from('transactions').upsert(rows, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true }); // retry-safe
    if (error) return { ok: false, error: 'Not saved: ' + safeMessage(error, 'saveItems') };
    const { count, error: e2 } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('request_id', requestId);
    if (e2) logErr('saveItems.count', e2); if (e2 || count !== rows.length) return { ok: false, error: 'Not saved: the database did not confirm the write' };
    done(); return { ok: true, n: rows.length };
  } catch (e) { return { ok: false, error: 'Not saved: ' + safeMessage(e, 'saveItems') }; }
}
export async function parseServer(text: string, today: string): Promise<Parsed[]> {
  const { accounts, categories } = await ctx(true);
  return parseWithFallback(text.slice(0, 500), { today: isDate(today) ? today : manilaToday(), accounts: accounts.map(a => a.name) }, categories.map(c => c.name), getProvider(process.env));
}
const RESTORE = ['id', 'account_id', 'transfer_account_id', 'category_id', 'type', 'amount_minor', 'description', 'notes', 'transaction_date', 'import_hash', 'external_id', 'recurring_id', 'request_id', 'request_idx', 'created_at'];
type Sb = Awaited<ReturnType<typeof ctx>>['sb'];
// Put a deleted transaction back (used by the Undo button and by "undo last"). Takes the server-side copy from the trash when there is one.
async function restoreRow(sb: Sb, userId: string, row: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const r: Record<string, unknown> = { user_id: userId }; for (const k of RESTORE) if (row[k] !== undefined && row[k] !== null) r[k] = row[k];
  if (typeof r.id !== 'string') return { ok: false, message: 'Could not restore that transaction.' };
  if (r.recurring_id) { const { data } = await sb.from('recurring_transactions').select('id').eq('id', r.recurring_id as string).maybeSingle(); if (!data) delete r.recurring_id; } // the rule was deleted since
  const { error } = await sb.from('transactions').upsert(r, { onConflict: 'id', ignoreDuplicates: true });
  if (error) return { ok: false, message: (error as { code?: string }).code === '23503' ? "Can't restore it: its account or category was deleted since." : safeMessage(error, 'restore') };
  const { count } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('id', r.id as string); if (count !== 1) return { ok: false, message: 'Could not restore that transaction.' };
  await sb.from('tx_trash').delete().eq('tx_id', r.id as string); // best effort: the entry is spent
  return { ok: true, message: 'Restored' };
}
export async function runCommand(text: string): Promise<{ ok: boolean; message: string; deleted?: any }> {
  try {
    const { sb, user, categories } = await ctx(true), cmd = commandOf(text), t = text.toLowerCase();
    if (!cmd) return { ok: false, message: 'Not a command. Try "delete last", "undo last" or "change last to Food".' };
    if (cmd === 'undo') { // restores the most recently deleted transaction; repeating walks back through older deletions
      const { data: tr, error } = await sb.from('tx_trash').select('id,tx_id,row').order('deleted_at', { ascending: false }).limit(1); if (error) return { ok: false, message: safeMessage(error, 'undo') };
      if (!tr?.length) return { ok: false, message: NOTHING_TO_UNDO };
      const r = await restoreRow(sb, user.id, tr[0].row as Record<string, unknown>); await sb.from('tx_trash').delete().eq('id', tr[0].id); // an unrestorable entry is dropped so undo never gets stuck on it
      if (!r.ok) return r; done(); const x = tr[0].row as { amount_minor: number; description?: string };
      return { ok: true, message: `Restored ${formatMinor(Number(x.amount_minor))} ${x.description || ''}`.trim() };
    }
    const { data: last, error } = await sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(1);
    if (error) return { ok: false, message: safeMessage(error, 'command') }; if (!last?.length) return { ok: false, message: 'No transactions yet.' };
    const x = last[0];
    if (cmd === 'delete') {
      const { data, error: e } = await sb.from('transactions').delete().eq('id', x.id).select('*'); if (e || !data?.length) return { ok: false, message: 'Not deleted: ' + (e ? safeMessage(e, 'delete') : 'nothing was removed') };
      done(); return { ok: true, message: `Deleted ${formatMinor(Number(x.amount_minor))} ${x.description || ''}`.trim() + '. Type "undo last" to bring it back.', deleted: data[0] };
    }
    const target = categoryFor(t.split(/\bto\b/).pop() ?? ''); const cat = target && categories.find(c => c.name === target.c && c.type === x.type);
    if (!cat) return { ok: false, message: x.type === 'transfer' ? 'Transfers have no category.' : 'Unknown category, or it belongs to the other type. Use Edit to change the type.' };
    const { data, error: e } = await sb.from('transactions').update({ category_id: cat.id }).eq('id', x.id).select('id'); if (e || !data?.length) return { ok: false, message: 'Not updated' };
    done(); return { ok: true, message: `Changed last transaction to ${cat.name}` };
  } catch (e) { return { ok: false, message: safeMessage(e, 'command') }; }
}
export async function restoreTx(row: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  try { const { sb, user } = await ctx(true); const id = typeof row?.id === 'string' ? row.id : '';
    const { data: tr } = id ? await sb.from('tx_trash').select('row').eq('tx_id', id).order('deleted_at', { ascending: false }).limit(1) : { data: null };
    const r = await restoreRow(sb, user.id, (tr?.[0]?.row as Record<string, unknown> | undefined) ?? row); if (r.ok) done(); return r;
  } catch (e) { return { ok: false, message: safeMessage(e, 'restoreTx') }; }
}
export async function deleteTx(id: string) {
  try { const { sb } = await ctx(true); const { data, error } = await sb.from('transactions').delete().eq('id', id).select('*');
    if (error || !data?.length) return { ok: false as const, message: 'Not deleted: ' + (error ? safeMessage(error, 'deleteTx') : 'it no longer exists') }; /* no revalidate here: it would refresh the list and unmount the row's Undo prompt; pages are dynamic, so the next navigation is fresh */ return { ok: true as const, row: data[0] };
  } catch (e) { return { ok: false as const, message: 'Not deleted: ' + safeMessage(e, 'deleteTx') }; }
}
export async function duplicateTx(id: string) {
  try { const { sb, user } = await ctx(true); const { data } = await sb.from('transactions').select('*').eq('id', id).single(); if (!data) return { ok: false, message: 'Not found' };
    const r: Record<string, unknown> = { user_id: user.id }; for (const k of RESTORE) if (!['id', 'import_hash', 'external_id', 'recurring_id', 'request_id', 'request_idx', 'created_at'].includes(k)) r[k] = data[k];
    const { error } = await sb.from('transactions').insert(r); if (error) return { ok: false, message: safeMessage(error, 'duplicateTx') }; done(); return { ok: true, message: 'Duplicated' };
  } catch (e) { return { ok: false, message: safeMessage(e, 'duplicateTx') }; }
}
export async function updateTx(fd: FormData) {
  const id = str(fd, 'id'), back = `/transactions/${encodeURIComponent(id)}`, { sb, categories, accounts } = await ctx();
  const amt = parseAmountMinor(str(fd, 'amount')), date = str(fd, 'date'), type = str(fd, 'type');
  if (amt === null) go(back, 'err', 'Amount must be 0.01 to 999,999,999.99'); if (!isDate(date)) go(back, 'err', 'Invalid date');
  if (!accounts.some(a => a.id === str(fd, 'account_id'))) go(back, 'err', 'Unknown account');
  const patch: Record<string, unknown> = { amount_minor: amt, transaction_date: date, description: str(fd, 'description').slice(0, 120), notes: str(fd, 'notes').slice(0, 500), account_id: str(fd, 'account_id'), type };
  if (type === 'transfer') { if (!accounts.some(a => a.id === str(fd, 'to_id'))) go(back, 'err', 'Unknown destination account'); patch.transfer_account_id = str(fd, 'to_id'); patch.category_id = null; }
  else { const c = categories.find(c => c.id === str(fd, 'category_id')); if ((type !== 'income' && type !== 'expense') || !c || c.type !== type) go(back, 'err', 'Category does not match the type'); patch.category_id = c.id; patch.transfer_account_id = null; }
  const { data, error } = await sb.from('transactions').update(patch).eq('id', id).select('id'); if (error || !data?.length) go(back, 'err', 'Not saved: ' + (error ? safeMessage(error, 'updateTx') : 'that transaction no longer exists')); done(); go('/transactions', 'ok', 'Saved');
}
// ---- accounts / transfers / categories / budgets / recurring / profile
export async function createAccount(fd: FormData) {
  const { sb, user } = await ctx(); const open = parseOptionalMinor(str(fd, 'opening')); const name = str(fd, 'name').trim().slice(0, 40);
  if (!name || open === null) go('/accounts', 'err', 'Name and a valid opening balance are required');
  const { error } = await sb.from('accounts').insert({ user_id: user.id, name, account_type: str(fd, 'type') || 'other', opening_balance_minor: open }); if (error) go('/accounts', 'err', safeMessage(error, 'createAccount')); done(); go('/accounts', 'ok', 'Account created');
}
export async function updateAccount(fd: FormData) {
  const { sb } = await ctx(); const open = parseOptionalMinor(str(fd, 'opening')); const name = str(fd, 'name').trim().slice(0, 40); if (!name || open === null) go('/accounts', 'err', 'Invalid name or opening balance');
  const { error } = await sb.from('accounts').update({ name, account_type: str(fd, 'type'), opening_balance_minor: open }).eq('id', str(fd, 'id')); if (error) go('/accounts', 'err', safeMessage(error, 'updateAccount')); done(); go('/accounts', 'ok', 'Account saved');
}
export async function deleteAccount(fd: FormData) {
  const { sb } = await ctx(); const { error } = await sb.from('accounts').delete().eq('id', str(fd, 'id')); if (error) go('/accounts', 'err', 'Cannot delete: it is used by transactions (move or delete them first)'); done(); go('/accounts', 'ok', 'Account deleted');
}
export async function transfer(fd: FormData) {
  const { sb, user } = await ctx(); const amt = parseAmountMinor(str(fd, 'amount')), date = str(fd, 'date') || manilaToday(), a = str(fd, 'from'), b = str(fd, 'to');
  if (amt === null || !isDate(date) || !a || !b || a === b) go('/accounts', 'err', 'Choose two different accounts and a valid amount/date');
  const { error } = await sb.from('transactions').insert({ user_id: user.id, type: 'transfer', amount_minor: amt, account_id: a, transfer_account_id: b, transaction_date: date, description: str(fd, 'description').slice(0, 120) });
  if (error) go('/accounts', 'err', 'Not saved: ' + safeMessage(error, 'transfer')); done(); go('/accounts', 'ok', 'Transfer recorded');
}
export async function createCategory(fd: FormData) {
  const { sb, user } = await ctx(); const name = str(fd, 'name').trim().slice(0, 40), type = str(fd, 'type'); if (!name || (type !== 'income' && type !== 'expense')) go('/settings', 'err', 'Name and type required');
  const { error } = await sb.from('categories').insert({ user_id: user.id, name, type }); if (error) go('/settings', 'err', safeMessage(error, 'createCategory')); done(); go('/settings', 'ok', 'Category added');
}
export async function deleteCategory(fd: FormData) {
  const { sb } = await ctx(); const { error } = await sb.from('categories').delete().eq('id', str(fd, 'id')); if (error) go('/settings', 'err', 'Cannot delete: category is in use'); done(); go('/settings', 'ok', 'Category deleted');
}
export async function setBudget(fd: FormData) {
  const { sb, user } = await ctx(); const ym = str(fd, 'ym'), back = `/budgets?ym=${ym}`; if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) go('/budgets', 'err', 'Bad month');
  const [year, month] = ym.split('-').map(Number), cat = str(fd, 'category_id'), raw = str(fd, 'amount').trim();
  if (raw === '') { await sb.from('budgets').delete().eq('category_id', cat).eq('month', month).eq('year', year); done(); go(back, 'ok', 'Budget removed'); }
  const amt = parseOptionalMinor(raw); if (amt === null || amt < 0) go(back, 'err', 'Invalid budget amount');
  const { error } = await sb.from('budgets').upsert({ user_id: user.id, category_id: cat, amount_minor: amt, month, year }, { onConflict: 'user_id,category_id,month,year' }); if (error) go(back, 'err', safeMessage(error, 'setBudget')); done(); go(back, 'ok', 'Budget saved');
}
export async function createRecurring(fd: FormData) {
  const { sb, user, categories, accounts } = await ctx(); const amt = parseAmountMinor(str(fd, 'amount')), start = str(fd, 'start'), n = Number(str(fd, 'interval') || 1), type = str(fd, 'type');
  const cat = categories.find(c => c.id === str(fd, 'category_id') && c.type === type), acct = accounts.find(a => a.id === str(fd, 'account_id'));
  if (amt === null || !isDate(start) || !cat || !acct || !Number.isInteger(n) || n < 1 || n > 365 || !['daily', 'weekly', 'monthly', 'yearly'].includes(str(fd, 'frequency'))) go('/settings', 'err', 'Check amount, start date, type/category, account and interval');
  const { error } = await sb.from('recurring_transactions').insert({ user_id: user.id, account_id: acct.id, category_id: cat.id, type, amount_minor: amt, description: str(fd, 'description').slice(0, 120), frequency: str(fd, 'frequency'), interval_count: n, start_date: start, next_run_date: start });
  if (error) go('/settings', 'err', safeMessage(error, 'createRecurring')); done(); go('/settings', 'ok', 'Recurring rule added (runs when you open the dashboard)');
}
export async function deleteRecurring(fd: FormData) { const { sb } = await ctx(); const { error } = await sb.from('recurring_transactions').delete().eq('id', str(fd, 'id')); if (error) go('/settings', 'err', 'Could not delete that rule. ' + safeMessage(error, 'deleteRecurring')); done(); go('/settings', 'ok', 'Rule deleted (past transactions kept)'); }
export async function updateProfile(fd: FormData) { const { sb, user } = await ctx(); const { error } = await sb.from('profiles').update({ name: str(fd, 'name').slice(0, 60) }).eq('id', user.id); if (error) go('/settings', 'err', safeMessage(error, 'updateProfile')); go('/settings', 'ok', 'Profile saved'); }
// ---- assistant: fixed read-only queries -> numbers computed by SQL -> text. A provider (if any) may only reword the numbers.
export async function askAssistant(q: string): Promise<{ ok: boolean; answer: string }> {
  try {
    const { sb, accounts, categories } = await ctx(true); const Q = parseQuestion(q.slice(0, 300), { categories, accounts, today: manilaToday() }); const scope = `${Q.categoryName ? ' on ' + Q.categoryName : ''}${Q.accountName ? ' through ' + Q.accountName : ''}`;
    const must = <T,>(r: { data: T; error: unknown }): T => { if (r.error) throw r.error; return r.data; }; // a failed query must never become a confident wrong number
    const sum = async (from: string, to: string) => Number(must(await sb.rpc('sum_expense', { p_from: from, p_to: to, p_category: Q.categoryId ?? null, p_account: Q.accountId ?? null })) ?? 0);
    const cn = new Map(categories.map(c => [c.id, c.name])); let answer = 'I can answer spending, income, savings, top category, biggest expenses and month comparisons.';
    if (Q.kind === 'spend') answer = `You spent ${formatMinor(await sum(Q.from, Q.to))}${scope} ${Q.label}.`;
    else if (Q.kind === 'compare') { const p = periodFor2(); const a = await sum(p.cur.from, p.cur.to), b = await sum(p.prev.from, p.prev.to); answer = `Spending${scope}: ${formatMinor(a)} this month vs ${formatMinor(b)} last month — ${formatMinor(Math.abs(a - b))} ${a >= b ? 'more' : 'less'}.`; }
    else if (Q.kind === 'income' || Q.kind === 'save' || Q.kind === 'top') {
      const data = must(await sb.rpc('period_summary', { p_from: Q.from, p_to: Q.to })); const txs: Tx[] = (data as any[] ?? []).map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: Q.from })); const t = totals(txs);
      if (Q.kind === 'income') answer = `Income ${Q.label}: ${formatMinor(t.income)}.`; else if (Q.kind === 'save') answer = `Income ${formatMinor(t.income)} − expenses ${formatMinor(t.expense)} = saved ${formatMinor(t.net)} ${Q.label}.`;
      else { const top = txs.filter(x => x.type === 'expense').sort((a, b) => b.amount_minor - a.amount_minor)[0]; answer = top ? `Top spending category ${Q.label}: ${top.category} at ${formatMinor(top.amount_minor)}.` : `No expenses ${Q.label}.`; }
    } else if (Q.kind === 'biggest') {
      const data = must(await sb.from('transactions').select('amount_minor,description,transaction_date,category_id').eq('type', 'expense').gte('transaction_date', Q.from).lte('transaction_date', Q.to).order('amount_minor', { ascending: false }).limit(5));
      answer = data?.length ? `Biggest expenses ${Q.label}: ` + data.map((d: any) => `${formatMinor(Number(d.amount_minor))} ${cn.get(d.category_id) ?? ''}${d.description ? ' (' + d.description + ')' : ''}`).join('; ') : `No expenses ${Q.label}.`;
    }
    const p = getProvider(process.env); if (p) { try { answer = await p.answerFinancialQuestion(q, { computed_answer: answer }) || answer; } catch { /* keep the computed answer */ } }
    return { ok: true, answer };
  } catch (e) { return { ok: false, answer: safeMessage(e, 'askAssistant') }; }
}
import { periodFor, shiftYm, monthRange } from '@/lib/range';
function periodFor2() { const ym = manilaToday().slice(0, 7); return { cur: periodFor('month', manilaToday()), prev: monthRange(shiftYm(ym, -1)) }; }
// ---- CSV import + localStorage migration
async function resolveAccounts(sb: any, user: any, existing: { id: string; name: string }[], names: string[]) {
  const map = new Map(existing.map(a => [a.name.toLowerCase(), a.id])); const fresh = [...new Set(names.filter(n => n && !map.has(n.toLowerCase())))].slice(0, 20);
  if (fresh.length) { const { data } = await sb.from('accounts').insert(fresh.map(name => ({ user_id: user.id, name, account_type: 'other' }))).select('id,name'); for (const a of data ?? []) map.set(a.name.toLowerCase(), a.id); }
  return map;
}
function toDbRows(rows: (Row & { import_hash?: string; external_id?: string })[], accs: Map<string, string>, cats: { id: string; name: string; type: string }[], def: string, uid: string) {
  const out: any[] = []; let skipped = 0;
  for (const r of rows) {
    const a = r.account ? accs.get(r.account.toLowerCase()) : def, b = r.to_account ? accs.get(r.to_account.toLowerCase()) : undefined;
    const c = r.type === 'transfer' ? null : cats.find(x => x.name === r.category && x.type === r.type) ?? cats.find(x => x.name === (r.type === 'income' ? 'Other Income' : 'Other') && x.type === r.type);
    if (!a || (r.type === 'transfer' && (!b || a === b)) || (r.type !== 'transfer' && !c)) { skipped++; continue; }
    out.push({ user_id: uid, type: r.type, amount_minor: r.amount_minor, account_id: a, transfer_account_id: r.type === 'transfer' ? b : null, category_id: c?.id ?? null, description: r.description, notes: r.notes, transaction_date: r.date, import_hash: r.import_hash ?? null, external_id: r.external_id ?? null });
  }
  return { out, skipped };
}
const MAX_CSV_ROWS = 20_000;
export async function importCsv(fd: FormData) {
  const { sb, user, accounts, categories } = await ctx(); const f = fd.get('file'); if (f instanceof File && f.size > MAX_CSV_BYTES) go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`); const text = f instanceof File && f.size ? await f.text() : str(fd, 'csv'); if (text.length > MAX_CSV_BYTES) go('/settings', 'err', `That file is too large (max ${MAX_CSV_LABEL}). Split it into smaller files.`);
  const parsed = fromCsv(text, new Set(), { income: categories.filter(c => c.type === 'income').map(c => c.name), expense: categories.filter(c => c.type === 'expense').map(c => c.name) });
  if (parsed.ok.length > MAX_CSV_ROWS) go('/settings', 'err', `Too many rows (${parsed.ok.length}). The limit is ${MAX_CSV_ROWS} per file; split it and import in parts.`);
  const accs = await resolveAccounts(sb, user, accounts, parsed.ok.flatMap(r => [r.account, r.to_account])), def = defaultAccount(accounts)?.id ?? [...accs.values()][0];
  const { out, skipped } = toDbRows(parsed.ok, accs, categories, def, user.id); let inserted = 0;
  for (let i = 0; i < out.length; i += 500) { const { data, error } = await sb.from('transactions').upsert(out.slice(i, i + 500), { onConflict: 'user_id,import_hash', ignoreDuplicates: true }).select('id'); if (error) go('/settings', 'err', `Import stopped after ${inserted} rows: ${safeMessage(error, 'importCsv')}`); inserted += data?.length ?? 0; }
  done(); go('/settings', 'ok', `Imported ${inserted} new. ${out.length - inserted} matched an earlier import and were skipped. ${parsed.bad.length + skipped} invalid or unmatched rows were ignored. Rows you typed by hand are never compared.`);
}
export async function migrateLegacy(json: string) {
  try {
    const { sb, user, accounts, categories } = await ctx(true); let S: unknown; try { S = JSON.parse(json); } catch { return { ok: false, message: 'localStorage data is not valid JSON' }; }
    const m = mapLegacy(S); const accs = await resolveAccounts(sb, user, accounts, [...m.rows.flatMap(r => [r.account, r.to_account]), ...Object.keys(m.openings)]);
    for (const [name, minor] of Object.entries(m.openings)) { const id = accs.get(name.toLowerCase()); if (id && minor !== 0) await sb.from('accounts').update({ opening_balance_minor: minor }).eq('id', id).eq('opening_balance_minor', 0); }
    const def = defaultAccount(accounts)?.id ?? [...accs.values()][0]; const { out, skipped } = toDbRows(m.rows, accs, categories, def, user.id); let inserted = 0;
    for (let i = 0; i < out.length; i += 500) { const { data, error } = await sb.from('transactions').upsert(out.slice(i, i + 500), { onConflict: 'user_id,external_id', ignoreDuplicates: true }).select('id'); if (error) return { ok: false, message: safeMessage(error, 'migrateLegacy') }; inserted += data?.length ?? 0; }
    const ids = out.map(o => o.external_id); let inc = 0, exp = 0;
    for (let i = 0; i < ids.length; i += 200) { const { data } = await sb.from('transactions').select('type,amount_minor').in('external_id', ids.slice(i, i + 200)); for (const r of data ?? []) { if (r.type === 'income') inc += Number(r.amount_minor); else if (r.type === 'expense') exp += Number(r.amount_minor); } }
    const want = totals(out.map(o => ({ type: o.type, amount_minor: o.amount_minor, date: o.transaction_date }) as Tx)); const verified = want.income === inc && want.expense === exp; done();
    return { ok: verified, message: `${inserted} new, ${out.length - inserted} already present, ${m.bad.length + skipped} invalid. Totals ${verified ? 'verified' : 'DO NOT MATCH'}: income ${formatMinor(inc)} / expense ${formatMinor(exp)} (expected ${formatMinor(want.income)} / ${formatMinor(want.expense)}).` };
  } catch (e) { return { ok: false, message: safeMessage(e, 'migrateLegacy') }; }
}
