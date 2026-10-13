import { supabase } from './supabase';
import { manilaToday } from '../../src/core/money';
import { goalProgress } from '../../src/lib/goals';
import { monthRange, budgetProgress, type Snapshot, type Tx } from './logic';

export async function loadActivity(): Promise<Tx[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id,type,amount_minor,description,transaction_date,category_id,account_id')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Could not load your activity. Check your connection.');
  return data as Tx[];
}

export type BudgetRow = { id: string; name: string; limit: number; spent: number } & ReturnType<typeof budgetProgress>;
export async function loadBudgets(s: Snapshot): Promise<BudgetRow[]> {
  const r = monthRange(manilaToday());
  const { data, error } = await supabase.from('budgets').select('id,category_id,amount_minor').eq('month', r.month).eq('year', r.year);
  if (error) throw new Error('Could not load your budgets. Check your connection.');
  return Promise.all(
    (data ?? []).map(async (b) => {
      const { data: sum, error: e2 } = await supabase.rpc('sum_expense', { p_from: r.from, p_to: r.to, p_category: b.category_id });
      if (e2) throw new Error('Could not load your budgets. Check your connection.');
      const limit = Number(b.amount_minor),
        spent = Number(sum ?? 0);
      return {
        id: b.id,
        name: s.categories.find((c) => c.id === b.category_id)?.name ?? 'Category',
        limit,
        spent,
        ...budgetProgress(limit, spent),
      };
    }),
  );
}

export type GoalRow = { id: string; name: string; emoji: string; target: number } & ReturnType<typeof goalProgress>;
export async function loadGoals(s: Snapshot): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id,name,emoji,target_minor,account_id,started_on')
    .order('created_at');
  if (error) throw new Error('Could not load your goals. Check your connection.');
  return Promise.all(
    (data ?? []).map(async (g) => {
      let have: number;
      if (g.account_id) have = s.balances[g.account_id] ?? 0;
      else {
        // not connected: income minus expenses since the goal started (transfers ignored), capped at 5,000 rows
        const { data: tx } = await supabase
          .from('transactions')
          .select('type,amount_minor')
          .gte('transaction_date', g.started_on)
          .neq('type', 'transfer')
          .limit(5000);
        have = (tx ?? []).reduce((a, t) => a + (t.type === 'income' ? 1 : -1) * Number(t.amount_minor), 0);
      }
      const target = Number(g.target_minor);
      return { id: g.id, name: g.name, emoji: g.emoji, target, ...goalProgress(target, have) };
    }),
  );
}
