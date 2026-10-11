'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMinor } from '@/core/money';
import { deleteTx, duplicateTx } from '@/app/actions';
import { showUndo } from '@/lib/undobar';
import { emojiFor } from '@/lib/vibe';
export type R = {
  id: string;
  type: string;
  amount_minor: number;
  date: string;
  description: string;
  category: string;
  account: string;
  to: string;
  card?: boolean;
};
export default function TxRow({ r, actions = true }: { r: R; actions?: boolean }) {
  const router = useRouter(),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '-' : '',
    pay = r.type === 'transfer' && !!r.card; // a transfer into a card account is shown as a card payment (display only; it is stored as a transfer)
  return (
    <tr className="tx">
      <td style={{ width: 52 }}>
        <span className="ava" aria-hidden="true">
          {pay ? '💳' : r.type === 'transfer' ? '🔁' : emojiFor(r.category, r.type)}
        </span>
      </td>
      <td>
        <b>{r.type === 'transfer' ? (pay ? `Paid ${r.to}` : r.description || 'Transfer') : r.description || r.category}</b>
        <div className="m">
          {r.date} ·{' '}
          {r.type === 'transfer' ? `${pay ? 'Card payment' : 'Transfer'} · ${r.account} → ${r.to}` : `${r.category} · ${r.account}`}
        </div>
      </td>
      <td className={r.type === 'income' ? 'inc' : r.type === 'expense' ? 'exp' : ''} style={{ textAlign: 'right' }}>
        <b>
          {sign}
          {formatMinor(r.amount_minor)}
        </b>
      </td>
      {actions && (
        <td className="edit-only">
          <span className="row">
            <Link className="btn" href={`/transactions/${r.id}`}>
              Edit
            </Link>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const x = await duplicateTx(r.id);
                setBusy(false);
                if (x.ok) router.refresh();
                else setErr(x.message ?? '');
              }}
            >
              Duplicate
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const x = await deleteTx(r.id);
                setBusy(false);
                if (x.ok)
                  showUndo(x.row); // the row disappears with the list refresh; the Undo notice lives in the layout
                else setErr(x.message);
              }}
            >
              Delete
            </button>
          </span>
          {err && (
            <div className="flash bad" role="alert">
              {err}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
