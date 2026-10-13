'use client';
import { ONBOARDING_COOKIE, TOUR_COOKIE, WIZARD_COOKIE } from '@/lib/onboarding';
// Settings button: clears the "finished" cookies on this device and reloads, so the sliding walkthrough with examples shows again.
export default function ReplayTour() {
  return (
    <section className="card" aria-label="Tutorial">
      <h2>Tutorial</h2>
      <p className="m">See the step-by-step walkthrough with examples again.</p>
      <button
        className="btn p"
        onClick={() => {
          for (const k of [ONBOARDING_COOKIE, TOUR_COOKIE, WIZARD_COOKIE]) document.cookie = `${k}=; Max-Age=0; Path=/`;
          location.assign('/');
        }}
      >
        Show the tutorial again
      </button>
    </section>
  );
}
