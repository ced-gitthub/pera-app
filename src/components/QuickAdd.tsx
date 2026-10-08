'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { parseInput, parseSegment, type Parsed, type Item } from '@/core/parser';
import { formatMinor, manilaToday } from '@/core/money';
import { saveItems, parseServer, runCommand, restoreTx } from '@/app/actions';
import { cheer } from '@/lib/vibe';
import { commandOf } from '@/lib/commands';
type Cat = { name: string; type: 'income' | 'expense' };
const EG = ['lunch 150 gcash', 'grocery 800 cash', 'salary 25000 bpi', 'coffee 120'];
const BITS = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, r = 70 + (i % 4) * 22; return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r - 30), r: (i * 47) % 360, c: ['#5b35e8', '#ffc53d', '#0f8a5c', '#d6324a'][i % 4] }; });
const line = (i: Item) => `${i.type === 'income' ? 'Income' : 'Expense'} — ${i.category} — ${formatMinor(i.amount_minor)}${i.description ? ` (${i.description})` : ''} · ${i.date}`;
export default function QuickAdd({ accounts, categories, aiEnabled }: { accounts: string[]; categories: Cat[]; aiEnabled: boolean }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [pend, setPend] = useState<Parsed[]>([]), [ready, setReady] = useState<Item[]>([]);
  const [msgs, setMsgs] = useState<{ bad?: boolean; ok?: boolean; t: string }[]>([]), [undo, setUndo] = useState<Record<string, unknown> | null>(null), [pick, setPick] = useState<Record<number, string>>({});
  const req = useRef({ id: '', key: '' }), router = useRouter();
  async function save(items: Item[]) {
    const key = JSON.stringify(items); if (req.current.key !== key) req.current = { id: crypto.randomUUID(), key }; // same payload on retry => same id => server ignores duplicates
    const r = await saveItems(req.current.id, items);
    if (r.ok) { setMsgs([{ ok: true, t: cheer(items.length, items[0].category) }, ...items.map(i => ({ t: line(i) }))]); setText(''); setPend([]); setReady([]); req.current = { id: '', key: '' }; router.refresh(); }
    else { setReady(items); setMsgs([{ bad: true, t: `${r.error}. Your input is kept; press "Retry save".` }]); }
  }
  async function submit() {
    if (busy || !text.trim()) return; setBusy(true); setMsgs([]); setUndo(null);
    try {
      if (commandOf(text)) { const r = await runCommand(text); setMsgs([{ bad: !r.ok, t: r.message }]); if (r.ok) { setUndo(r.deleted ?? null); setText(''); router.refresh(); } return; }
      const c = { today: manilaToday(), accounts }; let items = parseInput(text, c);
      if (aiEnabled && items.some(i => i.kind !== 'ok')) { try { items = await parseServer(text, c.today); } catch { /* fall back to deterministic result */ } }
      const ok = items.filter(i => i.kind === 'ok') as Item[], rest = items.filter(i => i.kind === 'ask' || i.kind === 'confirm');
      setMsgs(items.filter(i => i.kind === 'error').map(e => ({ bad: true, t: (e as { message: string }).message })));
      if (rest.length) { setPend(rest); setReady(ok); } else if (ok.length) await save(ok);
    } catch { setMsgs([{ bad: true, t: 'Not saved: we could not reach the server. Check your connection and try again. Your input is kept.' }]); } finally { setBusy(false); }
  }
  async function resolve(idx: number, p: Parsed) {
    if (p.kind === 'confirm') { setPend(pend.map((x, i) => (i === idx ? p : x))); return; }
    if (p.kind !== 'ok') { setMsgs([{ bad: true, t: p.kind === 'error' ? p.message : 'Could not resolve' }]); return; }
    const rest = pend.filter((_, i) => i !== idx), items = [...ready, p as Item]; setReady(items); setPend(rest);
    if (!rest.length) { setBusy(true); try { await save(items); } finally { setBusy(false); } }
  }
  const c = () => ({ today: manilaToday(), accounts });
  return (
    <section className="card log" aria-label="Quick add">
      <h1 className="text-2xl font-semibold mb-2">What did you spend or earn?</h1>
      <div className="row"><input className="inp flex-1 text-xl" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Try: lunch 150 gcash" aria-label="Transaction" maxLength={500} />
        <button className="btn p" onClick={submit} disabled={busy}>{busy ? 'Working…' : 'Add'}</button></div>
      {msgs.map((m, i) => m.ok ? <div key={i} className="cheer" role="status">🎉 {m.t}<div className="conf" aria-hidden="true">{BITS.map((b, k) => <i key={k} style={{ background: b.c, '--x': `${b.x}px`, '--y': `${b.y}px`, '--r': `${b.r}deg` } as CSSProperties} />)}</div></div> : <p key={i} className={m.bad ? 'flash bad mt-2' : 'm mt-1'} role={m.bad ? 'alert' : undefined}>{m.t}</p>)}
      {!text && !pend.length && !busy && <div className="eg" aria-label="Examples">{EG.map(e => <button key={e} type="button" onClick={() => setText(e)}>{e}</button>)}</div>}
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
