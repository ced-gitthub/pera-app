'use client';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { saveLayout } from '@/app/actions';
import { BLOCKS, REORDERABLE, HISTORY_SIZES, HISTORY_DEFAULT, normalizeTab, defaultTab, move, toggle, visible, type TabId, type TabLayout } from '@/lib/layout';
const KEY = (t: string) => `pera.layout.pending.${t}`;
let chain: Promise<unknown> = Promise.resolve(); // layout saves go out one at a time, in order
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: still saved to the server */ } }, del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } } };
// Supabase is the source of truth. A change is applied on screen at once, saved to the server a moment later (debounced), and kept in this browser
// until the server confirms it, so going offline or closing the tab never loses it: it is retried when the connection returns.
function useLayout(tab: TabId | null, init: TabLayout | undefined) {
  const [lay, setLay] = useState<TabLayout>(init ?? { order: [], on: {} }), latest = useRef(lay), timer = useRef<ReturnType<typeof setTimeout> | null>(null), tries = useRef(0);
  const flush = useRef<() => void>(() => {});
  flush.current = () => {
    if (!tab) return; const snap = JSON.stringify(latest.current);
    chain = chain.then(() => saveLayout(tab, latest.current)).then(r => { if (r.ok) { tries.current = 0; if (JSON.stringify(latest.current) === snap) ls.del(KEY(tab)); } else throw new Error('save failed'); })
      .catch(() => { tries.current++; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => flush.current(), Math.min(60000, 2000 * 2 ** tries.current)); });
  };
  const schedule = (ms: number) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => flush.current(), ms); };
  useEffect(() => {
    if (!tab) return; const p = ls.get(KEY(tab));
    if (p) { try { const n = normalizeTab(tab, JSON.parse(p)); latest.current = n; setLay(n); schedule(0); } catch { ls.del(KEY(tab)); } } // an unsynced change from before wins and is sent again
    const online = () => { if (ls.get(KEY(tab))) schedule(0); }, hide = () => { if (document.visibilityState === 'hidden' && ls.get(KEY(tab))) schedule(0); };
    window.addEventListener('online', online); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('online', online); document.removeEventListener('visibilitychange', hide); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const commit = (n: TabLayout) => { latest.current = n; setLay(n); if (tab) { ls.set(KEY(tab), JSON.stringify(n)); schedule(600); } };
  return { lay, commit };
}
export type TabProps = { tab: TabId | 'budgets'; title: string; init?: TabLayout; nodes?: Record<string, ReactNode>; before?: ReactNode; after?: ReactNode; tail?: ReactNode; asForm?: boolean; canEdit?: boolean; canCustomize?: boolean };
export default function Tab({ tab, title, init, nodes = {}, before, after, tail, asForm, canEdit, canCustomize }: TabProps) {
  const lt = tab === 'budgets' ? null : tab, { lay, commit } = useLayout(lt, init), [edit, setEdit] = useState(false), [cust, setCust] = useState(false), [ask, setAsk] = useState(false);
  const defs = lt ? BLOCKS[lt] : [], label = (id: string) => defs.find(b => b.id === id)?.label ?? id;
  const ids = lt ? visible(lay).filter(id => nodes[id] != null) : [], off = lt ? defs.filter(b => !lay.on[b.id]).map(b => `off-${b.id}`).join(' ') : '';
  const body = ids.map(id => <Fragment key={id}>{asForm ? nodes[id] : <div className={`blk b-${id}`}>{nodes[id]}</div>}</Fragment>);
  return <div className={`tabroot ${edit ? 'editing' : ''} ${off}`} data-hn={lt === 'home' ? (lay.n ?? HISTORY_DEFAULT) : undefined}>
    <div className="tabhead"><h1>{title}</h1><span className="row">
      {canEdit && <button type="button" className={`btn ${edit ? 'p' : ''}`} aria-pressed={edit} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button>}
      {canCustomize && <button type="button" className={`btn ${cust ? 'p' : ''}`} aria-expanded={cust} onClick={() => setCust(!cust)}>Customize</button>}</span></div>
    {cust && lt && <section className="card cust" aria-label={`Customize ${title}`}><h2>Customize {title}</h2>
      <ul className="cl">{lay.order.map((id, i) => <li key={id}>
        <label className="sw"><input type="checkbox" checked={!!lay.on[id]} onChange={() => commit(toggle(lay, id))} /><span>{label(id)}</span></label>
        {lt === 'home' && id === 'history' && <select className="inp" aria-label="Entries in History" value={lay.n ?? HISTORY_DEFAULT} onChange={e => commit({ ...lay, n: Number(e.target.value) })}>{HISTORY_SIZES.map(n => <option key={n} value={n}>{n === HISTORY_DEFAULT ? `${n} (default)` : n}</option>)}</select>}
        {REORDERABLE[lt] && <span className="mv"><button type="button" className="btn" aria-label={`Move ${label(id)} up`} disabled={i === 0} onClick={() => commit(move(lay, id, -1))}>↑</button><button type="button" className="btn" aria-label={`Move ${label(id)} down`} disabled={i === lay.order.length - 1} onClick={() => commit(move(lay, id, 1))}>↓</button></span>}</li>)}</ul>
      <div className="row"><button type="button" className="btn p" onClick={() => { setCust(false); setAsk(false); }}>Done</button>
        {ask ? <span className="row" role="alert"><b>Reset {title} to the default layout?</b><button type="button" className="btn p" onClick={() => { commit(defaultTab(lt)); setAsk(false); }}>Yes, reset</button><button type="button" className="btn" onClick={() => setAsk(false)}>Cancel</button></span>
          : <button type="button" className="btn" onClick={() => setAsk(true)}>Reset to default</button>}</div></section>}
    {before}
    {asForm ? <form className="card row" aria-label="Filters">{body}{tail}</form> : <div className="blocks">{body}</div>}
    {lt === 'home' && ids.length === 0 && !cust && <section className="card"><p className="m" style={{ marginBottom: 12 }}>Everything on Home is hidden.</p><button type="button" className="btn p" onClick={() => setCust(true)}>Customize</button></section>}
    {after}
  </div>;
}
