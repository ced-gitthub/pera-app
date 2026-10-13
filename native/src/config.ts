import { supabase } from './supabase';
import { cleanName } from './logic';

// Writes behind the per-tab settings. Every one returns null on success or a message that says what happened. RLS limits all of them to the owner.
const FAIL = 'Not saved: the server refused it or could not be reached. Try again.';

export async function setAccountFlag(id: string, field: 'counts_as_savings' | 'show_on_home', on: boolean): Promise<string | null> {
  const { error } = await supabase
    .from('accounts')
    .update({ [field]: on })
    .eq('id', id);
  return error ? FAIL : null;
}

export async function deleteBudget(id: string): Promise<string | null> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  return error ? FAIL : null;
}

export async function deleteGoal(id: string): Promise<string | null> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', id);
  return error ? FAIL : null;
}

export async function saveName(raw: string): Promise<string | null> {
  const n = cleanName(raw);
  if (!n.ok) return n.message;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  const { error } = await supabase.from('profiles').update({ name: n.name }).eq('id', u.user.id);
  return error ? FAIL : null;
}
