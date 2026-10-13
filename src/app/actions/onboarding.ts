'use server';
import { ctx, balanceMap } from '@/lib/data';
import { cookies } from 'next/headers';
import { openingFromToday, BAL_COOKIE } from '@/lib/onboarding';
import { manilaToday } from '@/core/money';
import { parseOptionalMinor } from '@/lib/validate';
import { safeMessage } from '@/lib/safe';
import { go, str, done } from './shared';

// First-run wizard actions. Both return to "/" (the wizard covers whatever page the person is on) and say what to fix when something is wrong.

// Step 2: today's real balance of each account. Entries already logged count, so the stored opening balance is the typed amount minus them. At least one account needs money in it (a rough number is fine).
export async function saveOpeningBalances(fd: FormData) {
  const { sb, accounts } = await ctx(),
    bal = await balanceMap(sb),
    patch: { id: string; v: number }[] = [];
  let any = false;
  for (const a of accounts) {
    if (!fd.has(`open_${a.id}`)) continue; // not on the form (stale page, or past the shown list): leave it alone, never reset it to 0
    const raw = str(fd, `open_${a.id}`),
      v = parseOptionalMinor(raw);
    if (v === null) go('/', 'err', `"${raw.slice(0, 20)}" is not a valid amount for ${a.name}. Use numbers like 1500 or 1500.50.`);
    if (v !== 0) any = true;
    const o = openingFromToday(v, bal.get(a.id) ?? Number(a.opening_balance_minor), Number(a.opening_balance_minor));
    if (o === null) go('/', 'err', `That amount is too large for ${a.name}.`);
    if (o !== Number(a.opening_balance_minor)) patch.push({ id: a.id, v: o });
  }
  if (!any) go('/', 'err', 'Type what you have in at least one account. A rough number is fine, you can change it any time.');
  for (const p of patch) {
    const { error } = await sb.from('accounts').update({ opening_balance_minor: p.v }).eq('id', p.id);
    if (error) go('/', 'err', safeMessage(error, 'saveOpeningBalances'));
  }
  (await cookies()).set(BAL_COOKIE, '1', { maxAge: 86400 * 30, path: '/', sameSite: 'lax' }); // step 2 submitted (see BAL_COOKIE)
  done();
  go('/', 'ok', 'Balances saved.');
}

// Step 3: one monthly limit for a spending category (this month).
export async function startBudget(fd: FormData) {
  const { sb, user, categories } = await ctx(),
    c = categories.find((x) => x.id === str(fd, 'category_id') && x.type === 'expense');
  if (!c) go('/', 'err', 'Pick a category first.');
  const amt = parseOptionalMinor(str(fd, 'amount'));
  if (amt === null || amt <= 0) go('/', 'err', 'Type the monthly limit as a number above 0, like 3000.');
  const [year, month] = manilaToday().slice(0, 7).split('-').map(Number);
  const { error } = await sb
    .from('budgets')
    .upsert({ user_id: user.id, category_id: c.id, amount_minor: amt, month, year }, { onConflict: 'user_id,category_id,month,year' });
  if (error) go('/', 'err', safeMessage(error, 'startBudget'));
  done();
  go('/', 'ok', 'Budget set.');
}
