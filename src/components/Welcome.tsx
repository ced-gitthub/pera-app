'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ZovixMark from '@/components/ZovixMark';
import { formatMinor } from '@/core/money';
import { DEMO_ACCOUNTS, DEMO_GOAL, addEntry, levelFor, spendByCategory, startDemo, total, type DemoState } from '@/lib/welcomeDemo';
// The first screen a new visitor sees: a working sample of the app (nothing is saved), so they feel progress BEFORE they sign up.
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const TRY = ['lunch 150 gcash', 'grocery 800 cash', 'salary 5000 bpi', 'coffee 120'];
function useCountUp(target: number) {
  const [shown, setShown] = useState(target),
    from = useRef(target);
  useEffect(() => {
    const start = from.current,
      t0 = performance.now(),
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || start === target) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 600),
        v = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}
const BENEFITS: [string, string, string][] = [
  ['⚡', 'Type it. Done.', 'Write "lunch 150 gcash" and Zovix picks the amount, category and account. No forms, no spreadsheets.'],
  ['🎯', 'See where it goes', 'Spending by category, month by month, so you know what to cut and what to keep.'],
  ['🔔', 'Budgets that nudge', 'Set a limit per category and watch how much is left before it runs out.'],
  ['🔒', 'Private and free', 'Only you can see your data. No ads, no bank login, and you can delete everything any time.'],
];
export default function Welcome({ google }: { google: React.ReactNode }) {
  const [demo, setDemo] = useState<DemoState>(startDemo),
    [text, setText] = useState(''),
    [msg, setMsg] = useState(''),
    [last, setLast] = useState(0),
    n = demo.entries.length,
    lvl = levelFor(n),
    bal = useCountUp(total(demo)),
    bars = spendByCategory(demo),
    top = bars[0]?.amount || 1;
  function submit(raw: string) {
    const r = addEntry(demo, raw, manilaToday());
    if (!r.ok) return setMsg(r.message);
    setMsg('');
    setText('');
    setLast(r.entry.id);
    setDemo(r.state);
  }
  return (
    <main className="wl">
      <header className="wl-top">
        <div className="brand">
          <ZovixMark />
          Zovix
        </div>
        <Link href="/login" className="wl-login">
          I have an account
        </Link>
      </header>
      <section className="wl-hero">
        <p className="wl-eyebrow">Zovix Pera Tracker</p>
        <h1>
          Know where every <span className="wl-hl">peso</span> goes.
        </h1>
        <p className="wl-sub">Type it like a text. Zovix sorts it, adds it up and shows what is left. Try it below, no sign-up needed.</p>
      </section>
      <section className="wl-demo" aria-label="Try Zovix">
        <div className="wl-prog">
          <div className="wl-prog-row">
            <b>{lvl.title}</b>
            <span className={n > 0 ? 'wl-flame on' : 'wl-flame'} aria-label={n > 0 ? '1-day streak' : 'No streak yet'}>
              🔥 {n > 0 ? 1 : 0}
            </span>
          </div>
          <div
            className="wl-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={DEMO_GOAL}
            aria-valuenow={lvl.step}
            aria-label="Sample progress"
          >
            <i style={{ width: `${(lvl.step / DEMO_GOAL) * 100}%` }} />
          </div>
          <p className="wl-hint">{lvl.next}</p>
        </div>
        <div className="wl-total">
          <span>Your sample wallet</span>
          <b>{formatMinor(bal)}</b>
        </div>
        <div className="wl-accts">
          {DEMO_ACCOUNTS.map((a) => (
            <span key={a} className="wl-acct">
              {a} <b>{formatMinor(demo.balances[a])}</b>
            </span>
          ))}
        </div>
        <form
          className="wl-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          <label htmlFor="wl-in" className="sr-only">
            What did you spend or earn?
          </label>
          <input
            id="wl-in"
            className="inp"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try: lunch 150 gcash"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button className="btn p" type="submit">
            Add
          </button>
        </form>
        <div className="wl-chips">
          {TRY.map((t) => (
            <button key={t} type="button" className="wl-chip" onClick={() => submit(t)}>
              {t}
            </button>
          ))}
        </div>
        {msg && (
          <p className="flash bad" role="alert">
            {msg}
          </p>
        )}
        <ul className="wl-list" aria-live="polite">
          {demo.entries.slice(0, 5).map((e) => (
            <li key={e.id} className={e.id === last ? 'wl-row pop' : 'wl-row'}>
              <span className="ava" aria-hidden="true">
                {e.emoji}
              </span>
              <span className="wl-what">
                <b>{e.description}</b>
                <small>
                  {e.category} · {e.account}
                  {e.to ? ` → ${e.to}` : ''}
                </small>
              </span>
              <span className={e.type === 'income' ? 'inc' : e.type === 'expense' ? 'exp' : ''}>
                <b>
                  {e.type === 'income' ? '+' : e.type === 'expense' ? '-' : ''}
                  {formatMinor(e.amount_minor)}
                </b>
              </span>
            </li>
          ))}
        </ul>
        {bars.length > 0 && (
          <div className="wl-chart">
            <p className="wl-chart-t">Where your money went</p>
            {bars.slice(0, 4).map((b) => (
              <div key={b.category} className="wl-brow">
                <span>{b.category}</span>
                <i style={{ width: `${Math.max(8, (b.amount / top) * 100)}%` }} />
                <b>{formatMinor(b.amount)}</b>
              </div>
            ))}
          </div>
        )}
        {lvl.done && (
          <div className="wl-win" role="status">
            <div className="wl-confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <s key={i} style={{ ['--i' as string]: i }} />
              ))}
            </div>
            <h2>🎉 You are a Zovix tracker!</h2>
            <p>That took you seconds. Save it for real: your streak, your budgets and your reports start the moment you sign up.</p>
          </div>
        )}
      </section>
      <section className="wl-benefits" aria-label="What you get">
        <h2>What you get with Zovix</h2>
        <div className="wl-grid">
          {BENEFITS.map(([ic, t, d]) => (
            <article key={t} className="wl-card">
              <span aria-hidden="true">{ic}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wl-final" id="join">
        <h2>{n > 0 ? 'Keep your progress' : 'Start free in 10 seconds'}</h2>
        <p>Free forever. No ads. No bank login.</p>
        <div className="wl-cta">
          {google}
          <Link href="/register" className="btn p wl-big">
            Create free account
          </Link>
        </div>
        <p className="wl-small">
          Already tracking? <Link href="/login">Log in</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </section>
      {n > 0 && (
        <div className="wl-sticky">
          <span>{lvl.done ? 'Badge unlocked!' : `${n} tracked so far`}</span>
          <Link href="/register" className="btn p">
            Save my progress
          </Link>
        </div>
      )}
    </main>
  );
}
