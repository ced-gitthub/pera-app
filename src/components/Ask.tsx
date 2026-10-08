'use client';
import { useState } from 'react';
import { askAssistant } from '@/app/actions';
export default function Ask() {
  const [q, setQ] = useState(''), [log, setLog] = useState<{ q: string; a: string; ok: boolean }[]>([]), [busy, setBusy] = useState(false);
  async function go() { if (busy || !q.trim()) return; setBusy(true); const r = await askAssistant(q).catch(e => ({ ok: false, answer: String(e) })); setLog([{ q, a: r.answer, ok: r.ok }, ...log]); setQ(''); setBusy(false); }
  return <div><div className="row"><input className="inp flex-1" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder="How much did I spend on food through GCash?" maxLength={300} aria-label="Question" /><button className="btn p" onClick={go} disabled={busy}>Ask</button></div>
    {log.map((l, i) => <div key={i} className="card mt-3"><p className="m">{l.q}</p><p className={l.ok ? '' : 'flash bad'}>{l.a}</p></div>)}</div>;
}
