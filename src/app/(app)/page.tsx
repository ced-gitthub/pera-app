import Link from 'next/link';
import { ctx } from '@/lib/data';
import { periodFor } from '@/lib/range';
import { manilaToday, formatMinor } from '@/core/money';
import { totals, byCategory, type Tx } from '@/core/aggregate';
import Quick from '@/components/Quick';
import TxRow, { type R } from '@/components/TxRow';
import { Flash, type SP } from '@/components/ui';
const P = [['month', 'This month'], ['prev', 'Last month'], ['year', 'This year'], ['prevyear', 'Last year']];
export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, { sb, categories, accounts } = await ctx(), today = manilaToday();
  await sb.rpc('run_recurring', { p_today: today }); // idempotent; creates any due recurring transactions
  const per = periodFor(sp.p ?? 'month', today, sp.from, sp.to);
  const [s, b, r] = await Promise.all([sb.rpc('period_summary', { p_from: per.from, p_to: per.to }), sb.rpc('account_balances'),
    sb.from('transactions').select('id,type,amount_minor,transaction_date,description,category_id,account_id,transfer_account_id').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(8)]);
  const bad = s.error ?? b.error ?? r.error; if (bad) throw new Error(bad.message);
  const cn = new Map(categories.map(c => [c.id, c.name])), an = new Map(accounts.map(a => [a.id, a.name]));
  const txs: Tx[] = (s.data as any[]).map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: per.from }));
  const t = totals(txs), cats = byCategory(txs), balance = (b.data as any[]).reduce((n, x) => n + Number(x.balance_minor), 0), max = cats[0]?.[1] ?? 1;
  const rows: R[] = (r.data as any[]).map(x => ({ id: x.id, type: x.type, amount_minor: Number(x.amount_minor), date: x.transaction_date, description: x.description, category: cn.get(x.category_id) ?? '', account: an.get(x.account_id) ?? '', to: an.get(x.transfer_account_id) ?? '' }));
  return <><Flash sp={sp} /><Quick />
    <div className="row mb-3">{P.map(([k, n]) => <Link key={k} href={`/?p=${k}`} className={`btn ${(sp.p ?? 'month') === k ? 'p' : ''}`}>{n}</Link>)}
      <form className="row"><input type="hidden" name="p" value="custom" /><input className="inp" type="date" name="from" defaultValue={sp.from} /><input className="inp" type="date" name="to" defaultValue={sp.to} /><button className="btn">Custom</button></form></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="card stat"><div className="m">Current balance</div><div className="big text-2xl font-semibold">{formatMinor(balance)}</div></div>
      <div className="card stat"><div className="m">Income · {per.label}</div><div className="big text-2xl font-semibold inc">{formatMinor(t.income)}</div></div>
      <div className="card stat"><div className="m">Expenses</div><div className="big text-2xl font-semibold exp">{formatMinor(t.expense)}</div></div>
      <div className="card stat"><div className="m">Net</div><div className="big text-2xl font-semibold">{formatMinor(t.net)}</div></div></div>
    <div className="card"><h2 className="font-semibold mb-2">Spending by category</h2>{cats.length ? cats.map(([n, v]) => <div key={n} className="mb-2"><div className="row justify-between"><span>{n}</span><b>{formatMinor(v)}</b></div><div className="bar"><i style={{ width: `${Math.round((v * 100) / max)}%` }} /></div></div>) : <p className="m">No expenses in this period.</p>}</div>
    <div className="card"><h2 className="font-semibold mb-2">Recent transactions</h2><table><tbody>{rows.map(x => <TxRow key={x.id} r={x} actions={false} />)}</tbody></table>{!rows.length && <p className="m">Nothing yet — type something above.</p>}</div></>;
}
