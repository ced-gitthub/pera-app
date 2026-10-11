'use server';
import { supabaseProbe } from '@/lib/supabase/probe';
import {
  backupConfigured,
  getBackup,
  getBackupRaw,
  saveBackup,
  patchBackup,
  clearBackup,
  findVerified,
  emailOf,
  recoveryToken,
} from '@/lib/backup';
import { sendMail } from '@/lib/mail';
import { newCode, hashCode, checkCode, nextSend, cooldownPassed, CODE_TTL_MS, MAX_ATTEMPTS } from '@/lib/backupcode';
import { isEmail } from '@/lib/password';
import { safeMessage, authMessage, logErr } from '@/lib/safe';
import { go, str, siteUrl, errCode, code6, authed } from './shared';

// ---- backup email (recovery when the login inbox is lost). Needs SUPABASE_SECRET_KEY + SMTP_* on the server; hidden otherwise.
const BACKUP_OFF = 'Backup email is not available right now.',
  BACKUP_REPLY = 'If that backup email is on file, a reset link is on its way. Check your inbox and spam folder.';

const mailSafe = async (to: string, subject: string, text: string) => {
  try {
    await sendMail(to, subject, text);
    return true;
  } catch (e) {
    logErr('mail', e);
    return false;
  }
};

export async function backupStart(fd: FormData) {
  if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  const { user } = await authed(),
    email = str(fd, 'email').trim().toLowerCase();
  if (!isEmail(email)) go('/security', 'err', 'Enter a valid email address.');
  if (email === (user.email ?? '').toLowerCase()) go('/security', 'err', 'Use a different address than the one you log in with.');
  const { error: wrong } = await supabaseProbe().auth.signInWithPassword({ email: user.email ?? '', password: str(fd, 'current') });
  if (wrong)
    go(
      '/security',
      'err',
      errCode(wrong) === 'invalid_credentials' || /invalid login/i.test(String((wrong as Error).message))
        ? 'Your current password is not right.'
        : authMessage(wrong, 'backupStart'),
    );
  let fail = '';
  try {
    const row = await getBackupRaw(user.id),
      n = nextSend(row, Date.now());
    if (!n.ok) fail = 'Too many codes. Try again in an hour.';
    else {
      const code = newCode();
      await saveBackup({
        user_id: user.id,
        email,
        verified_at: null,
        code_hash: hashCode(user.id, code),
        code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        code_attempts: 0,
        sends_in_hour: n.sends,
        sends_window_start: n.start,
        last_recovery_at: row?.last_recovery_at ?? null,
      });
      if (
        !(await mailSafe(
          email,
          'Your Pera backup email code',
          `Your Pera backup email code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for this, ignore this email and nothing changes.`,
        ))
      )
        fail = 'We could not send that email. Check the address and try again.';
    }
  } catch (e) {
    fail = safeMessage(e, 'backupStart');
  }
  if (fail) go('/security', 'err', fail);
  go('/security', 'ok', `We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
}

export async function backupConfirm(fd: FormData) {
  if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  const { user } = await authed(),
    code = code6(fd);
  if (!/^\d{6}$/.test(code)) go('/security', 'err', 'Enter the 6-digit code from the email.');
  let fail = '';
  try {
    const row = await getBackup(user.id),
      r = !row || row.verified_at ? 'gone' : checkCode(row, user.id, code, Date.now());
    if (r === 'gone') fail = 'Ask for a new code first.';
    else if (r === 'none' || r === 'expired') fail = 'That code expired. Ask for a new one.';
    else if (r === 'locked') fail = 'Too many wrong codes. Ask for a new one.';
    else if (r === 'wrong') {
      await patchBackup(user.id, { code_attempts: row!.code_attempts + 1 });
      fail = row!.code_attempts + 1 >= MAX_ATTEMPTS ? 'Too many wrong codes. Ask for a new one.' : 'That code is not right.';
    } else if (
      await patchBackup(user.id, { verified_at: new Date().toISOString(), code_hash: null, code_expires_at: null, code_attempts: 0 })
    ) {
      await clearBackup(user.id);
      fail = "That address can't be used as a backup. Try another.";
    }
  } catch (e) {
    fail = safeMessage(e, 'backupConfirm');
  }
  if (fail) go('/security', 'err', fail);
  if (user.email)
    await mailSafe(
      user.email,
      'A backup email was added to Pera',
      'A backup email address was just added to your Pera account, so you can reset your password if you lose access to this inbox.\n\nIf this was not you, log in, remove it under Security, and change your password.',
    );
  go('/security', 'ok', 'Backup email saved.');
}

export async function backupRemove() {
  const { user } = await authed();
  if (!backupConfigured()) go('/security', 'err', BACKUP_OFF);
  try {
    await clearBackup(user.id);
  } catch (e) {
    go('/security', 'err', safeMessage(e, 'backupRemove'));
  }
  if (user.email)
    await mailSafe(
      user.email,
      'A backup email was removed from Pera',
      'The backup email on your Pera account was removed. If this was not you, change your password under Security.',
    );
  go('/security', 'ok', 'Backup email removed.');
}

// Recovery through the backup address. The reply is identical whether or not the address is on file (no account enumeration), and each address is rate-limited.
export async function requestResetViaBackup(fd: FormData) {
  if (!backupConfigured()) go('/forgot', 'err', BACKUP_OFF);
  const email = str(fd, 'email').trim().toLowerCase();
  if (!isEmail(email)) go('/forgot', 'err', 'Enter a valid email address.');
  try {
    const row = await findVerified(email);
    if (row && cooldownPassed(row, Date.now())) {
      const primary = await emailOf(row.user_id),
        token = primary ? await recoveryToken(primary) : null;
      if (primary && token) {
        await patchBackup(row.user_id, { last_recovery_at: new Date().toISOString() });
        const link = `${await siteUrl()}/auth/callback?token_hash=${encodeURIComponent(token)}&type=recovery&next=/reset`;
        await mailSafe(
          email,
          'Reset your Pera password',
          `Use this link to choose a new password for your Pera account:\n\n${link}\n\nIt works once and expires soon. If you did not ask for this, ignore this email.`,
        );
        await mailSafe(
          primary,
          'Password reset requested through your backup email',
          'Someone asked to reset your Pera password using the backup email on your account. If that was you, no action is needed. If not, log in, change your password and review Security.',
        );
      }
    }
  } catch (e) {
    logErr('requestResetViaBackup', e);
  }
  go('/forgot', 'ok', BACKUP_REPLY);
}
