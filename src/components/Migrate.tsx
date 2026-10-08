'use client';
import { useState } from 'react';
import { migrateLegacy } from '@/app/actions';
export default function Migrate() {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); try { const raw = localStorage.getItem('mt1'); if (!raw) { setMsg({ ok: false, t: 'No prototype data (key "mt1") found in this browser.' }); return; }
      const r = await migrateLegacy(raw); setMsg({ ok: r.ok, t: r.message }); if (r.ok) localStorage.setItem('mt1_migrated', new Date().toISOString()); /* original data is never deleted */ }
    catch (e) { setMsg({ ok: false, t: 'Migration failed: ' + (e as Error).message }); } finally { setBusy(false); }
  }
  return <div><p className="m">Run this in the browser where you used the prototype (same site origin). Safe to repeat: already-migrated rows are skipped, and totals are verified.</p>
    <button className="btn p" onClick={run} disabled={busy}>{busy ? 'Migrating…' : 'Migrate prototype data'}</button>{msg && <p className={`flash ${msg.ok ? 'good' : 'bad'} mt-2`}>{msg.t}</p>}</div>;
}
