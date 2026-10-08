'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseInput, parseSegment, type Parsed, type Item } from '@/core/parser';
import { formatMinor, manilaToday } from '@/core/money';
import { saveItems, parseServer, runCommand, restoreTx } from '@/app/actions';
type Cat = { name: string; type: 'income' | 'expense' };
const CMD = /^(delete|remove|undo)\b.*\b(last|latest|previous)\b|\b(change|set|make|move)\b.*\b(last|latest)\b.*\bto\b/i;
const line = (i: Item) => `${i.type === 'income' ? 'Income' : 'Expense'} — ${i.category} — ${formatMinor(i.amount_minor)}${i.description ? ` (${i.description})` : ''} · ${i.date}`;
export default function QuickAdd({ accounts, categories, aiEnabled }: { accounts: string[]; categories: Cat[]; aiEnabled: boolean }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [pend, setPend] = useState<Parsed[]>([]), [ready, setReady] = useState<Item[]>([]);
  const [msgs, setMsgs] = useState<{ bad?: boolean; t: string }[]>([]), [undo, setUndo] = useState<Record<string, unknown> | null>(null), [pick, setPick] = useState<Record<number, string>>({});
  const req = useRef({ id: '', key: '' }), router = useRouter();
  async function save(items: Item[]) {
    const key = JSON.stringify(items); if (req.current.key !== key) req.current = { id: crypto.randomUUID(), key }; // same payload on retry => same id => server ignores duplicates
    const r = await saveItems(req.current.id, items);
    if (r.ok) { setMsgs([{ t: `Added ${items.length} transaction${items.length > 1 ? 's' : ''}:` }, ...items.map(i => ({ t: line(i) }))]); setText(''); setPend([]); setReady([]); req.current = { id: '', key: '' }; router.refresh(); }
    else { setReady(items); setMsgs([{ bad: true, t: `${r.error}. Your input is kept; press "Retry save".` }]); }
  }
  async function submit() {
    if (busy || !text.trim()) return; setBusy(true); setMsgs([]); setUndo(null);
    try {
      if (CMD.test(text.trim())) { const r = await runCommand(text); setMsgs([{ bad: !r.ok, t: r.message }]); if (r.ok) { setUndo(r.deleted ?? null); setText(''); router.refresh(); } return; }
      const c = { today: manilaToday(), accounts }; let items = parseInput(text, c);
      if (aiEnabled && items.some(i => i.kind !== 'ok')) { try { items = await parseServer(text, c.today); } catch { /* fall back to deterministic result */ } }
      const ok = items.filter(i => i.kind === 'ok') as Item[], rest = items.filter(i => i.kind === 'ask' || i.kind === 'confirm');
      setMsgs(items.filter(i => i.kind === 'error').map(e => ({ bad: true, t: (e as { message: string }).message })));
      if (rest.length) { setPend(rest); setReady(ok); } else if (ok.length) await save(ok);
    } catch (e) { setMsgs([{ bad: true, t: 'Not saved: ' + (e as Error).message }]); } finally { setBusy(false); }
  }
  async function resolve(idx: number, p: Parsed) {
    if (p.kind === 'confirm') { setPend(pend.map((x, i) => (i === idx ? p : x))); return; }
    if (p.kind !== 'ok') { setMsgs([{ bad: true, t: p.kind === 'error' ? p.message : 'Could not resolve' }]); return; }
    const rest = pend.filter((_, i) => i !== idx), items = [...ready, p as Item]; setReady(items); setPend(rest);
    if (!rest.length) { setBusy(true); try { await save(items); } finally { setBusy(false); } }
  }
  const c = () => ({ today: manilaToday(), accounts });
  return (
    <section className="card hero" aria-label="Quick add">
      <h1 className="text-2xl font-semibold mb-2">Tell me what happened</h1>
      <div className="row"><input className="inp flex-1 text-xl" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="food 120, grocery 29 · income 12000 · coffee 150 at Starbucks" aria-label="Transaction" maxLength={500} />
        <button className="btn p" onClick={submit} disabled={busy}>{busy ? 'Working…' : 'Add'}</button></div>
      {msgs.map((m, i) => <p key={i} className={m.bad ? 'flash bad mt-2' : 'mt-1'} role={m.bad ? 'alert' : undefined}>{m.t}</p>)}
      {pend.map((p, i) => <div key={i} className="mt-3 p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        {p.kind === 'ask' && <><p>Not sure what “{p.label}” {formatMinor(p.amount_minor)} means. Received it or spent it?</p><div className="row">
          <button className="btn" onClick={() => resolve(i, parseSegment(p.raw, c(), 'income'))}>Received</button><button className="btn" onClick={() => resolve(i, parseSegment(p.raw, c(), 'expense'))}>Spent</button></div></>}
        {p.kind === 'confirm' && <><p>{p.type === 'income' ? 'Income' : 'Expense'} {formatMinor(p.amount_minor)} — confirm the category</p><div className="row">
          <select className="inp" value={pick[i] ?? p.category} onChange={e => setPick({ ...pick, [i]: e.target.value })}>{categories.filter(x => x.type === p.type).map(x => <option key={x.name}>{x.name}</option>)}</select>
          <button className="btn p" onClick={() => resolve(i, { ...p, kind: 'ok', category: pick[i] ?? p.category })}>Save</button></div></>}
        <button className="btn mt-1" onClick={() => setPend(pend.filter((_, k) => k !== i))}>Discard</button></div>)}
      {!pend.length && ready.length > 0 && !busy && <button className="btn p mt-2" onClick={() => { setBusy(true); save(ready).finally(() => setBusy(false)); }}>Retry save</button>}
      {undo && <button className="btn mt-2" onClick={async () => { const r = await restoreTx(undo); setMsgs([{ bad: !r.ok, t: r.message }]); setUndo(null); router.refresh(); }}>Undo delete</button>}
    </section>
  );
}
