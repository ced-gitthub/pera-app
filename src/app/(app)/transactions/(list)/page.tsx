import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ctx } from '@/lib/data';
import { dbError, logErr } from '@/lib/safe';
import Quick from '@/components/Quick';
import TxRow, { type R } from '@/components/TxRow';
import { Flash, type SP } from '@/components/ui';
const SIZE = 25;
export default async function Tx({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams, U = /^[0-9a-f-]{36}$/i, D = /^\d{4}-\d\d-\d\d$/, sp: Record<string, string | undefined> = { ...raw, c: U.test(raw.c ?? '') ? raw.c : undefined, a: U.test(raw.a ?? '') ? raw.a : undefined, from: D.test(raw.from ?? '') ? raw.from : undefined, to: D.test(raw.to ?? '') ? raw.to : undefined, type: ['income', 'expense', 'transfer'].includes(raw.type ?? '') ? raw.type : undefined }, { sb, categories, accounts } = await ctx(), page = Math.max(1, Number(sp.page) || 1);
  const link = (p: number) => `/transactions?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page' && k !== 'err' && k !== 'ok')) as Record<string, string>), page: String(p) })}`;
  let q = sb.from('transactions').select('id,type,amount_minor,transaction_date,description,category_id,account_id,transfer_account_id', { count: 'exact' });
  if (sp.q) q = q.ilike('description', `%${sp.q.replace(/[^\p{L}\p{N} .&@#:/+-]/gu, ' ').replace(/-{2,}/g, ' ').slice(0, 60)}%`);
  if (sp.type) q = q.eq('type', sp.type); if (sp.c) q = q.eq('category_id', sp.c); if (sp.a) q = q.or(`account_id.eq.${sp.a},transfer_account_id.eq.${sp.a}`);
  if (sp.from) q = q.gte('transaction_date', sp.from); if (sp.to) q = q.lte('transaction_date', sp.to);
  const s = sp.s ?? 'dd';
  q = s === 'ah' || s === 'al' ? q.order('amount_minor', { ascending: s === 'al' }).order('transaction_date', { ascending: false }) : q.order('transaction_date', { ascending: s === 'da' }).order('created_at', { ascending: s === 'da' });
  let { data, count, error } = await q.range((page - 1) * SIZE, page * SIZE - 1) as { data: any[] | null; count: number | null; error: { code?: string } | null };
  if (error?.code === 'PGRST103') redirect(link(1)); // page number past the end: show the first page instead of an error
  let searchFailed = false; if (error && sp.q) { logErr('transactions search', error); searchFailed = true; data = []; count = 0; error = null; } // an odd search string must never take the page down
  if (error) dbError(error, 'transactions');
  const cn = new Map(categories.map(c => [c.id, c.name])), an = new Map(accounts.map(a => [a.id, a.name])), pages = Math.max(1, Math.ceil((count ?? 0) / SIZE));
  const rows: R[] = (data as any[]).map(x => ({ id: x.id, type: x.type, amount_minor: Number(x.amount_minor), date: x.transaction_date, description: x.description, category: cn.get(x.category_id) ?? '', account: an.get(x.account_id) ?? '', to: an.get(x.transfer_account_id) ?? '' }));
  return <><Flash sp={sp} />{searchFailed && <p className="flash bad" role="alert">That search could not be run. Try different words.</p>}<Quick />
    <form className="card row" aria-label="Filters"><input className="inp" name="q" placeholder="Search description" defaultValue={sp.q} />
      <select className="inp" name="type" defaultValue={sp.type ?? ''}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option></select>
      <select className="inp" name="c" defaultValue={sp.c ?? ''}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="inp" name="a" defaultValue={sp.a ?? ''}><option value="">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input className="inp" type="date" name="from" defaultValue={sp.from} /><input className="inp" type="date" name="to" defaultValue={sp.to} />
      <select className="inp" name="s" defaultValue={s}><option value="dd">Newest</option><option value="da">Oldest</option><option value="ah">Highest</option><option value="al">Lowest</option></select><button className="btn p">Apply</button><Link href="/transactions" className="btn">Clear</Link></form>
    <div className="card"><table><tbody>{rows.map(x => <TxRow key={x.id} r={x} />)}</tbody></table>{!rows.length && <p className="m">No matching transactions.</p>}
      <div className="row mt-3"><span className="m">{count ?? 0} total · page {page} of {pages}</span>{page > 1 && <Link className="btn" href={link(page - 1)}>Previous</Link>}{page < pages && <Link className="btn" href={link(page + 1)}>Next</Link>}</div></div></>;
}
