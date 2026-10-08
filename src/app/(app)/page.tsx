import Link from 'next/link';
import { ctx } from '@/lib/data';
import { periodFor, monthRange } from '@/lib/range';
import { manilaToday, formatMinor, addDays } from '@/core/money';
import { totals, byCategory, budgetStatus, type Tx } from '@/core/aggregate';
import { emojiFor, greetingFor, manilaHour, streak, pulse } from '@/lib/vibe';
import Quick from '@/components/Quick';
import TxRow, { type R } from '@/components/TxRow';
import { Flash, type SP } from '@/components/ui';
const P = [['month', 'This month'], ['prev', 'Last month'], ['year', 'This year'], ['prevyear', 'Last year']];
export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, { sb, user, categories, accounts } = await ctx(), today = manilaToday();
  await sb.rpc('run_recurring', { p_today: today }); // idempotent; creates any due recurring transactions
  const per = periodFor(sp.p ?? 'month', today, sp.from, sp.to), ym = today.slice(0, 7), mr = monthRange(ym), [yy, mm] = ym.split('-').map(Number);
  const [s, b, r, d, bud, ms, prof] = await Promise.all([sb.rpc('period_summary', { p_from: per.from, p_to: per.to }), sb.rpc('account_balances'),
    sb.from('transactions').select('id,type,amount_minor,transaction_date,description,category_id,account_id,transfer_account_id').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    sb.from('transactions').select('transaction_date').gte('transaction_date', addDays(today, -60)).order('transaction_date', { ascending: false }).limit(2000),
    sb.from('budgets').select('category_id,amount_minor').eq('month', mm).eq('year', yy), sb.rpc('period_summary', { p_from: mr.from, p_to: mr.to }),
    sb.from('profiles').select('name').eq('id', user.id).maybeSingle()]);
  const bad = s.error ?? b.error ?? r.error ?? bud.error ?? ms.error; if (bad) throw new Error(bad.message);
  const cn = new Map(categories.map(c => [c.id, c.name])), an = new Map(accounts.map(a => [a.id, a.name]));
  const txs: Tx[] = (s.data as any[]).map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: per.from }));
  const t = totals(txs), cats = byCategory(txs), balance = (b.data as any[]).reduce((n, x) => n + Number(x.balance_minor), 0), max = cats[0]?.[1] ?? 1;
  const rows: R[] = (r.data as any[]).map(x => ({ id: x.id, type: x.type, amount_minor: Number(x.amount_minor), date: x.transaction_date, description: x.description, category: cn.get(x.category_id) ?? '', account: an.get(x.account_id) ?? '', to: an.get(x.transfer_account_id) ?? '' }));
  const st = streak(((d.data as any[]) ?? []).map(x => x.transaction_date as string), today), name = (prof.data as any)?.name || (user.email ?? '').split('@')[0] || 'there';
  const spentBy = new Map(((ms.data as any[]) ?? []).filter(x => x.type === 'expense').map(x => [x.category_id, Number(x.total_minor)]));
  const goals = ((bud.data as any[]) ?? []).map(x => { const spent = spentBy.get(x.category_id) ?? 0, bs = budgetStatus(Number(x.amount_minor), spent); return { id: x.category_id as string, name: cn.get(x.category_id) ?? 'Other', spent, ...bs }; }).sort((a, c) => c.usageTenths - a.usageTenths);
  const worst = goals[0], monthNet = ((ms.data as any[]) ?? []).reduce((n, x) => n + (x.type === 'income' ? Number(x.total_minor) : x.type === 'expense' ? -Number(x.total_minor) : 0), 0);
  return <><Flash sp={sp} />
    <section className="card hero" aria-label="Your balance">
      <p className="hi">{greetingFor(manilaHour())}, {name} 👋</p>
      <div className="m">Total balance</div><div className="big">{formatMinor(balance)}</div>
      <div className="row"><span className="chip">{monthNet >= 0 ? '▲' : '▼'} {formatMinor(Math.abs(monthNet))} this month</span>
        <span className={`chip ${st.n > 0 ? 'mango' : ''}`}>{st.n > 0 ? `🔥 ${st.n}-day streak` : '🔥 Log today to start a streak'}</span></div>
      <div className="dots" aria-label="Last 7 days">{st.week.map(w => <i key={w.d} className={w.on ? 'on' : ''} title={w.d}>{w.on ? '✓' : ''}</i>)}</div>
      <p className="m" style={{ marginTop: 10 }}>{st.loggedToday ? "Today's logged. Nice work!" : st.n > 0 ? 'Log something today to keep your streak alive.' : 'One quick entry starts it.'}</p>
    </section>
    <Quick />
    {goals.length > 0 ? <section className="card"><div className="row justify-between"><h2>Your budgets</h2><Link className="btn" href="/budgets">Manage</Link></div>
      <p className="m" style={{ marginBottom: 12 }}>{worst ? pulse(worst.usageTenths) : ''}</p>
      {goals.slice(0, 4).map(g => <div key={g.id} className="row" style={{ marginBottom: 12, flexWrap: 'nowrap' }}><span className="ava">{emojiFor(g.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="row justify-between" style={{ flexWrap: 'nowrap' }}><b>{g.name}</b><span className={g.state === 'over' ? 'exp' : 'm'}>{g.remaining >= 0 ? `${formatMinor(g.remaining)} left` : `${formatMinor(-g.remaining)} over`}</span></div>
          <div className={`bar ${g.state}`} role="progressbar" aria-label={`${g.name} budget used`} aria-valuenow={Math.min(100, Math.round(g.usageTenths / 10))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, g.usageTenths / 10)}%` }} /></div></div></div>)}</section>
      : <section className="card"><h2>Set your first budget 🎯</h2><p className="m" style={{ marginBottom: 12 }}>Pick a category and an amount. We'll show how much is left as you spend.</p><Link className="btn p" href="/budgets">Set a budget</Link></section>}
    <div className="pills">{P.map(([k, n]) => <Link key={k} href={`/?p=${k}`} className={`btn ${(sp.p ?? 'month') === k ? 'p' : ''}`}>{n}</Link>)}</div>
    <form className="row mb-3"><input type="hidden" name="p" value="custom" /><input className="inp" type="date" name="from" defaultValue={sp.from} aria-label="From" /><input className="inp" type="date" name="to" defaultValue={sp.to} aria-label="To" /><button className="btn">Show range</button></form>
    <div className="stats">
      <div className="stat i"><div className="m">Income</div><div className="big inc">{formatMinor(t.income)}</div></div>
      <div className="stat e"><div className="m">Spent</div><div className="big exp">{formatMinor(t.expense)}</div></div>
      <div className="stat n"><div className="m">Net</div><div className="big">{formatMinor(t.net)}</div></div></div>
    <p className="m" style={{ marginTop: -6, marginBottom: 14 }}>{per.label}</p>
    <section className="card"><h2>Where your money went</h2>{cats.length ? cats.map(([n, v]) => <div key={n} className="row" style={{ marginBottom: 12, flexWrap: 'nowrap' }}><span className="ava">{emojiFor(n)}</span><div style={{ flex: 1, minWidth: 0 }}><div className="row justify-between" style={{ flexWrap: 'nowrap' }}><b>{n}</b><b>{formatMinor(v)}</b></div><div className="bar"><i style={{ width: `${Math.round((v * 100) / max)}%` }} /></div></div></div>) : <p className="m">No spending recorded this period.</p>}</section>
    <section className="card"><div className="row justify-between"><h2>Recent</h2><Link className="btn" href="/transactions">See all</Link></div><table><tbody>{rows.map(x => <TxRow key={x.id} r={x} actions={false} />)}</tbody></table>{!rows.length && <p className="m">No transactions yet. Try “lunch 150 gcash” above.</p>}</section></>;
}
