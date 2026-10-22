'use server';
import { ctx } from '@/lib/data/data';
import { manilaToday, parseAmountMinor, isSaneDate } from '@/core/money';
import { parseOptionalMinor } from '@/lib/common/validate';
import { safeMessage } from '@/lib/common/safe';
import { go, str, done, swapOrder } from './shared';

// ---- accounts / transfers / categories / budgets / recurring / profile
const ACCT_TYPES = ['cash', 'ewallet', 'bank', 'credit_card', 'savings', 'other'],
  SHORT_RE = /^[a-z0-9][a-z0-9 ]{0,11}$/i;

// A short name ("cc") is typed in Quick Add instead of the full account name, so it must be unique across your accounts and never equal another account's name.
function shortProblem(raw: string, id: string | null, accounts: { id: string; name: string; short_name: string | null }[]): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!SHORT_RE.test(v)) return 'A short name is 1 to 12 letters, numbers or spaces';
  const k = v.toLowerCase();
  if (accounts.some((a) => a.id !== id && (a.short_name ?? '').toLowerCase() === k))
    return `"${v}" is already the short name of another account`;
  if (accounts.some((a) => a.id !== id && a.name.toLowerCase() === k)) return `"${v}" is the name of another account`;
  return null;
}

export async function createAccount(fd: FormData) {
  const { sb, user, accounts } = await ctx();
  const open = parseOptionalMinor(str(fd, 'opening'));
  const name = str(fd, 'name').trim().slice(0, 40),
    short = str(fd, 'short').trim();
  if (!name || open === null) go('/accounts', 'err', 'Name and a valid starting balance are required');
  const sp = shortProblem(short, null, accounts);
  if (sp) go('/accounts', 'err', sp);
  const type = ACCT_TYPES.includes(str(fd, 'type')) ? str(fd, 'type') : 'other';
  const { error } = await sb.from('accounts').insert({
    user_id: user.id,
    name,
    account_type: type,
    opening_balance_minor: open,
    short_name: short || null,
    counts_as_savings: str(fd, 'savings') === 'on',
    show_on_home: str(fd, 'home') === 'on',
    sort_order: Math.max(0, ...accounts.map((a) => a.sort_order)) + 10,
  });
  if (error) go('/accounts', 'err', safeMessage(error, 'createAccount'));
  done();
  go('/accounts', 'ok', 'Account created');
}

// Only the fields that actually changed are written.
export async function updateAccount(fd: FormData) {
  const { sb, accounts } = await ctx(),
    cur = accounts.find((a) => a.id === str(fd, 'id'));
  if (!cur) go('/accounts', 'err', 'That account no longer exists');
  const open = parseOptionalMinor(str(fd, 'opening')),
    name = str(fd, 'name').trim().slice(0, 40),
    short = str(fd, 'short').trim(),
    type = str(fd, 'type');
  if (!name || open === null || !ACCT_TYPES.includes(type)) go('/accounts', 'err', 'Invalid name or starting balance');
  const sp = shortProblem(short, cur.id, accounts);
  if (sp) go('/accounts', 'err', sp);
  const patch: Record<string, unknown> = {},
    sv = str(fd, 'savings') === 'on',
    home = str(fd, 'home') === 'on';
  if (name !== cur.name) patch.name = name;
  if (type !== cur.account_type) patch.account_type = type;
  if (open !== Number(cur.opening_balance_minor)) patch.opening_balance_minor = open;
  if ((short || null) !== (cur.short_name ?? null)) patch.short_name = short || null;
  if (sv !== !!cur.counts_as_savings) patch.counts_as_savings = sv;
  if (home !== !!cur.show_on_home) patch.show_on_home = home;
  if (!Object.keys(patch).length) go('/accounts', 'ok', 'No changes');
  const { error } = await sb.from('accounts').update(patch).eq('id', cur.id);
  if (error) go('/accounts', 'err', safeMessage(error, 'updateAccount'));
  done();
  go('/accounts', 'ok', 'Account saved');
}

export async function deleteAccount(fd: FormData) {
  const { sb } = await ctx();
  const { error } = await sb.from('accounts').delete().eq('id', str(fd, 'id'));
  if (error) go('/accounts', 'err', 'Cannot delete: it is used by transactions (move or delete them first)');
  done();
  go('/accounts', 'ok', 'Account deleted');
}

export async function moveAccount(id: string, dir: string, _fd?: FormData) {
  // bound in the page: formAction={moveAccount.bind(null, id, 'up')}
  const { sb, accounts } = await ctx();
  const e = await swapOrder(sb, 'accounts', accounts, id, dir);
  if (e) go('/accounts', 'err', safeMessage(e, 'moveAccount'));
  done();
  go('/accounts', 'ok', 'Moved');
}

export async function transfer(fd: FormData) {
  const { sb, user } = await ctx();
  const amt = parseAmountMinor(str(fd, 'amount')),
    date = str(fd, 'date') || manilaToday(),
    a = str(fd, 'from'),
    b = str(fd, 'to');
  if (amt === null || !isSaneDate(date) || !a || !b || a === b)
    go('/accounts', 'err', 'Choose two different accounts and a valid amount/date');
  // The form carries a one-time id, so a double-tap or a retry on a slow connection records the transfer once.
  const rid = str(fd, 'rid'),
    row = {
      user_id: user.id,
      type: 'transfer',
      amount_minor: amt,
      account_id: a,
      transfer_account_id: b,
      transaction_date: date,
      description: str(fd, 'description').slice(0, 120),
    };
  const { error } = /^[0-9a-f-]{36}$/i.test(rid)
    ? await sb
        .from('transactions')
        .upsert({ ...row, request_id: rid, request_idx: 0 }, { onConflict: 'user_id,request_id,request_idx', ignoreDuplicates: true })
    : await sb.from('transactions').insert(row);
  if (error) go('/accounts', 'err', 'Not saved: ' + safeMessage(error, 'transfer'));
  done();
  go('/accounts', 'ok', 'Transfer recorded');
}
