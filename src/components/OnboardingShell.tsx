'use client';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ONBOARDING_COOKIE, WIZARD_COOKIE } from '@/lib/onboarding';
const setCookie = (name: string, v: string, maxAge: number) => {
  try {
    document.cookie = `${name}=${v}; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {
    /* cookies blocked: the wizard simply shows again next time */
  }
};
// What the last action said ("Type what you have in at least one account..."), shown inside the slide.
function Say() {
  const sp = useSearchParams(),
    err = sp.get('err'),
    ok = sp.get('ok');
  if (err)
    return (
      <p className="flash bad" role="alert">
        {err}
      </p>
    );
  return ok ? (
    <p className="flash good" role="status">
      {ok}
    </p>
  ) : null;
}
// Full-screen cover for the required first-run wizard: everything behind it is made inert (no tabbing or tapping through) and the page cannot scroll.
export default function OnboardingShell({ children }: { children: ReactNode }) {
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCookie(WIZARD_COOKIE, '1', 86400 * 30);
    const app = document.querySelector('.shell') as HTMLElement | null,
      prev = document.body.style.overflow;
    app?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    head.current?.focus();
    return () => {
      app?.removeAttribute('inert');
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="ob" role="dialog" aria-modal="true" aria-label="Set up Zovix">
      <div className="ob-in" ref={head} tabIndex={-1}>
        <Suspense fallback={null}>
          <Say />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
// Closing slide button: remembers on this device that the wizard is finished, then opens the app.
export function FinishButton() {
  const r = useRouter();
  return (
    <button
      className="btn p ob-go"
      onClick={() => {
        setCookie(ONBOARDING_COOKIE, '1', 86400 * 365);
        setCookie(WIZARD_COOKIE, '', 0);
        r.replace('/');
        r.refresh();
      }}
    >
      Open my Zovix
    </button>
  );
}
// A person who finished the required steps earlier (or on another device) is not shown the wizard; this just remembers it so the check is skipped from now on.
export function MarkOnboarded() {
  useEffect(() => setCookie(ONBOARDING_COOKIE, '1', 86400 * 365), []);
  return null;
}
