import { supabase } from './supabase';
import { manilaToday } from '../../src/core/money';
import { MAX_RULES, recurringError, type RuleRow } from './recurringLogic';

export type Rule = {
  id: string;
  account_id: string;
  category_id: string;
  type: 'income' | 'expense';
  amount_minor: number;
  description: string;
  frequency: string;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  active: boolean;
};

const COLS = 'id,account_id,category_id,type,amount_minor,description,frequency,interval_count,start_date,end_date,next_run_date,active';

export async function listRules(): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(MAX_RULES);
  if (error) throw new Error('Could not load your recurring rules. Check your connection.');
  return (data ?? []).map((x) => ({ ...(x as unknown as Rule), amount_minor: Number(x.amount_minor) }));
}

// Retry-safe: the row id is made once per form, so sending the same rule twice saves it once (a duplicate id means it already saved).
export async function createRule(row: RuleRow): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  const { error } = await supabase.from('recurring_transactions').insert({ ...row, user_id: u.user.id });
  if (error && error.code === '23505') return null;
  return recurringError(error);
}

export async function setRuleActive(id: string, active: boolean): Promise<string | null> {
  const { error } = await supabase.from('recurring_transactions').update({ active }).eq('id', id);
  return error ? 'Could not change that rule. Check your connection and try again.' : null;
}

// Entries the rule already made stay (their link to the rule is cleared by the database, not deleted).
export async function deleteRule(id: string): Promise<string | null> {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  return error ? 'Could not delete that rule. Check your connection and try again.' : null;
}

// Makes every entry that is due up to today (Manila). Safe to run again: it never makes the same entry twice.
export async function runDue(): Promise<{ created: number; error: string | null }> {
  const { data, error } = await supabase.rpc('run_recurring', { p_today: manilaToday() });
  if (error) return { created: 0, error: 'Could not run your recurring rules right now. Try again in a moment.' };
  return { created: Number(data ?? 0), error: null };
}
