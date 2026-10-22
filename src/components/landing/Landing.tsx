import Link from 'next/link';
import LiveDemo from '@/components/landing/LiveDemo';
import OkBanner from '@/components/landing/OkBanner';
import ScrollFx from '@/components/landing/ScrollFx';
import StickyCta from '@/components/landing/StickyCta';
import ZovixMark from '@/components/ui/ZovixMark';
import { APK_URL, webAppEnabled } from '@/lib/landing/site';
import { SAMPLES } from '@/lib/onboarding/onboardingCopy';
import {
  BENEFITS,
  COMPARE,
  FAQ,
  FAQ_MORE,
  H,
  HOW,
  LEVELS,
  NAV,
  PAIN,
  PRIVACY,
  QUESTS,
  SAMPLE_TITLES,
  WHAT,
  WHO,
} from '@/lib/landing/landingCopy';
import { jsonLd } from '@/lib/landing/jsonLd';
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
    <div className="ld-info">
      <h3>{H.install}</h3>
      <ol className="wl-get-steps" aria-label="How to install on Android">
        <li>Tap Get Zovix free. Open the file when it finishes.</li>
        <li>If Android asks, allow installs from your browser, then tap Install.</li>
        <li>Open Zovix and sign in with Google or an email code.</li>
      </ol>
      <p className="wl-get-note">
        <b>iPhone?</b> Open this page in Safari, tap Share, then Add to Home Screen. Kaya mamaya pa ang full iPhone app.
      </p>
    </div>
  );
}
export default function Landing() {
  const web = webAppEnabled();
  return (
    <main className="wl ld">
      <div className="ld-progress" aria-hidden="true" />
      <ScrollFx />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <div className="ld-top">
        <span className="ld-coin a" aria-hidden="true">
          🪙
        </span>
        <span className="ld-coin b" aria-hidden="true">
          ✨
        </span>
        <span className="ld-coin c" aria-hidden="true">
          🪙
        </span>
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
          <nav className="ld-nav" aria-label="Page shortcuts">
            {NAV.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <OkBanner />
          <section className="wl-hero" id="get">
            <p className="wl-eyebrow">Free peso tracker</p>
            <h1>
              Your pesos keep disappearing. <span className="wl-hl">Catch them.</span>
            </h1>
            <p className="wl-sub">
              Type <b>lunch 150 gcash</b>. Zovix na ang bahala sa iba. Try it right here, 5 seconds lang.
            </p>
            <LiveDemo />
            <div className="ld-cta-row" id="get-hero">
              <Download />
              <small>Android · free · no ads · no bank login</small>
            </div>
          </section>
        </div>
      </div>
      <section className="ld-sec" aria-label={H.pain}>
        <h2>{H.pain}</h2>
        <div className="ld-what">
          {PAIN.map(([ic, t, d]) => (
            <article key={t} className="wl-card">
              <span aria-hidden="true">{ic}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="ld-sec" id="about" aria-label="About Zovix">
        <h2>{H.about}</h2>
        <div className="ld-what">
          {WHAT.map(([t, d]) => (
            <article key={t} className="wl-card">
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wl-steps" id="how" aria-label={H.how}>
        <h2>{H.how}</h2>
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
        <h2>{H.samples}</h2>
        <p className="ld-lead">{H.samplesLead}</p>
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
              <p className="ld-res-t">{H.does}</p>
              <ul className="ld-res">
                {s.result.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
      <section className="ld-sec" aria-label={H.cmp}>
        <h2>{H.cmp}</h2>
        <table className="ld-cmp">
          <caption className="sr-only">Notes or spreadsheet compared with Zovix</caption>
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col">Notes or sheet</th>
              <th scope="col">Zovix</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([k, a, b]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td data-label="Notes or sheet">{a}</td>
                <td data-label="Zovix">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="wl-benefits" id="features" aria-label={H.features}>
        <h2>{H.features}</h2>
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
      <section className="wl-ladder" aria-label={H.levels}>
        <h2>{H.levels}</h2>
        <p className="wl-sub2">
          Every entry earns XP, plus more for every araw na tuloy-tuloy. Climb from Broke Rookie to Money Master and finish the quests along
          the way.
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
      <section className="ld-sec" aria-label={H.who}>
        <h2>{H.who}</h2>
        <ul className="ld-quests" aria-label={H.who}>
          {WHO.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </section>
      <section className="ld-sec" id="privacy" aria-label={H.privacy}>
        <h2>{H.privacy}</h2>
        <ul className="ld-priv">
          {PRIVACY.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p>
          <Link href="/privacy">Read the privacy policy</Link>
        </p>
      </section>
      <section className="ld-sec" id="faq" aria-label={H.faq}>
        <h2>{H.faq}</h2>
        {[...FAQ_MORE, ...FAQ].map(([q, a]) => (
          <details key={q} className="ld-faq">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="ld-sec" id="install" aria-label={H.install}>
        <Install />
      </section>
      <section className="wl-final" id="join">
        <div className="ld-rain" aria-hidden="true">
          {Array.from({ length: 12 }, (_, k) => (
            <s key={k} style={{ ['--k' as string]: k }}>
              🪙
            </s>
          ))}
        </div>
        <h2>{H.final}</h2>
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
      <StickyCta />
    </main>
  );
}
