'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMinor } from '@/core/money';
import { deleteTx, duplicateTx, restoreTx } from '@/app/actions';
import { emojiFor } from '@/lib/vibe';
export type R = { id: string; type: string; amount_minor: number; date: string; description: string; category: string; account: string; to: string };
export default function TxRow({ r, actions = true }: { r: R; actions?: boolean }) {
  const router = useRouter(), [gone, setGone] = useState<Record<string, unknown> | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  if (gone) return <tr><td colSpan={5}>Deleted. Changed your mind? <button className="btn" onClick={async () => { const x = await restoreTx(gone); if (x.ok) { setGone(null); router.refresh(); } else setErr(x.message); }}>Undo</button> {err}</td></tr>;
  const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '-' : '';
  return <tr className="tx"><td style={{ width: 52 }}><span className="ava" aria-hidden="true">{r.type === 'transfer' ? '🔁' : emojiFor(r.category, r.type)}</span></td><td><b>{r.description || r.category}</b><div className="m">{r.date} · {r.type === 'transfer' ? `Transfer ${r.account} → ${r.to}` : `${r.category} · ${r.account}`}</div></td>
    <td className={r.type === 'income' ? 'inc' : r.type === 'expense' ? 'exp' : ''} style={{ textAlign: 'right' }}><b>{sign}{formatMinor(r.amount_minor)}</b></td>
    {actions && <td><span className="row"><Link className="btn" href={`/transactions/${r.id}`}>Edit</Link>
      <button className="btn" disabled={busy} onClick={async () => { setBusy(true); const x = await duplicateTx(r.id); setBusy(false); if (x.ok) router.refresh(); else setErr(x.message ?? ''); }}>Duplicate</button>
      <button className="btn" disabled={busy} onClick={async () => { setBusy(true); const x = await deleteTx(r.id); setBusy(false); if (x.ok) setGone(x.row); /* no refresh here: it would unmount this row and its Undo prompt; the list is fresh on the next navigation */ else setErr(x.message); }}>Delete</button></span>{err && <div className="flash bad">{err}</div>}</td>}</tr>;
}
