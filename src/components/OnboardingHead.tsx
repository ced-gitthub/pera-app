import { signOut } from '@/app/actions';
import { MarkSvg } from '@/components/ZovixMark';
import { WIZARD_TOTAL } from '@/lib/onboarding';
// Top of every wizard / tour slide: logo, Log out, "Step N of 5", progress bar and the numbered dots.
export default function OnboardingHead({ number, label, state }: { number: number; label: string; state: ('done' | 'now' | '')[] }) {
  return (
    <>
      <header className="ob-top">
        <span className="ob-logo" aria-hidden="true">
          <MarkSvg size={22} color="currentColor" />
        </span>
        <b>Zovix setup</b>
        <form action={signOut} className="ob-out">
          <button className="linkbtn">Log out</button>
        </form>
      </header>
      <div className="ob-prog">
        <div className="ob-count">
          <b>
            Step {number} of {WIZARD_TOTAL}
          </b>
          <span>{label}</span>
        </div>
        <div
          className="mbar"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={WIZARD_TOTAL}
          aria-valuenow={number}
        >
          <i style={{ width: `${Math.round((number * 100) / WIZARD_TOTAL)}%` }} />
        </div>
        <ol className="ob-dots" aria-hidden="true">
          {state.map((s, i) => (
            <li key={i} className={s}>
              {s === 'done' ? '✓' : i + 1}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
export const Sample = ({ you, result }: { you: string; result: string[] }) => (
  <div className="ob-sample">
    <b className="ob-sample-tag">Example</b>
    <p className="ob-you">
      <span>You type</span> “{you}”
    </p>
    <ul className="ob-res">
      {result.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  </div>
);
