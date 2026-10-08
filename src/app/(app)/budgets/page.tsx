import Link from 'next/link';
import { ctx } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { setBudget } from '@/app/actions';
import { isYm, monthRange, shiftYm } from '@/lib/range';
import { manilaToday, formatMinor } from '@/core/money';
import { budgetStatus, pctLabel } from '@/core/aggregate';
import { minorToInput } from '@/lib/validate';
import { Flash, type SP } from '@/components/ui';
import { emojiFor } from '@/lib/vibe';
export default async function Budgets({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, ym = isYm(sp.ym) ? sp.ym : manilaToday().slice(0, 7), { from, to } = monthRange(ym), [y, m] = ym.split('-').map(Number);
  const { sb, categories } = await ctx(), [bud, sum] = await Promise.all([sb.from('budgets').select('category_id,amount_minor').eq('month', m).eq('year', y), sb.rpc('period_summary', { p_from: from, p_to: to })]);
  if (bud.error || sum.error) dbError(bud.error ?? sum.error, 'budgets');
  const budget = new Map((bud.data as any[]).map(b => [b.category_id, Number(b.amount_minor)])), spent = new Map((sum.data as any[]).filter(x => x.type === 'expense').map(x => [x.category_id, Number(x.total_minor)]));
  return <><Flash sp={sp} /><div className="card"><div className="row mb-3"><Link className="btn" href={`/budgets?ym=${shiftYm(ym, -1)}`}>←</Link><h1 className="text-xl font-semibold">Budgets · {ym}</h1><Link className="btn" href={`/budgets?ym=${shiftYm(ym, 1)}`}>→</Link></div>
    {categories.filter(c => c.type === 'expense').map(c => { const b = budget.get(c.id), s = spent.get(c.id) ?? 0, st = b !== undefined ? budgetStatus(b, s) : null;
      return <form key={c.id} action={setBudget} className="mb-3"><input type="hidden" name="ym" value={ym} /><input type="hidden" name="category_id" value={c.id} />
        <div className="row"><b className="w-40">{emojiFor(c.name)} {c.name}</b><input className="inp w-32" name="amount" defaultValue={b !== undefined ? minorToInput(b) : ''} placeholder="Budget ₱" inputMode="decimal" /><button className="btn">Save</button></div>
        {st && <><div className={`bar mt-1 ${st.state}`}><i style={{ width: `${Math.min(100, st.usageTenths / 10)}%` }} /></div>
          <div className="m">{formatMinor(s)} spent · {formatMinor(st.remaining)} remaining · {pctLabel(st.usageTenths)} {st.state === 'over' ? '· over budget' : st.state === 'near' ? '· close to the limit' : '· on track'}</div></>}
        {!st && s > 0 && <div className="m">{formatMinor(s)} spent (no budget set)</div>}</form>; })}</div></>;
}
