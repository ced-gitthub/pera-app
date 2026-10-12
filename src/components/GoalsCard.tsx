import { createGoal, deleteGoal } from '@/app/actions';
import { Btn } from '@/components/Btn';
import { formatMinor } from '@/core/money';
import { GOAL_EMOJIS, GOAL_NAME_MAX, goalProgress } from '@/lib/goals';
// Savings goals card: progress bars, an optional connected account, and a small form to add a goal. Display only: numbers arrive already computed.
export type GoalView = {
  id: string;
  name: string;
  emoji: string;
  target_minor: number;
  have: number;
  source: string;
  unavailable?: boolean;
};
export default function GoalsCard({ goals, accounts }: { goals: GoalView[]; accounts: { id: string; name: string }[] }) {
  return (
    <section className="card goals" aria-label="Savings goals">
      <h2>Savings goals</h2>
      {goals.length === 0 && (
        <p className="m">Saving for something? Add a goal, like a new phone or an emergency fund, and watch the bar fill up.</p>
      )}
      {goals.map((g) => {
        const p = goalProgress(g.target_minor, g.have);
        return (
          <div key={g.id} className={p.reached ? 'grow reached' : 'grow'}>
            <div className="gtop">
              <span className="ava" aria-hidden="true">
                {g.emoji}
              </span>
              <div className="gname">
                <b>{g.name}</b>
                <small>{g.source}</small>
              </div>
              <form action={deleteGoal}>
                <input type="hidden" name="id" value={g.id} />
                <Btn
                  className="linkbtn"
                  aria-label={`Remove goal ${g.name}`}
                  confirm={`Remove the goal "${g.name}"? Your money and transactions are not touched.`}
                >
                  Remove
                </Btn>
              </form>
            </div>
            {g.unavailable ? (
              <p className="gnums">Progress is unavailable right now. Try again in a moment.</p>
            ) : (
              <>
                <div
                  className="gbar"
                  role="progressbar"
                  aria-label={`${g.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={p.pct}
                >
                  <i style={{ width: `${p.pct}%` }} />
                </div>
                <p className="gnums">
                  <b>{formatMinor(p.have)}</b> of {formatMinor(g.target_minor)} · {p.pct}%
                  {p.reached ? '' : ` · ${formatMinor(p.remaining)} to go`}
                </p>
              </>
            )}
            {p.reached && !g.unavailable && (
              <p className="gwin" role="status">
                🎉 Goal reached! You did it.
              </p>
            )}
          </div>
        );
      })}
      <details className="gadd">
        <summary className="btn">+ New goal</summary>
        <form action={createGoal} className="grid gap-3">
          <label>
            <span className="m">What are you saving for?</span>
            <input className="inp" name="name" maxLength={GOAL_NAME_MAX} placeholder="New phone" required autoComplete="off" />
          </label>
          <fieldset className="gemos">
            <legend className="m">Pick an icon</legend>
            {GOAL_EMOJIS.map((e, i) => (
              <label key={e} className="gemo">
                <input type="radio" name="emoji" value={e} defaultChecked={i === 0} aria-label={`Icon ${e}`} />
                <span aria-hidden="true">{e}</span>
              </label>
            ))}
          </fieldset>
          <label>
            <span className="m">How much? (₱)</span>
            <input className="inp" name="amount" inputMode="decimal" placeholder="5000" required autoComplete="off" />
          </label>
          <label>
            <span className="m">Count savings from</span>
            <select className="inp" name="account" defaultValue="">
              <option value="">Not connected: count money I save from today</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}: use its balance
                </option>
              ))}
            </select>
          </label>
          <Btn className="btn p">Add goal</Btn>
        </form>
      </details>
    </section>
  );
}
