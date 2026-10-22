import type { ReactNode } from 'react';
import { saveOpeningBalances, startBudget } from '@/app/actions';
import OnboardingHead, { Sample } from '@/components/onboarding/OnboardingHead';
import { COPY, SAMPLES } from '@/lib/onboarding/onboardingCopy';
import { Btn } from '@/components/ui/Btn';
import MoneyInput from '@/components/ui/MoneyInput';
import GoalForm from '@/components/goals/GoalForm';
import { FinishButton } from '@/components/onboarding/OnboardingShell';
import { minorToInput } from '@/lib/common/validate';
import { GATE_STEPS, type GateStep } from '@/lib/onboarding/onboarding';
type Acct = { id: string; name: string; opening_balance_minor: number; current_minor?: number };
type Cat = { id: string; name: string };
// The required first-run wizard: one slide per step, "Step N of 5", the thing to do glowing with a pointer. Display only; the page gate decides which step is shown.
export default function OnboardingView({
  step,
  number,
  doneIds,
  accounts,
  categories,
  quick,
}: {
  step: GateStep | 'finish';
  number: number;
  doneIds: string[];
  accounts: Acct[];
  categories: Cat[];
  quick: ReactNode;
}) {
  const c = COPY[step],
    all = [...GATE_STEPS, 'finish'] as const;
  return (
    <>
      <OnboardingHead
        number={number}
        label={c.label}
        state={all.map((s) => (doneIds.includes(s) || (step === 'finish' && s !== 'finish') ? 'done' : s === step ? 'now' : ''))}
      />
      <section key={step} className="ob-slide" aria-labelledby="ob-h">
        <div className="ob-emoji" aria-hidden="true">
          {c.emoji}
        </div>
        <h1 id="ob-h">{c.title}</h1>
        {c.todo.length > 0 && (
          <ol className="ob-todo">
            {c.todo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
        {step !== 'finish' && <Sample {...SAMPLES[step]} />}
        {step === 'first' && (
          <div className="ob-spot">
            <span className="ob-point">👉 Start here</span>
            {quick}
          </div>
        )}
        {step === 'balance' && (
          <form action={saveOpeningBalances} className="ob-spot ob-form">
            <span className="ob-point">👉 Fill this in</span>
            {accounts.map((a) => (
              <label key={a.id} className="ob-field">
                <span>{a.name}</span>
                <MoneyInput
                  name={`open_${a.id}`}
                  label={`${a.name} balance`}
                  placeholder="0"
                  defaultValue={
                    (a.current_minor ?? a.opening_balance_minor) ? minorToInput(a.current_minor ?? a.opening_balance_minor) : ''
                  }
                />
              </label>
            ))}
            <Btn className="btn p">Save balances</Btn>
          </form>
        )}
        {step === 'budget' && (
          <form action={startBudget} className="ob-spot ob-form">
            <span className="ob-point">👉 Fill this in</span>
            <label className="ob-field">
              <span>What do you spend on?</span>
              <select className="inp" name="category_id" required defaultValue="">
                <option value="" disabled>
                  Pick a category
                </option>
                {categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ob-field">
              <span>Monthly limit (₱)</span>
              <input className="inp" name="amount" inputMode="decimal" placeholder="3000" required autoComplete="off" />
            </label>
            <Btn className="btn p">Set budget</Btn>
          </form>
        )}
        {step === 'goal' && (
          <div className="ob-spot gadd">
            <span className="ob-point">👉 Fill this in</span>
            <GoalForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
          </div>
        )}
        {step === 'finish' && (
          <div className="ob-done">
            <p>You logged a peso, set your balances, a budget and a savings goal. That is the whole setup.</p>
            <p className="ob-next">
              <b>🔥 Last mission:</b> log something 3 days in a row to light your streak. Come back tomorrow!
            </p>
            <FinishButton />
          </div>
        )}
      </section>
    </>
  );
}
