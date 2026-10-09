import { ctx, loadLayout, balanceMap } from '@/lib/data';
import { dbError } from '@/lib/safe';
import { createAccount, updateAccount, deleteAccount, moveAccount, transfer } from '@/app/actions';
import { formatMinor, manilaToday } from '@/core/money';
import { minorToInput } from '@/lib/validate';
import { homeNumbers } from '@/lib/balances';
import Tab from '@/components/Tab';
import MoneyInput from '@/components/MoneyInput';
import { Flash, type SP } from '@/components/ui';
const TYPES = ['cash', 'ewallet', 'bank', 'credit_card', 'savings', 'other'];
export default async function Accounts({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams, { sb, user, accounts } = await ctx(), [bal, na, layout] = await Promise.all([balanceMap(sb), sb.rpc('no_account_summary'), loadLayout(sb, user.id)]); if (na.error) dbError(na.error, 'accounts');
  const none = (na.data as any[])?.[0] ?? { balance_minor: 0, n: 0 }, nums = homeNumbers(accounts, id => bal.get(id) ?? 0, Number(none.balance_minor));
  const T = ({ d }: { d?: string }) => <select className="inp" name="type" defaultValue={d ?? 'cash'}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>;
  const amt = (m: number) => <span className={m < 0 ? 'exp' : ''}>{formatMinor(m)}</span>;
  const before = <><Flash sp={sp} /><div className="card"><h2>Total {amt(nums.total)}</h2>
    {accounts.map((a, i) => { const b = bal.get(a.id) ?? 0; return <div key={a.id} className="acct">
      <div className="arow view-only"><span><b>{a.name}</b>{a.short_name && <span className="alias" title="Short name for Quick Add"> “{a.short_name}”</span>}<span className="m"> · {a.account_type.replace('_', ' ')}{a.counts_as_savings ? ' · counts as savings' : ''}{a.show_on_home ? '' : ' · hidden on Home'}</span></span><b>{amt(b)}</b></div>
      <form className="edit-only editf" aria-label={`Edit ${a.name}`}><input type="hidden" name="id" value={a.id} />
        <div className="row"><label className="fld">Name<input className="inp" name="name" defaultValue={a.name} maxLength={40} /></label><label className="fld">Type<T d={a.account_type} /></label></div>
        <div className="row"><label className="fld">Starting balance (₱)<MoneyInput name="opening" defaultValue={minorToInput(Number(a.opening_balance_minor))} label={`Starting balance for ${a.name}`} placeholder="0.00" /></label>
          <div className="fld">Current balance<b className="curbal">{amt(b)}</b></div>
          <label className="fld">Short name<input className="inp w-28" name="short" defaultValue={a.short_name ?? ''} maxLength={12} placeholder="e.g. cc" /></label></div>
        <div className="row"><label className="chk"><input type="checkbox" name="savings" defaultChecked={a.counts_as_savings} /> Counts as savings</label><label className="chk"><input type="checkbox" name="home" defaultChecked={a.show_on_home} /> Show on Home</label></div>
        <div className="row"><button className="btn p" formAction={updateAccount}>Save</button><button className="btn" formAction={moveAccount.bind(null, a.id, 'up')} disabled={i === 0} aria-label={`Move ${a.name} up`}>↑</button><button className="btn" formAction={moveAccount.bind(null, a.id, 'down')} disabled={i === accounts.length - 1} aria-label={`Move ${a.name} down`}>↓</button><button className="btn" formAction={deleteAccount}>Delete</button></div></form></div>; })}
    {Number(none.n) > 0 && <div className="arow noacct"><span><b>No account</b><span className="m"> · entries without an account</span></span><b>{amt(Number(none.balance_minor))}</b></div>}</div>
    <form action={createAccount} className="card edit-only editf" aria-label="New account"><h2>New account</h2>
      <div className="row"><input className="inp" name="name" placeholder="Name" required maxLength={40} aria-label="Name" /><T /></div>
      <div className="row"><MoneyInput name="opening" label="Starting balance" placeholder="Starting balance ₱" /><input className="inp w-28" name="short" placeholder="Short name" maxLength={12} aria-label="Short name" /></div>
      <div className="row"><label className="chk"><input type="checkbox" name="savings" /> Counts as savings</label><label className="chk"><input type="checkbox" name="home" defaultChecked /> Show on Home</label><button className="btn p">Create</button></div></form>
    <form action={transfer} className="card row"><b>Transfer</b><select className="inp" name="from" aria-label="From account">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>→<select className="inp" name="to" aria-label="To account">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input className="inp w-28" name="amount" placeholder="₱" required inputMode="decimal" aria-label="Amount" /><input className="inp" type="date" name="date" defaultValue={manilaToday()} aria-label="Date" /><button className="btn p">Transfer</button></form></>;
  return <Tab tab="accounts" title="Accounts" init={layout.accounts} before={before} canEdit canCustomize />;
}
