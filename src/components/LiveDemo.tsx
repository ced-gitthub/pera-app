'use client';
import { useEffect, useRef, useState } from 'react';
import { formatMinor } from '@/core/money';
import { APK_URL } from '@/lib/site';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGET_MINOR,
  DEMO_GOAL,
  addEntry,
  foodSpent,
  spendByCategory,
  startDemo,
  total,
  type DemoState,
} from '@/lib/welcomeDemo';
// A working sample of the app inside the landing hero. Nothing is saved or sent anywhere: it is the same parser the app uses, running on sample money.
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const TRY = ['lunch 150 gcash', 'coffee 120', 'grocery 800 cash', 'salary 5000 bpi'];
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
      const p = Math.min(1, (now - t0) / 600);
      setShown(Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}
export default function LiveDemo() {
  const [demo, setDemo] = useState<DemoState>(startDemo),
    [text, setText] = useState(''),
    [msg, setMsg] = useState(''),
    [last, setLast] = useState(0),
    n = demo.entries.length,
    bal = useCountUp(total(demo)),
    food = foodSpent(demo),
    bars = spendByCategory(demo),
    top = bars[0]?.amount || 1,
    left = DEMO_BUDGET_MINOR - food;
  function submit(raw: string) {
    const r = addEntry(demo, raw, manilaToday());
    if (!r.ok) return setMsg(r.message);
    setMsg('');
    setText('');
    setLast(r.entry.id);
    setDemo(r.state);
  }
  return (
    <div className="wl-demo ld-demo" id="try" role="group" aria-label="Try Zovix">
      <div className="ld-demo-top">
        <b>{n === 0 ? 'Tap one. Watch it work.' : `${n} tracked${n >= DEMO_GOAL ? '. You got it!' : ''}`}</b>
        <span className={n > 0 ? 'wl-flame on' : 'wl-flame'} aria-label={n > 0 ? '1-day streak' : 'No streak yet'}>
          🔥 {n > 0 ? 1 : 0}
        </span>
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
        <label htmlFor="ld-in" className="sr-only">
          What did you spend or earn?
        </label>
        <input
          id="ld-in"
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
        {TRY.map((t, i) => (
          <button key={t} type="button" className={n === 0 && i === 0 ? 'wl-chip spot' : 'wl-chip'} onClick={() => submit(t)}>
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
        {demo.entries.slice(0, 4).map((e) => (
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
      {n > 0 && (
        <div className="wl-panel">
          <div className="wl-ptop">
            <span aria-hidden="true">🍜</span>
            <b>Food budget</b>
            <small>{formatMinor(DEMO_BUDGET_MINOR)} a month</small>
          </div>
          <div
            className="wl-gbar"
            role="progressbar"
            aria-label="Sample food budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.floor((food * 100) / DEMO_BUDGET_MINOR))}
          >
            <i style={{ width: `${Math.min(100, (food * 100) / DEMO_BUDGET_MINOR)}%` }} />
          </div>
          <small>{left >= 0 ? `${formatMinor(left)} left this month` : `${formatMinor(-left)} over budget`}</small>
        </div>
      )}
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
      {n >= DEMO_GOAL && (
        <div className="wl-win" role="status">
          <div className="wl-confetti" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <s key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <h2>🎉 That is the whole app.</h2>
          <p>Three taps and you know where your money went. Now do it with your real pesos.</p>
          <a className="btn p wl-big" href={APK_URL} download>
            ⬇ Get Zovix free
          </a>
        </div>
      )}
    </div>
  );
}
