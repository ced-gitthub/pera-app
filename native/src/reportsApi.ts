import { supabase } from './supabase';
import { monthBounds, type MonthRow, type SummaryRow } from './reportsLogic';

const FAIL = 'Could not load your reports. Check your connection and try again.';

// Same database functions the website's Reports page uses (security invoker, so row security applies). Errors are replaced with a plain message.
export async function loadMonthSummary(ym: string): Promise<SummaryRow[]> {
  const { from, to } = monthBounds(ym);
  const { data, error } = await supabase.rpc('period_summary', { p_from: from, p_to: to });
  if (error || !Array.isArray(data)) throw new Error(FAIL);
  return data as SummaryRow[];
}

export async function loadYearMonths(year: number): Promise<MonthRow[]> {
  const { data, error } = await supabase.rpc('monthly_summary', { p_year: year });
  if (error || !Array.isArray(data)) throw new Error(FAIL);
  return data as MonthRow[];
}
