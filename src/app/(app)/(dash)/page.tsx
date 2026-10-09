import Link from 'next/link';
import { ctx, loadLayout, balanceMap } from '@/lib/data';
import { dbError, logErr } from '@/lib/safe';
import { periodFor, monthRange } from '@/lib/range';
import { manilaToday, formatMinor, addDays } from '@/core/money';
import { totals, byCategory, budgetStatus, type Tx } from '@/core/aggregate';
import { homeNumbers } from '@/lib/balances';
import { mapRows } from '@/lib/rows';
import { emojiFor, greetingFor, manilaHour, streak, pulse } from '@/lib/vibe';
import Quick from '@/components/Quick';
import Tab from '@/components/Tab';
import TxRow from '@/components/TxRow';
import { Flash, type SP } from '@/components/ui';
const P = [['month', 'This month'], ['prev', 'Last month'], ['year', 'This year'], ['custom', 'Custom range']];
const HIST_MAX = 20; // History can show 5, 6, 10 or 20; the page loads 20 and the layout decides how many are drawn
export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, { sb, user, categories, accounts } = await ctx(), today = manilaToday();
  const rr = await sb.rpc('run_recurring', { p_today: today }); // idempotent; creates any due recurring transactions
  if (rr.error) logErr('run_recurring', rr.error); // never shown raw; the dashboard shows a safe notice instead
  const per = periodFor(sp.p ?? 'month', today, sp.from, sp.to), ym = today.slice(0, 7), mr = monthRange(ym), [yy, mm] = ym.split('-').map(Number);
  const [s, bal, na, r, d, bud, ms, prof, layout] = await Promise.all([sb.rpc('period_summary', { p_from: per.from, p_to: per.to }), balanceMap(sb), sb.rpc('no_account_summary'),
    sb.from('transactions').select('id,type,amount_minor,transaction_date,description,category_id,account_id,transfer_account_id').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(HIST_MAX),
    sb.from('transactions').select('transaction_date').gte('transaction_date', addDays(today, -60)).order('transaction_date', { ascending: false }).limit(2000),
    sb.from('budgets').select('category_id,amount_minor').eq('month', mm).eq('year', yy), sb.rpc('period_summary', { p_from: mr.from, p_to: mr.to }),
    sb.from('profiles').select('name').eq('id', user.id).maybeSingle(), loadLayout(sb, user.id)]);
  const bad = s.error ?? na.error ?? r.error ?? bud.error ?? ms.error; if (bad) dbError(bad, 'dashboard');
  const cn = new Map(categories.map(c => [c.id, c.name]));
  const txs: Tx[] = (s.data as any[]).map(x => ({ type: x.type, amount_minor: Number(x.total_minor), category: cn.get(x.category_id) ?? 'Other', date: per.from }));
  const t = totals(txs), cats = byCategory(txs), max = cats[0]?.[1] ?? 1, noAcct = (na.data as any[])?.[0] ?? { balance_minor: 0, n: 0 };
  const nums = homeNumbers(accounts, id => bal.get(id) ?? 0, Number(noAcct.balance_minor)); // every account counts here, whatever "Show on Home" says
  const rows = mapRows(r.data as any[], cn, accounts);
  const st = streak(((d.data as any[]) ?? []).map(x => x.transaction_date as string), today), name = (prof.data as any)?.name || (user.email ?? '').split('@')[0] || 'there';
  const spentBy = new Map(((ms.data as any[]) ?? []).filter(x => x.type === 'expense').map(x => [x.category_id, Number(x.total_minor)]));
  const goals = ((bud.data as any[]) ?? []).map(x => { const spent = spentBy.get(x.category_id) ?? 0, bs = budgetStatus(Number(x.amount_minor), spent); return { id: x.category_id as string, name: cn.get(x.category_id) ?? 'Other', spent, ...bs }; }).sort((a, c) => c.usageTenths - a.usageTenths);
  const worst = goals[0], monthNet = ((ms.data as any[]) ?? []).reduce((n, x) => n + (x.type === 'income' ? Number(x.total_minor) : x.type === 'expense' ? -Number(x.total_minor) : 0), 0);
  const amt = (m: number) => <span className={m < 0 ? 'exp' : ''}>{formatMinor(m)}</span>;
  const nodes = {
    accounts: <section className="card" aria-label="Accounts"><h2>Accounts</h2>
      {accounts.filter(a => a.show_on_home).map(a => <div key={a.id} className="arow"><span>{a.name}</span><b>{amt(bal.get(a.id) ?? 0)}</b></div>)}
      {Number(noAcct.n) > 0 && <div className="arow"><span>No account</span><b>{amt(Number(noAcct.balance_minor))}</b></div>}
      {!accounts.some(a => a.show_on_home) && Number(noAcct.n) === 0 && <p className="m">No accounts to show. <Link href="/accounts">Manage accounts</Link></p>}</section>,
    spendable: <div className="stat n tile" aria-label="Spendable balance"><div className="m">Spendable balance</div><div className="big">{amt(nums.spendable)}</div></div>,
    savings: <div className="stat tile" aria-label="Savings (not included)"><div className="m">Savings (not included)</div><div className="big">{amt(nums.savings)}</div></div>,
    history: <section className="card"><div className="row justify-between"><h2>History</h2><Link className="btn" href="/transactions">See all</Link></div><div className="hist"><table><tbody>{rows.map(x => <TxRow key={x.id} r={x} actions={false} />)}</tbody></table></div>{!rows.length && <p className="m">No transactions yet. Try “lunch 150 gcash” above.</p>}</section>,
    period: <><div className="pills">{P.map(([k, n]) => <Link key={k} href={`/?p=${k}`} className={`btn ${(sp.p ?? 'month') === k ? 'p' : ''}`}>{n}</Link>)}</div>
      {sp.p === 'custom' && <form className="row mb-3"><input type="hidden" name="p" value="custom" /><input className="inp" type="date" name="from" defaultValue={sp.from} aria-label="From" /><input className="inp" type="date" name="to" defaultValue={sp.to} aria-label="To" /><button className="btn">Show range</button></form>}
      <div className="stats"><div className="stat i"><div className="m">Income</div><div className="big inc">{formatMinor(t.income)}</div></div>
        <div className="stat e"><div className="m">Expenses</div><div className="big exp">{formatMinor(t.expense)}</div></div>
        <div className="stat n"><div className="m">Net</div><div className="big">{amt(t.net)}</div></div></div>
      <p className="m" style={{ marginTop: -6, marginBottom: 14 }}>{per.label}</p></>,
    categories: <section className="card"><h2>Where your money went</h2>{cats.length ? cats.map(([n, v]) => <div key={n} className="row" style={{ marginBottom: 12, flexWrap: 'nowrap' }}><span className="ava">{emojiFor(n)}</span><div style={{ flex: 1, minWidth: 0 }}><div className="row justify-between" style={{ flexWrap: 'nowrap' }}><b>{n}</b><b>{formatMinor(v)}</b></div><div className="bar"><i style={{ width: `${Math.round((v * 100) / max)}%` }} /></div></div></div>) : <p className="m">No spending recorded this period.</p>}</section>,
    budgets: goals.length > 0 ? <section className="card"><div className="row justify-between"><h2>Your budgets</h2><Link className="btn" href="/budgets">Manage</Link></div>
      <p className="m" style={{ marginBottom: 12 }}>{worst ? pulse(worst.usageTenths) : ''}</p>
      {goals.slice(0, 4).map(g => <div key={g.id} className="row" style={{ marginBottom: 12, flexWrap: 'nowrap' }}><span className="ava">{emojiFor(g.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="row justify-between" style={{ flexWrap: 'nowrap' }}><b>{g.name}</b><span className={g.state === 'over' ? 'exp' : 'm'}>{g.remaining >= 0 ? `${formatMinor(g.remaining)} left` : `${formatMinor(-g.remaining)} over`}</span></div>
          <div className={`bar ${g.state}`} role="progressbar" aria-label={`${g.name} budget used`} aria-valuenow={Math.min(100, Math.round(g.usageTenths / 10))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, g.usageTenths / 10)}%` }} /></div></div></div>)}</section> : null,
  };
  const before = <><Flash sp={sp} />
    {rr.error && <p className="flash bad" role="alert">Some recurring items couldn't be processed right now. Your data is safe; Pera will try again next time you open it.</p>}
    <section className="card hero" aria-label="Your balance">
      <p className="hi">{greetingFor(manilaHour())}, {name} 👋</p>
      <div className="m">Total balance</div><div className="big">{formatMinor(nums.total)}</div>
      <div className="row"><span className="chip">{monthNet >= 0 ? '▲' : '▼'} {formatMinor(Math.abs(monthNet))} this month</span>
        <span className={`chip ${st.n > 0 ? 'mango' : ''}`}>{st.n > 0 ? `🔥 ${st.n}-day streak` : '🔥 Log today to start a streak'}</span></div>
      <div className="dots" aria-label="Last 7 days">{st.week.map(w => <i key={w.d} className={w.on ? 'on' : ''} title={w.d}>{w.on ? '✓' : ''}</i>)}</div>
      <p className="m" style={{ marginTop: 10 }}>{st.loggedToday ? "Today's logged. Nice work!" : st.n > 0 ? 'Log something today to keep your streak alive.' : 'One quick entry starts it.'}</p>
    </section>
    <Quick /></>;
  return <Tab tab="home" title="Home" init={layout.home} nodes={nodes} before={before} canCustomize />;
}
