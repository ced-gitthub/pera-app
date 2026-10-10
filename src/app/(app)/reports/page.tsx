import Link from 'next/link';
import { ctx, loadLayout } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { periodFor } from '@/lib/range';
import { manilaToday, formatMinor } from '@/core/money';
import { totals, byCategory, type Tx } from '@/core/aggregate';
import Tab from '@/components/Tab';
import type { SP } from '@/components/ui';
const P = [['month', 'This month'], ['prev', 'Last month'], ['year', 'This year'], ['custom', 'Custom range']];
export default async function Reports({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, today = manilaToday(), per = periodFor(sp.p ?? 'month', today, sp.from, sp.to), year = Number(per.from.slice(0, 4)), { sb, user, categories, accounts } = await ctx();
  const ytdTo = today, [s, a, mo, ytd, layout] = await Promise.all([sb.rpc('period_summary', { p_from: per.from, p_to: per.to }), sb.rpc('account_spending', { p_from: per.from, p_to: per.to }), sb.rpc('monthly_summary', { p_year: year }), sb.rpc('period_summary', { p_from: `${today.slice(0, 4)}-01-01`, p_to: ytdTo }), loadLayout(sb, user.id)]);
  const bad = s.error ?? a.error ?? mo.error ?? ytd.error; if (bad) dbError(bad, 'reports');
  const cn = new Map(categories.map(c => [c.id, c.name])), an = new Map(accounts.map(x => [x.id, x.name])), mk = (rows: any[]): Tx[] => rows.map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: per.from }));
  const t = totals(mk(s.data)), y = totals(mk(ytd.data)), cats = byCategory(mk(s.data)), max = Math.max(1, ...(mo.data as any[]).map(r => Number(r.expense_minor)), ...(mo.data as any[]).map(r => Number(r.income_minor)));
  const M = new Map((mo.data as any[]).map(r => [r.month, r])), tot = (k: 'income_minor' | 'expense_minor') => (mo.data as any[]).reduce((n, r) => n + Number(r[k]), 0);
  const nodes = {
    period: <><div className="pills">{P.map(([k, n]) => <Link key={k} href={`/reports?p=${k}`} className={`btn ${(sp.p ?? 'month') === k ? 'p' : ''}`}>{n}</Link>)}</div>
      {sp.p === 'custom' && <form className="row mb-3"><input type="hidden" name="p" value="custom" /><input className="inp" type="date" name="from" defaultValue={sp.from} aria-label="From" /><input className="inp" type="date" name="to" defaultValue={sp.to} aria-label="To" /><button className="btn">Show range</button></form>}
      <div className="stats"><div className="stat i"><div className="m">Income</div><div className="big inc">{formatMinor(t.income)}</div></div>
        <div className="stat e"><div className="m">Expenses</div><div className="big exp">{formatMinor(t.expense)}</div></div>
        <div className="stat n"><div className="m">Net</div><div className={`big ${t.net < 0 ? 'exp' : ''}`}>{formatMinor(t.net)}</div></div></div>
      <p className="m" style={{ marginTop: -6, marginBottom: 14 }}>{per.label} · Year to date: income {formatMinor(y.income)}, expenses {formatMinor(y.expense)}, net {formatMinor(y.net)}</p></>,
    categories: <div className="card"><h2 className="font-semibold">Spending by category</h2>{cats.map(([n, v]) => <div key={n} className="row justify-between"><span>{n}</span><b>{formatMinor(v)}</b></div>)}{!cats.length && <p className="m">No expenses.</p>}</div>,
    byaccount: <div className="card"><h2 className="font-semibold">Spending by account</h2>{(a.data as any[]).map(r => <div key={r.account_id ?? 'none'} className="row justify-between"><span>{an.get(r.account_id) ?? 'No account'}</span><b>{formatMinor(Number(r.total_minor))}</b></div>)}{!(a.data as any[]).length && <p className="m">No expenses.</p>}</div>,
    monthly: <div className="card"><h2 className="font-semibold mb-2">{year} by month (trend & yearly overview)</h2><div className="scrollx"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Trend</th></tr></thead><tbody>
      {Array.from({ length: 12 }, (_, i) => { const r: any = M.get(i + 1), inc = Number(r?.income_minor ?? 0), exp = Number(r?.expense_minor ?? 0); return <tr key={i}><td>{String(i + 1).padStart(2, '0')}</td><td>{formatMinor(inc)}</td><td>{formatMinor(exp)}</td><td>{formatMinor(inc - exp)}</td><td className="w-40"><div className="bar"><i style={{ width: `${Math.round((exp * 100) / max)}%` }} /></div></td></tr>; })}
      <tr><td><b>Year</b></td><td><b>{formatMinor(tot('income_minor'))}</b></td><td><b>{formatMinor(tot('expense_minor'))}</b></td><td><b>{formatMinor(tot('income_minor') - tot('expense_minor'))}</b></td><td /></tr></tbody></table></div></div>,
  };
  return <Tab tab="reports" title="Reports" init={layout.reports} nodes={nodes} canCustomize />;
}
