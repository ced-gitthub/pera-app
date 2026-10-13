import { supabase } from './supabase';
import { parseGoalForm, type GoalInput } from '../../src/lib/goals';
import { planBalances, planBudget, type Snapshot } from './logic';

// Real counts decide which wizard steps are done. Any read error throws, and the caller then lets the person in (fail open).
export async function loadCounts() {
  const n = async (t: string) => {
    const { count, error } = await supabase.from(t).select('id', { count: 'exact', head: true });
    if (error || count === null) throw new Error('count');
    return count;
  };
  const [totalEntries, budgetsCount, goalsCount] = await Promise.all([n('transactions'), n('budgets'), n('savings_goals')]);
  return { totalEntries, budgetsCount, goalsCount };
}

const FAIL = 'Not saved: the server refused it or could not be reached. Try again.';

export async function saveBalances(typed: Record<string, string>, s: Snapshot): Promise<string | null> {
  const plan = planBalances(typed, s);
  if (!plan.ok) return plan.message;
  for (const p of plan.patch) {
    const { error } = await supabase.from('accounts').update({ opening_balance_minor: p.v }).eq('id', p.id);
    if (error) return FAIL;
  }
  return null;
}

export async function saveBudget(categoryId: string, amount: string, s: Snapshot): Promise<string | null> {
  const plan = planBudget(categoryId, amount, s);
  if (!plan.ok) return plan.message;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: u.user.id, ...plan.row }, { onConflict: 'user_id,category_id,month,year' });
  return error ? FAIL : null;
}

export async function saveGoal(i: GoalInput, s: Snapshot): Promise<string | null> {
  const p = parseGoalForm(
    i,
    s.accounts.map((a) => a.id),
  );
  if (!p.ok) return p.message;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  const { error } = await supabase.from('savings_goals').insert({ user_id: u.user.id, ...p.goal });
  if (error && (error as { code?: string }).code === '23505') return null; // a goal with that name already exists: the step is done either way
  return error ? FAIL : null;
}
