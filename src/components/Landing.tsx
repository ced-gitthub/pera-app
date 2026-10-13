import Link from 'next/link';
import ZovixMark from '@/components/ZovixMark';
import { APK_URL, webAppEnabled } from '@/lib/site';
import { SAMPLES } from '@/lib/onboardingCopy';
import { BENEFITS, FAQ, HOW, LEVELS, PRIVACY, QUESTS, SAMPLE_TITLES, WHAT } from '@/lib/landingCopy';
// The website is the front door for the Zovix app: what it is, how it helps, worked examples, and one clear download button.
// It never links to the web tracker (except a small "log in" line while the web app is still switched on, see WEB_APP_ENABLED).
function Download({ id }: { id?: string }) {
  return (
    <a className="btn p wl-big" href={APK_URL} download id={id}>
      ⬇ Download for Android
    </a>
  );
}
export default function Landing({ ok }: { ok?: string }) {
  const web = webAppEnabled();
  return (
    <main className="wl ld">
      <header className="wl-top">
        <div className="brand">
          <ZovixMark />
          Zovix
        </div>
        <a className="wl-login" href="#get">
          Get the app
        </a>
      </header>
      {ok && (
        <p className="flash good ld-ok" role="status">
          {ok} Open the Zovix app and sign in.
        </p>
      )}
      <section className="wl-hero">
        <p className="wl-eyebrow">Zovix Pera Tracker</p>
        <h1>
          Know where every <span className="wl-hl">peso</span> goes.
        </h1>
        <p className="wl-sub">
          Type it like a text. Zovix sorts it, adds it up and shows what is left. Free, with no ads and no bank login.
        </p>
        <div className="wl-get" id="get">
          <Download />
          <a className="btn wl-big" href="#samples">
            See how it works
          </a>
        </div>
        <div className="ld-info">
          <p className="wl-get-note">
            <b>iPhone?</b> Open this page in Safari, tap Share, then Add to Home Screen. A full iPhone app comes later.
          </p>
          <ol className="wl-get-steps" aria-label="How to install on Android">
            <li>Tap Download. Open the file when it finishes.</li>
            <li>If Android asks, allow installs from your browser, then tap Install.</li>
            <li>Open Zovix and sign in with Google or an email code.</li>
          </ol>
        </div>
      </section>
      <section className="ld-sec" aria-label="About Zovix">
        <h2>Your pesos, finally clear</h2>
        <div className="ld-what">
          {WHAT.map(([t, d]) => (
            <article key={t} className="wl-card">
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wl-steps" aria-label="How it works">
        <h2>How it works</h2>
        <ol>
          {HOW.map(([n, t, d]) => (
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
      <section className="ld-sec" id="samples" aria-label="Worked examples">
        <h2>Try it in your head</h2>
        <p className="ld-lead">Four things you do in your first minute, and exactly what Zovix does with each.</p>
        {(['first', 'balance', 'budget', 'goal'] as const).map((k) => {
          const s = SAMPLES[k];
          return (
            <article key={k} className="ld-sample">
              <h3>{SAMPLE_TITLES[k]}</h3>
              <p className="ld-you">
                <small>You type</small>
                <code>{s.you}</code>
              </p>
              <dl className="ld-parts">
                {s.parts.map((p) => (
                  <div key={p.text}>
                    <dt>{p.text}</dt>
                    <dd>{p.what}</dd>
                  </div>
                ))}
              </dl>
              <p className="ld-res-t">What Zovix does</p>
              <ul className="ld-res">
                {s.result.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </article>
          );
        })}
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
      <section className="wl-ladder" aria-label="Levels and quests">
        <h2>Level up as you track</h2>
        <p className="wl-sub2">
          Every entry earns XP, and every day in a row adds more. Climb from Broke Rookie to Money Master and clear quests along the way.
        </p>
        <div className="wl-rungs">
          {LEVELS.map(([e, t], i) => (
            <span key={t} className={i === 0 ? 'wl-rung on' : 'wl-rung'}>
              <i aria-hidden="true">{e}</i>
              {t}
            </span>
          ))}
        </div>
        <ul className="ld-quests" aria-label="Quests">
          {QUESTS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <div className="wl-goal" aria-label="Savings goal example">
          <div className="wl-goal-top">
            <span aria-hidden="true">📱</span>
            <b>New phone</b>
            <small>₱3,500 of ₱10,000</small>
          </div>
          <div className="wl-gbar">
            <i style={{ width: '35%' }} />
          </div>
          <small>Set a goal, connect an account, and watch the bar fill up.</small>
        </div>
      </section>
      <section className="ld-sec" aria-label="Privacy">
        <h2>Private by design</h2>
        <ul className="ld-priv">
          {PRIVACY.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p>
          <Link href="/privacy">Read the privacy policy</Link>
        </p>
      </section>
      <section className="ld-sec" aria-label="Questions">
        <h2>Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="ld-faq">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="wl-final" id="join">
        <h2>Start free in a minute</h2>
        <p>Free forever. No ads. No bank login.</p>
        <div className="wl-cta">
          <Download id="get-bottom" />
        </div>
        <p className="wl-small">
          <Link href="/privacy">Privacy</Link>
          {web && (
            <>
              {' '}
              · <Link href="/login">Log in to the web version</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
