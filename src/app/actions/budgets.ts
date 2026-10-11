'use server';
import { ctx } from '@/lib/data';
import { manilaToday, parseAmountMinor, isDate, addDays } from '@/core/money';
import { parseOptionalMinor, minorToInput } from '@/lib/validate';
import { safeMessage } from '@/lib/safe';
import { go, str, done, addCategory, swapOrder } from './shared';

const backTo = (fd: FormData, d: string) => (['/settings', '/budgets'].includes(str(fd, 'back')) ? str(fd, 'back') : d);

export async function createCategory(fd: FormData) {
  const { sb, user } = await ctx(),
    back = backTo(fd, '/settings');
  const name = str(fd, 'name').trim().slice(0, 40),
    type = str(fd, 'type');
  if (!name || (type !== 'income' && type !== 'expense')) go(back, 'err', 'Name and type required');
  const { error } = await addCategory(sb, user.id, name, type);
  if (error) go(back, 'err', safeMessage(error, 'createCategory'));
  done();
  go(back, 'ok', 'Category added');
}

export async function deleteCategory(fd: FormData) {
  const { sb } = await ctx(),
    back = backTo(fd, '/settings');
  const { error } = await sb.from('categories').delete().eq('id', str(fd, 'id'));
  if (error) go(back, 'err', 'Cannot delete: category is in use');
  done();
  go(back, 'ok', 'Category deleted');
}

export async function moveCategory(id: string, dir: string, _fd?: FormData) {
  const { sb, categories } = await ctx(),
    back = '/budgets',
    c = categories.find((x) => x.id === id);
  if (!c) go(back, 'err', 'That category no longer exists');
  const e = await swapOrder(
    sb,
    'categories',
    categories.filter((x) => x.type === c.type),
    c.id,
    dir,
  );
  if (e) go(back, 'err', safeMessage(e, 'moveCategory'));
  done();
  go(back, 'ok', 'Moved');
}

// Budgets edit mode: rename and/or set the month's budget for one category. Only what changed is written.
export async function saveBudgetRow(fd: FormData) {
  const { sb, user, categories } = await ctx();
  const ym = str(fd, 'ym');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) go('/budgets', 'err', 'Bad month');
  const back = `/budgets?ym=${ym}`;
  const c = categories.find((x) => x.id === str(fd, 'category_id') && x.type === 'expense');
  if (!c) go(back, 'err', 'That category no longer exists');
  const name = str(fd, 'name').trim().slice(0, 40),
    raw = str(fd, 'amount').trim(),
    [year, month] = ym.split('-').map(Number);
  let changed = false;
  if (name && name !== c.name) {
    const { error } = await sb.from('categories').update({ name }).eq('id', c.id);
    if (error) go(back, 'err', safeMessage(error, 'renameCategory'));
    changed = true;
  }
  const { data: b } = await sb
      .from('budgets')
      .select('amount_minor')
      .eq('category_id', c.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle(),
    was = b ? minorToInput(Number(b.amount_minor)) : '';
  if (raw !== was) {
    if (raw === '') await sb.from('budgets').delete().eq('category_id', c.id).eq('month', month).eq('year', year);
    else {
      const amt = parseOptionalMinor(raw);
      if (amt === null || amt < 0) go(back, 'err', 'Invalid budget amount');
      const { error } = await sb
        .from('budgets')
        .upsert({ user_id: user.id, category_id: c.id, amount_minor: amt, month, year }, { onConflict: 'user_id,category_id,month,year' });
      if (error) go(back, 'err', safeMessage(error, 'saveBudgetRow'));
    }
    changed = true;
  }
  done();
  go(back, 'ok', changed ? 'Saved' : 'No changes');
}

export async function setBudget(fd: FormData) {
  const { sb, user } = await ctx();
  const ym = str(fd, 'ym'),
    back = `/budgets?ym=${ym}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) go('/budgets', 'err', 'Bad month');
  const [year, month] = ym.split('-').map(Number),
    cat = str(fd, 'category_id'),
    raw = str(fd, 'amount').trim();
  if (raw === '') {
    await sb.from('budgets').delete().eq('category_id', cat).eq('month', month).eq('year', year);
    done();
    go(back, 'ok', 'Budget removed');
  }
  const amt = parseOptionalMinor(raw);
  if (amt === null || amt < 0) go(back, 'err', 'Invalid budget amount');
  const { error } = await sb
    .from('budgets')
    .upsert({ user_id: user.id, category_id: cat, amount_minor: amt, month, year }, { onConflict: 'user_id,category_id,month,year' });
  if (error) go(back, 'err', safeMessage(error, 'setBudget'));
  done();
  go(back, 'ok', 'Budget saved');
}

export async function createRecurring(fd: FormData) {
  const { sb, user, categories, accounts } = await ctx();
  const amt = parseAmountMinor(str(fd, 'amount')),
    start = str(fd, 'start'),
    n = Number(str(fd, 'interval') || 1),
    type = str(fd, 'type');
  const cat = categories.find((c) => c.id === str(fd, 'category_id') && c.type === type),
    acct = accounts.find((a) => a.id === str(fd, 'account_id'));
  const today = manilaToday();
  if (!isDate(start) || start < addDays(today, -730) || start > addDays(today, 730))
    go('/settings', 'err', 'Start date must be within 2 years of today');
  if (
    amt === null ||
    !cat ||
    !acct ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 365 ||
    !['daily', 'weekly', 'monthly', 'yearly'].includes(str(fd, 'frequency'))
  )
    go('/settings', 'err', 'Check amount, start date, type/category, account and interval');
  const { error } = await sb.from('recurring_transactions').insert({
    user_id: user.id,
    account_id: acct.id,
    category_id: cat.id,
    type,
    amount_minor: amt,
    description: str(fd, 'description').slice(0, 120),
    frequency: str(fd, 'frequency'),
    interval_count: n,
    start_date: start,
    next_run_date: start,
  });
  if (error) go('/settings', 'err', safeMessage(error, 'createRecurring'));
  done();
  go('/settings', 'ok', 'Recurring rule added (runs when you open the dashboard)');
}

export async function deleteRecurring(fd: FormData) {
  const { sb } = await ctx();
  const { error } = await sb.from('recurring_transactions').delete().eq('id', str(fd, 'id'));
  if (error) go('/settings', 'err', 'Could not delete that rule. ' + safeMessage(error, 'deleteRecurring'));
  done();
  go('/settings', 'ok', 'Rule deleted (past transactions kept)');
}

export async function updateProfile(fd: FormData) {
  const { sb, user } = await ctx();
  const { error } = await sb
    .from('profiles')
    .update({ name: str(fd, 'name').slice(0, 60) })
    .eq('id', user.id);
  if (error) go('/settings', 'err', safeMessage(error, 'updateProfile'));
  go('/settings', 'ok', 'Profile saved');
}
