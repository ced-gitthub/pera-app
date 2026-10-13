import Constants from 'expo-constants';
import { supabase } from './supabase';
import { manilaToday } from '../../src/core/money';
import { DATE_UNCONFIRMED, createRuleWith, deleteRuleWith, runDueWith, setRuleActiveWith, type Db } from './recurringCore';
import { MAX_RULES, manilaDateFromHttpDate, type RuleRow } from './recurringLogic';

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

const db = supabase as unknown as Db;

export async function createRule(row: RuleRow): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'Session expired. Please sign in again.';
  return createRuleWith(db, u.user.id, row);
}

// Pausing flips `active`. Resuming skips the dates missed while paused (see setRuleActiveWith).
export function setRuleActive(id: string, active: boolean): Promise<string | null> {
  return setRuleActiveWith(db, { id }, active, manilaToday());
}

export function deleteRule(id: string): Promise<string | null> {
  return deleteRuleWith(db, id);
}

const x = Constants.expoConfig?.extra as { supabaseUrl: string; supabasePublishableKey: string };
const CLOCK_TIMEOUT_MS = 8000;

// Today's date (Manila) according to the server, not the phone: a phone clock set ahead must not create future entries.
// A HEAD request to the REST root is tiny; its `Date` header is the server time. null when it cannot be read.
export async function serverToday(): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CLOCK_TIMEOUT_MS);
  try {
    const res = await fetch(`${x.supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: x.supabasePublishableKey },
      signal: ctl.signal,
    });
    const header = res.headers.get('date');
    return header ? manilaDateFromHttpDate(header) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Makes every entry that is due up to today (server date, Manila). Does nothing when the date cannot be confirmed.
export async function runDue(): Promise<{ created: number; error: string | null }> {
  const today = await serverToday();
  if (!today) return { created: 0, error: DATE_UNCONFIRMED };
  return runDueWith(db, today, manilaToday());
}
