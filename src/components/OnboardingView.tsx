import type { ReactNode } from 'react';
import { signOut, saveOpeningBalances, startBudget } from '@/app/actions';
import { Btn } from '@/components/Btn';
import MoneyInput from '@/components/MoneyInput';
import GoalForm from '@/components/GoalForm';
import { FinishButton } from '@/components/OnboardingShell';
import { MarkSvg } from '@/components/ZovixMark';
import { minorToInput } from '@/lib/validate';
import { GATE_STEPS, WIZARD_TOTAL, type GateStep } from '@/lib/onboarding';
type Acct = { id: string; name: string; opening_balance_minor: number; current_minor?: number };
type Cat = { id: string; name: string };
const COPY: Record<GateStep | 'finish', { emoji: string; label: string; title: string; todo: string[] }> = {
  first: {
    emoji: '🪙',
    label: 'First peso',
    title: 'Log your first peso',
    todo: ['Tap the glowing box below.', 'Type what you spent, like “lunch 150 gcash”.', 'Tap the button to save it.'],
  },
  balance: {
    emoji: '👛',
    label: 'Balances',
    title: 'How much do you have right now?',
    todo: ['Type what is in each account today.', 'Skip the ones that are empty. A rough number is fine.', 'Tap “Save balances”.'],
  },
  budget: {
    emoji: '🎯',
    label: 'Budget',
    title: 'Set your first budget',
    todo: ['Pick something you spend on.', 'Type the most you want to spend on it each month.', 'Tap “Set budget”.'],
  },
  goal: {
    emoji: '🏆',
    label: 'Goal',
    title: 'Start a savings goal',
    todo: ['Name what you are saving for.', 'Pick an icon and type how much it costs.', 'Tap “Add goal”.'],
  },
  finish: {
    emoji: '🎉',
    label: 'Done',
    title: 'You are all set!',
    todo: [],
  },
};
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
          <span>{c.label}</span>
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
          {all.map((s, i) => (
            <li key={s} className={doneIds.includes(s) || (step === 'finish' && s !== 'finish') ? 'done' : s === step ? 'now' : ''}>
              {doneIds.includes(s) || (step === 'finish' && s !== 'finish') ? '✓' : i + 1}
            </li>
          ))}
        </ol>
      </div>
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
