import Link from 'next/link';
import { ctx } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { periodFor } from '@/lib/range';
import { manilaToday, formatMinor } from '@/core/money';
import { totals, byCategory, type Tx } from '@/core/aggregate';
import type { SP } from '@/components/ui';
const P = [['month', 'This month'], ['prev', 'Last month'], ['year', 'This year'], ['prevyear', 'Last year']];
export default async function Reports({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, today = manilaToday(), per = periodFor(sp.p ?? 'month', today, sp.from, sp.to), year = Number(per.from.slice(0, 4)), { sb, categories, accounts } = await ctx();
  const ytdTo = today, [s, a, mo, ytd] = await Promise.all([sb.rpc('period_summary', { p_from: per.from, p_to: per.to }), sb.rpc('account_spending', { p_from: per.from, p_to: per.to }), sb.rpc('monthly_summary', { p_year: year }), sb.rpc('period_summary', { p_from: `${today.slice(0, 4)}-01-01`, p_to: ytdTo })]);
  const bad = s.error ?? a.error ?? mo.error ?? ytd.error; if (bad) dbError(bad, 'reports');
  const cn = new Map(categories.map(c => [c.id, c.name])), an = new Map(accounts.map(x => [x.id, x.name])), mk = (rows: any[]): Tx[] => rows.map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: per.from }));
  const t = totals(mk(s.data)), y = totals(mk(ytd.data)), cats = byCategory(mk(s.data)), max = Math.max(1, ...(mo.data as any[]).map(r => Number(r.expense_minor)), ...(mo.data as any[]).map(r => Number(r.income_minor)));
  const M = new Map((mo.data as any[]).map(r => [r.month, r])), tot = (k: 'income_minor' | 'expense_minor') => (mo.data as any[]).reduce((n, r) => n + Number(r[k]), 0);
  return <><div className="row mb-3">{P.map(([k, n]) => <Link key={k} href={`/reports?p=${k}`} className={`btn ${(sp.p ?? 'month') === k ? 'p' : ''}`}>{n}</Link>)}<form className="row"><input type="hidden" name="p" value="custom" /><input className="inp" type="date" name="from" defaultValue={sp.from} /><input className="inp" type="date" name="to" defaultValue={sp.to} /><button className="btn">Custom</button></form></div>
    <div className="card"><h1 className="text-xl font-semibold">{per.label}</h1><p>Income {formatMinor(t.income)} · Expenses {formatMinor(t.expense)} · Net <b>{formatMinor(t.net)}</b></p><p className="m">Year to date: income {formatMinor(y.income)}, expenses {formatMinor(y.expense)}, net {formatMinor(y.net)}</p></div>
    <div className="card"><h2 className="font-semibold">Category breakdown</h2>{cats.map(([n, v]) => <div key={n} className="row justify-between"><span>{n}</span><b>{formatMinor(v)}</b></div>)}{!cats.length && <p className="m">No expenses.</p>}</div>
    <div className="card"><h2 className="font-semibold">Spending by account</h2>{(a.data as any[]).map(r => <div key={r.account_id} className="row justify-between"><span>{an.get(r.account_id) ?? '—'}</span><b>{formatMinor(Number(r.total_minor))}</b></div>)}</div>
    <div className="card"><h2 className="font-semibold mb-2">{year} by month (trend & yearly overview)</h2><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Trend</th></tr></thead><tbody>
      {Array.from({ length: 12 }, (_, i) => { const r: any = M.get(i + 1), inc = Number(r?.income_minor ?? 0), exp = Number(r?.expense_minor ?? 0); return <tr key={i}><td>{String(i + 1).padStart(2, '0')}</td><td>{formatMinor(inc)}</td><td>{formatMinor(exp)}</td><td>{formatMinor(inc - exp)}</td><td className="w-40"><div className="bar"><i style={{ width: `${Math.round((exp * 100) / max)}%` }} /></div></td></tr>; })}
      <tr><td><b>Year</b></td><td><b>{formatMinor(tot('income_minor'))}</b></td><td><b>{formatMinor(tot('expense_minor'))}</b></td><td><b>{formatMinor(tot('income_minor') - tot('expense_minor'))}</b></td><td /></tr></tbody></table></div></>;
}
