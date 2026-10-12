'use server';
import { ctx } from '@/lib/data';
import { parseGoalForm } from '@/lib/goals';
import { safeMessage } from '@/lib/safe';
import { go, str, done, errCode } from './shared';

// Savings goals (see migration 0011). Progress is never stored: it is worked out from the connected account's balance or from income minus expenses since the goal began.
export async function createGoal(fd: FormData) {
  const { sb, user, accounts } = await ctx();
  const r = parseGoalForm(
    { name: str(fd, 'name'), emoji: str(fd, 'emoji'), amount: str(fd, 'amount'), account: str(fd, 'account') },
    accounts.map((a) => a.id),
  );
  if (!r.ok) go('/', 'err', r.message);
  const { error } = await sb.from('savings_goals').insert({ user_id: user.id, ...r.goal });
  if (error) go('/', 'err', errCode(error) === '23505' ? 'You already have a goal with that name.' : safeMessage(error, 'createGoal'));
  done();
  go('/', 'ok', 'Goal added. Every peso counts!');
}

export async function deleteGoal(fd: FormData) {
  const { sb } = await ctx();
  const id = str(fd, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) go('/', 'err', 'That goal no longer exists.');
  const { error } = await sb.from('savings_goals').delete().eq('id', id);
  if (error) go('/', 'err', safeMessage(error, 'deleteGoal'));
  done();
  go('/', 'ok', 'Goal removed. Your money and transactions are untouched.');
}
