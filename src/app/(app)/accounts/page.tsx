import { ctx } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { createAccount, updateAccount, deleteAccount, transfer } from '@/app/actions';
import { formatMinor, manilaToday } from '@/core/money';
import { minorToInput } from '@/lib/validate';
import { Flash, type SP } from '@/components/ui';
const TYPES = ['cash', 'ewallet', 'bank', 'credit_card', 'savings', 'other'];
export default async function Accounts({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, { sb, accounts } = await ctx(), { data, error } = await sb.rpc('account_balances'); if (error) dbError(error, 'accounts');
  const bal = new Map((data as any[]).map(x => [x.account_id, Number(x.balance_minor)])), total = [...bal.values()].reduce((a, b) => a + b, 0);
  const T = ({ d }: { d?: string }) => <select className="inp" name="type" defaultValue={d ?? 'cash'}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>;
  return <><Flash sp={sp} /><div className="card"><h1 className="text-xl font-semibold mb-2">Accounts — total {formatMinor(total)}</h1>
    {accounts.map(a => <form key={a.id} className="row mb-2"><input type="hidden" name="id" value={a.id} /><input className="inp" name="name" defaultValue={a.name} maxLength={40} /><T d={a.account_type} />
      <label className="m">Opening ₱<input className="inp w-28" name="opening" defaultValue={minorToInput(Number(a.opening_balance_minor))} inputMode="decimal" /></label><b className="w-32">{formatMinor(bal.get(a.id) ?? 0)}</b>
      <button className="btn" formAction={updateAccount}>Save</button><button className="btn" formAction={deleteAccount}>Delete</button></form>)}</div>
    <form action={createAccount} className="card row"><b>New account</b><input className="inp" name="name" placeholder="Name" required maxLength={40} /><T /><input className="inp w-28" name="opening" placeholder="Opening ₱" inputMode="decimal" /><button className="btn p">Create</button></form>
    <form action={transfer} className="card row"><b>Transfer</b><select className="inp" name="from">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>→<select className="inp" name="to">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input className="inp w-28" name="amount" placeholder="₱" required inputMode="decimal" /><input className="inp" type="date" name="date" defaultValue={manilaToday()} /><button className="btn p">Transfer</button></form></>;
}
