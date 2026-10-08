import { notFound } from 'next/navigation';
import { ctx } from '@/lib/data';
import { updateTx } from '@/app/actions';
import { fmt } from '@/core/io';
import { Flash, type SP } from '@/components/ui';
export default async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params, sp = await searchParams, { sb, categories, accounts } = await ctx();
  const { data: t } = await sb.from('transactions').select('*').eq('id', id).maybeSingle(); if (!t) notFound();
  return <><Flash sp={sp} /><form action={updateTx} className="card grid gap-3 max-w-md"><h1 className="text-xl font-semibold">Edit transaction</h1><input type="hidden" name="id" value={t.id} />
    <label>Amount (₱)<input className="inp w-full" name="amount" defaultValue={fmt(Number(t.amount_minor))} required inputMode="decimal" /></label>
    {t.type === 'transfer' ? <><input type="hidden" name="type" value="transfer" /><label>To account<select className="inp w-full" name="to_id" defaultValue={t.transfer_account_id}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></>
      : <><label>Type<select className="inp w-full" name="type" defaultValue={t.type}><option value="income">Income</option><option value="expense">Expense</option></select></label>
        <label>Category (must match the type)<select className="inp w-full" name="category_id" defaultValue={t.category_id}>{categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}</select></label></>}
    <label>{t.type === 'transfer' ? 'From account' : 'Account'}<select className="inp w-full" name="account_id" defaultValue={t.account_id}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Date<input className="inp w-full" type="date" name="date" defaultValue={t.transaction_date} required /></label>
    <label>Description<input className="inp w-full" name="description" defaultValue={t.description} maxLength={120} /></label><label>Notes<textarea className="inp w-full" name="notes" defaultValue={t.notes} maxLength={500} /></label>
    <button className="btn p">Save</button></form></>;
}
