import { supabase } from './supabase';
import { parseGoalForm, type GoalInput } from '../../src/lib/goals';
import { load } from './data';
import { planBalances, planBudget, writeError, type Snapshot } from './logic';

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

export async function saveBalances(typed: Record<string, string>): Promise<string | null> {
  // Re-read just before computing: the stored opening is typed minus the movement logged so far, and an entry may have landed since the screen loaded.
  const fresh = await load().catch(() => null);
  if (!fresh) return FAIL;
  const plan = planBalances(typed, fresh);
  if (!plan.ok) return plan.message;
  // all the account updates go out together (not one after another); an honest message if only some were saved
  const results = await Promise.all(plan.patch.map((p) => supabase.from('accounts').update({ opening_balance_minor: p.v }).eq('id', p.id)));
  const failed = results.filter((r) => r.error).length;
  if (failed === results.length && failed > 0) return FAIL;
  if (failed > 0) return `Saved ${results.length - failed} of ${results.length} accounts. Press Save again for the rest.`;
  return null;
}

export async function saveBudget(categoryId: string, amount: string, s: Snapshot): Promise<string | null> {
  const plan = planBudget(categoryId, amount, s);
  if (!plan.ok) return plan.message;
  const { data: u } = await supabase.auth.getSession();
  if (!u.session) return 'Session expired. Please sign in again.';
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: u.session.user.id, ...plan.row }, { onConflict: 'user_id,category_id,month,year' });
  return writeError(error, 'budget');
}

// strict: a duplicate name is an error (adding from the Goals tab). The wizard step treats "already exists" as done, because the goal is there either way.
export async function saveGoal(i: GoalInput, s: Snapshot, strict = false): Promise<string | null> {
  const p = parseGoalForm(
    i,
    s.accounts.map((a) => a.id),
  );
  if (!p.ok) return p.message;
  const { data: u } = await supabase.auth.getSession();
  if (!u.session) return 'Session expired. Please sign in again.';
  const { error } = await supabase.from('savings_goals').insert({ user_id: u.session.user.id, ...p.goal });
  if (error && !strict && (error as { code?: string }).code === '23505') return null;
  return writeError(error, 'goal', p.goal.name);
}

export async function updateGoal(id: string, i: GoalInput, s: Snapshot): Promise<string | null> {
  const p = parseGoalForm(
    i,
    s.accounts.map((a) => a.id),
  );
  if (!p.ok) return p.message;
  const { error } = await supabase.from('savings_goals').update(p.goal).eq('id', id);
  return writeError(error, 'goal', p.goal.name);
}
