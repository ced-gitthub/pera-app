import Link from 'next/link';
import { ctx } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { saveBudgetRow, deleteCategory, moveCategory, createCategory } from '@/app/actions';
import { isYm, monthRange, shiftYm } from '@/lib/range';
import { manilaToday, formatMinor } from '@/core/money';
import { budgetStatus, pctLabel } from '@/core/aggregate';
import { minorToInput } from '@/lib/validate';
import Tab from '@/components/Tab';
import { Flash, type SP } from '@/components/ui';
import { emojiFor } from '@/lib/vibe';
export default async function Budgets({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, ym = isYm(sp.ym) ? sp.ym : manilaToday().slice(0, 7), { from, to } = monthRange(ym), [y, m] = ym.split('-').map(Number);
  const { sb, categories } = await ctx(), [bud, sum] = await Promise.all([sb.from('budgets').select('category_id,amount_minor').eq('month', m).eq('year', y), sb.rpc('period_summary', { p_from: from, p_to: to })]);
  if (bud.error || sum.error) dbError(bud.error ?? sum.error, 'budgets');
  const budget = new Map((bud.data as any[]).map(b => [b.category_id, Number(b.amount_minor)])), spent = new Map((sum.data as any[]).filter(x => x.type === 'expense').map(x => [x.category_id, Number(x.total_minor)]));
  const exp = categories.filter(c => c.type === 'expense');
  const before = <><Flash sp={sp} /><div className="card"><div className="row mb-3"><Link className="btn" href={`/budgets?ym=${shiftYm(ym, -1)}`} aria-label="Previous month">←</Link><h2 style={{ margin: 0 }}>{ym}</h2><Link className="btn" href={`/budgets?ym=${shiftYm(ym, 1)}`} aria-label="Next month">→</Link></div>
    {exp.map((c, i) => { const b = budget.get(c.id), s = spent.get(c.id) ?? 0, st = b !== undefined ? budgetStatus(b, s) : null;
      return <div key={c.id} className="mb-3">
        <div className="row view-only"><b className="w-40">{emojiFor(c.name)} {c.name}</b><span className="m">{b !== undefined ? `Budget ${formatMinor(b)}` : 'No budget set'}</span></div>
        <form className="edit-only editf" aria-label={`Edit ${c.name}`}><input type="hidden" name="ym" value={ym} /><input type="hidden" name="category_id" value={c.id} /><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value="/budgets" />
          <div className="row"><input className="inp" name="name" defaultValue={c.name} maxLength={40} aria-label="Category name" /><input className="inp w-32" name="amount" defaultValue={b !== undefined ? minorToInput(b) : ''} placeholder="Budget ₱" inputMode="decimal" aria-label={`Budget for ${c.name}`} /></div>
          <div className="row"><button className="btn p" formAction={saveBudgetRow}>Save</button><button className="btn" formAction={moveCategory.bind(null, c.id, 'up')} disabled={i === 0} aria-label={`Move ${c.name} up`}>↑</button><button className="btn" formAction={moveCategory.bind(null, c.id, 'down')} disabled={i === exp.length - 1} aria-label={`Move ${c.name} down`}>↓</button><button className="btn" formAction={deleteCategory}>Delete</button></div></form>
        {st && <><div className={`bar mt-1 ${st.state}`}><i style={{ width: `${Math.min(100, st.usageTenths / 10)}%` }} /></div>
          <div className="m">{formatMinor(s)} spent · {formatMinor(st.remaining)} remaining · {pctLabel(st.usageTenths)} {st.state === 'over' ? '· over budget' : st.state === 'near' ? '· close to the limit' : '· on track'}</div></>}
        {!st && s > 0 && <div className="m">{formatMinor(s)} spent (no budget set)</div>}</div>; })}</div>
    <form action={createCategory} className="card row edit-only editf" aria-label="New category"><input type="hidden" name="back" value="/budgets" /><input type="hidden" name="type" value="expense" /><b>New category</b><input className="inp" name="name" placeholder="Name" required maxLength={40} aria-label="New category name" /><button className="btn p">Add</button></form></>;
  return <Tab tab="budgets" title="Budgets" before={before} canEdit />;
}
