'use client';
import { useState } from 'react';
import OnboardingHead, { Sample } from '@/components/onboarding/OnboardingHead';
import { FinishButton } from '@/components/onboarding/OnboardingShell';
import { GATE_STEPS } from '@/lib/onboarding/onboarding';
import { COPY, SAMPLES } from '@/lib/onboarding/onboardingCopy';
const ORDER = [...GATE_STEPS, 'finish'] as const;
// The walkthrough for people who are already set up: the same five slides with a worked example each, Next / Back, and no way past the last one except "Open my Zovix".
export default function TourView() {
  const [i, setI] = useState(0),
    step = ORDER[i],
    c = COPY[step];
  return (
    <>
      <OnboardingHead number={i + 1} label={c.label} state={ORDER.map((_, j) => (j < i ? 'done' : j === i ? 'now' : ''))} />
      <section key={step} className="ob-slide" aria-labelledby="ob-h">
        <div className="ob-emoji" aria-hidden="true">
          {c.emoji}
        </div>
        <h1 id="ob-h">{step === 'finish' ? 'That is Zovix!' : c.title}</h1>
        {step === 'finish' ? (
          <div className="ob-done">
            <p>Log it, track it, budget it, save for it. Everything above is on your Home screen.</p>
            <p className="ob-next">
              <b>🔥 Tip:</b> log something 3 days in a row to light your streak.
            </p>
            <FinishButton />
          </div>
        ) : (
          <>
            <ol className="ob-todo">
              {c.todo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <Sample {...SAMPLES[step]} />
            <div className="ob-nav">
              {i > 0 && (
                <button className="btn" onClick={() => setI(i - 1)}>
                  Back
                </button>
              )}
              <button className="btn p ob-go" onClick={() => setI(i + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
