import { createGoal } from '@/app/actions';
import { Btn } from '@/components/ui/Btn';
import { GOAL_EMOJIS, GOAL_NAME_MAX } from '@/lib/progress/goals';
// The "add a savings goal" form, shared by the Savings goals card and the first-run wizard.
export default function GoalForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  return (
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
          <option value="">Not connected (counts from today)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}: use its balance
            </option>
          ))}
        </select>
      </label>
      <Btn className="btn p">Add goal</Btn>
    </form>
  );
}
