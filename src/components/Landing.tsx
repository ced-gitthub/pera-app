import Link from 'next/link';
import LiveDemo from '@/components/LiveDemo';
import ZovixMark from '@/components/ZovixMark';
import { APK_URL, webAppEnabled } from '@/lib/site';
import { SAMPLES } from '@/lib/onboardingCopy';
import { BENEFITS, FAQ, HOW, LEVELS, PRIVACY, QUESTS, SAMPLE_TITLES, WHAT } from '@/lib/landingCopy';
// The website is the front door for the Zovix app: what it is, how it helps, worked examples, and one clear download button.
// It never links to the web tracker (except a small "log in" line while the web app is still switched on, see WEB_APP_ENABLED).
function Download({ id }: { id?: string }) {
  return (
    <a className="btn p wl-big ld-cta" href={APK_URL} download id={id}>
      ⬇ Get Zovix free
    </a>
  );
}
function Install() {
  return (
    <div className="ld-info" id="install">
      <h3>Install in 3 taps</h3>
      <ol className="wl-get-steps" aria-label="How to install on Android">
        <li>Tap Get Zovix free. Open the file when it finishes.</li>
        <li>If Android asks, allow installs from your browser, then tap Install.</li>
        <li>Open Zovix and sign in with Google or an email code.</li>
      </ol>
      <p className="wl-get-note">
        <b>iPhone?</b> Open this page in Safari, tap Share, then Add to Home Screen. A full iPhone app comes later.
      </p>
    </div>
  );
}
export default function Landing({ ok }: { ok?: string }) {
  const web = webAppEnabled();
  return (
    <main className="wl ld">
      <div className="ld-top">
        <div className="ld-in">
          <header className="wl-top">
            <div className="brand">
              <ZovixMark />
              Zovix
            </div>
            <a className="wl-login" href={APK_URL} download>
              Get the app
            </a>
          </header>
          {ok && (
            <p className="flash good ld-ok" role="status">
              {ok} Open the Zovix app and sign in.
            </p>
          )}
          <section className="wl-hero" id="get">
            <p className="wl-eyebrow">Free peso tracker</p>
            <h1>
              Your pesos keep disappearing. <span className="wl-hl">Catch them.</span>
            </h1>
            <p className="wl-sub">
              Type <b>lunch 150 gcash</b>. Zovix does the rest. Try it right here, it takes 5 seconds.
            </p>
            <LiveDemo />
            <div className="ld-cta-row">
              <Download />
              <small>Android · free · no ads · no bank login</small>
            </div>
          </section>
        </div>
      </div>
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
      <section className="ld-sec" aria-label="Install">
        <Install />
      </section>
      <section className="wl-final" id="join">
        <h2>Your next peso has a plan.</h2>
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
      <div className="ld-sticky">
        <Download id="get-sticky" />
      </div>
    </main>
  );
}
