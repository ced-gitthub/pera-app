import { ctx } from '@/lib/data';
import { Btn } from '@/components/Btn';
import { updateProfile, createCategory, deleteCategory, createRecurring, deleteRecurring } from '@/app/actions';
import { manilaToday, formatMinor } from '@/core/money';
import ImportForm from '@/components/ImportForm';
import InstallApp from '@/components/InstallApp';
import Link from 'next/link';
import { Flash, type SP } from '@/components/ui';
export default async function Settings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams,
    { sb, user, categories, accounts } = await ctx();
  const [{ data: prof }, { data: rec }] = await Promise.all([
    sb.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    sb.from('recurring_transactions').select('*').order('next_run_date'),
  ]);
  const cn = new Map(categories.map((c) => [c.id, c.name]));
  return (
    <>
      <InstallApp />
      <Flash sp={sp} />
      <div className="card">
        <h2 className="font-semibold">Profile & currency</h2>
        <p className="m">{user.email} · Currency: PHP (₱), fixed in this version</p>
        <form action={updateProfile} className="row">
          <input aria-label="Name" className="inp" name="name" defaultValue={prof?.name ?? ''} placeholder="Name" maxLength={60} />
          <button className="btn">Save</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold">Security</h2>
        <p className="m" style={{ marginBottom: 12 }}>
          Two-step verification, password and logged-in devices.
        </p>
        <Link className="btn" href="/security">
          Open security
        </Link>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Categories</h2>
        {(['income', 'expense'] as const).map((t) => (
          <div key={t} className="mb-2">
            <b>{t}:</b>{' '}
            {categories
              .filter((c) => c.type === t)
              .map((c) => (
                <form key={c.id} action={deleteCategory} className="inline">
                  <input type="hidden" name="id" value={c.id} />{' '}
                  <Btn
                    className="btn mr-1"
                    title="Delete (only if unused)"
                    confirm={`Delete the category "${c.name}"? This only works if it is unused.`}
                  >
                    {c.name} ×
                  </Btn>
                </form>
              ))}
          </div>
        ))}
        <form action={createCategory} className="row">
          <input aria-label="New category" className="inp" name="name" placeholder="New category" required maxLength={40} />
          <select className="inp" name="type">
            <option>expense</option>
            <option>income</option>
          </select>
          <button className="btn p">Add</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Recurring</h2>
        {(rec ?? []).map((r: any) => (
          <form key={r.id} action={deleteRecurring} className="row">
            <input type="hidden" name="id" value={r.id} />
            <span>
              {r.description || cn.get(r.category_id)} {formatMinor(Number(r.amount_minor))} {r.type} · every {r.interval_count}{' '}
              {r.frequency} · next {r.next_run_date}
              {r.active ? '' : ' (finished)'}
            </span>
            <Btn className="btn" confirm="Delete this recurring rule? Past transactions are kept.">
              Delete
            </Btn>
          </form>
        ))}
        <form action={createRecurring} className="row mt-2">
          <input aria-label="Description" className="inp" name="description" placeholder="Netflix" maxLength={120} />
          <input aria-label="Amount" className="inp w-28" name="amount" placeholder="₱" required inputMode="decimal" />
          <select className="inp" name="type">
            <option>expense</option>
            <option>income</option>
          </select>
          <select className="inp" name="category_id">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
          <select className="inp" name="account_id">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="inp" name="frequency">
            <option>monthly</option>
            <option>daily</option>
            <option>weekly</option>
            <option>yearly</option>
          </select>
          <input className="inp w-20" name="interval" type="number" min={1} max={365} defaultValue={1} aria-label="Every N" />
          <input className="inp" type="date" name="start" defaultValue={manilaToday()} />
          <Btn className="btn p">Add rule</Btn>
        </form>
        <p className="m mt-1">
          A rule starting on the 31st runs on the last valid day of shorter months, and always counts from the start date (no drift).
        </p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Import / export</h2>
        <a className="btn" href="/export">
          Download CSV
        </a>
        <ImportForm />
        <p className="m mt-1">
          Re-importing the same file is safe (rows are de-duplicated against earlier imports). Rows you typed by hand are not compared.
        </p>
      </div>
    </>
  );
}
