'use client';
import { APK_URL } from '@/lib/landing/site';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ZovixMark from '@/components/ui/ZovixMark';
import InstallApp from '@/components/app/InstallApp';
import { formatMinor } from '@/core/money';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGET_MINOR,
  DEMO_GOAL_MINOR,
  addEntry,
  demoNet,
  foodSpent,
  spendByCategory,
  startDemo,
  total,
  tutorialStep,
  type DemoState,
} from '@/lib/landing/welcomeDemo';
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
const STEPS: [string, string, string][] = [
  ['1', 'Type what you spent', 'Like "lunch 150 gcash". No forms, no spreadsheets.'],
  ['2', 'Zovix sorts it', 'Amount, category and account are filled in for you.'],
  ['3', 'Watch your progress', 'Streaks, quests, goals and reports show where it all went.'],
];
const LEVELS: [string, string][] = [
  ['🪙', 'Broke Rookie'],
  ['🐷', 'Peso Pincher'],
  ['🎒', 'Budget Buddy'],
  ['⚔️', 'Wallet Warrior'],
  ['👑', 'Money Master'],
];
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
    [goalOn, setGoalOn] = useState(false),
    [budgetOn, setBudgetOn] = useState(false),
    n = demo.entries.length,
    tut = tutorialStep(demo, { goal: goalOn, budget: budgetOn }),
    saved = Math.max(0, demoNet(demo)),
    food = foodSpent(demo),
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
        <div className="wl-get">
          <a className="btn p wl-big" href={APK_URL} download>
            ⬇ Download for Android
          </a>
          <a className="btn wl-big" href="#try">
            Try it here first
          </a>
        </div>
        <p className="wl-get-note">
          <b>iPhone?</b> Open this page in Safari, tap Share, then Add to Home Screen. Free, no ads, no bank login.
        </p>
        <ul className="wl-get-steps" aria-label="How to install on Android">
          <li>Tap Download. Open the file when it finishes.</li>
          <li>If Android asks, allow installs from your browser, then tap Install.</li>
          <li>Open Zovix and sign in with Google.</li>
        </ul>
      </section>
      <section className="wl-demo" id="try" aria-label="Try Zovix">
        <div className="wl-prog">
          <div className="wl-prog-row">
            <b>Step {tut.n} of 5</b>
            <span className={n > 0 ? 'wl-flame on' : 'wl-flame'} aria-label={n > 0 ? '1-day streak' : 'No streak yet'}>
              🔥 {n > 0 ? 1 : 0}
            </span>
          </div>
          <div
            className="wl-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={tut.pct}
            aria-label="Tutorial progress"
          >
            <i style={{ width: `${tut.pct}%` }} />
          </div>
          <div className="wl-coach" role="status">
            <span className="wl-pointer" aria-hidden="true">
              👉
            </span>
            <div>
              <b>{tut.title}</b>
              <p>{tut.tip}</p>
            </div>
          </div>
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
          className={tut.n === 1 ? 'wl-form spot' : 'wl-form'}

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
            <button
              key={t}
              type="button"
              className={tut.n === 1 || (tut.n === 2 && t === 'salary 5000 bpi') ? 'wl-chip spot' : 'wl-chip'}
              onClick={() => submit(t)}
            >
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
        {(tut.n >= 3 || goalOn) && (
          <div className={goalOn ? 'wl-panel' : 'wl-panel spot'}>
            <div className="wl-ptop">
              <span aria-hidden="true">📱</span>
              <b>New phone</b>
              <small>{formatMinor(DEMO_GOAL_MINOR)} goal</small>
            </div>
            {goalOn ? (
              <>
                <div
                  className="wl-gbar"
                  role="progressbar"
                  aria-label="Sample goal progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.floor((saved * 100) / DEMO_GOAL_MINOR))}
                >
                  <i style={{ width: `${Math.min(100, (saved * 100) / DEMO_GOAL_MINOR)}%` }} />
                </div>
                <small>
                  {formatMinor(saved)} saved of {formatMinor(DEMO_GOAL_MINOR)}. Every entry moves this bar.
                </small>
              </>
            ) : (
              <button type="button" className="btn p" onClick={() => setGoalOn(true)}>
                Start my goal
              </button>
            )}
          </div>
        )}
        {(tut.n >= 4 || budgetOn) && (
          <div className={budgetOn ? 'wl-panel' : 'wl-panel spot'}>
            <div className="wl-ptop">
              <span aria-hidden="true">🍜</span>
              <b>Food budget</b>
              <small>{formatMinor(DEMO_BUDGET_MINOR)} a month</small>
            </div>
            {budgetOn ? (
              <>
                <div
                  className="wl-gbar"
                  role="progressbar"
                  aria-label="Sample budget used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.floor((food * 100) / DEMO_BUDGET_MINOR))}
                >
                  <i style={{ width: `${Math.min(100, (food * 100) / DEMO_BUDGET_MINOR)}%` }} />
                </div>
                <small>
                  {formatMinor(food)} spent · {formatMinor(Math.max(0, DEMO_BUDGET_MINOR - food))} left
                </small>
              </>
            ) : (
              <button type="button" className="btn p" onClick={() => setBudgetOn(true)}>
                Set my budget
              </button>
            )}
          </div>
        )}
        {tut.done && (
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
      <section className="wl-steps" aria-label="How it works">
        <h2>How it works</h2>
        <ol>
          {STEPS.map(([n, t, d]) => (
            <li key={n}>
              <span className="wl-n" aria-hidden="true">
                {n}
              </span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="wl-ladder" aria-label="Level up">
        <h2>Level up as you track</h2>
        <p className="wl-sub2">
          Every entry earns XP. Climb from Broke Rookie to Money Master, clear daily quests and keep your streak alive.
        </p>
        <div className="wl-rungs">
          {LEVELS.map(([e, t], i) => (
            <span key={t} className={i === 0 ? 'wl-rung on' : 'wl-rung'}>
              <i aria-hidden="true">{e}</i>
              {t}
            </span>
          ))}
        </div>
        <div className="wl-goal" aria-label="Savings goal example">
          <div className="wl-goal-top">
            <span aria-hidden="true">📱</span>
            <b>New phone</b>
            <small>₱3,500 of ₱10,000</small>
          </div>
          <div className="wl-gbar">
            <i style={{ width: '35%' }} />
          </div>
          <small>Set a savings goal, connect an account, and watch the bar fill up.</small>
        </div>
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
      <InstallApp />
      <section className="wl-final" id="join">
        <h2>{n > 0 ? 'Keep your progress' : 'Start free in 10 seconds'}</h2>
        <p>Free forever. No ads. No bank login.</p>
        <div className="wl-cta">
          {google}
          <a className="btn wl-big" href={APK_URL} download>
            ⬇ Download for Android
          </a>
          <Link href="/register" className="btn p wl-big">
            Create free account
          </Link>
        </div>
        <p className="wl-small">
          Already tracking? <Link href="/login">Log in</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </section>
      {n > 0 && (
        <div className={tut.done ? 'wl-sticky spot' : 'wl-sticky'}>
          <span>{tut.done ? 'Tutorial complete!' : `${n} tracked so far`}</span>
          <Link href="/register" className="btn p">
            Save my progress
          </Link>
        </div>
      )}
    </main>
  );
}
