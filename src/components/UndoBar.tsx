'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { restoreTx } from '@/app/actions';
import { clearUndo, subscribeUndo, undoSnapshot } from '@/lib/undobar';
// "Deleted. Changed your mind? Undo" notice, mounted once in the app layout so it stays visible while the transaction list refreshes.
export default function UndoBar() {
  const router = useRouter(),
    row = useSyncExternalStore(subscribeUndo, undoSnapshot, () => null),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  // The notice lives in tab memory, so leaving the app (logout navigates away without a page reload) must forget it, or the next person to log in on this tab would see it.
  useEffect(() => () => clearUndo(), []);
  useEffect(() => {
    setErr('');
    if (!row) return;
    const t = setTimeout(clearUndo, 30_000);
    return () => clearTimeout(t);
  }, [row]);
  if (!row) return null;
  return (
    <div className="undobar" role="status">
      <span>Deleted. Changed your mind?</span>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const x = await restoreTx(row);
          setBusy(false);
          if (x.ok) {
            clearUndo();
            router.refresh();
          } else setErr(x.message ?? 'Could not undo.');
        }}
      >
        Undo
      </button>
      <button className="btn" aria-label="Dismiss" onClick={clearUndo}>
        ✕
      </button>
      {err && <span role="alert">{err}</span>}
    </div>
  );
}
