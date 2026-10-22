'use client';
import { useEffect, useState } from 'react';
// iPhone home-screen apps keep their own cookies, separate from Safari, so Google sign-in (which round-trips through the browser) can never finish there.
// Nothing is shown up front: only if someone taps the Google button inside that app do they get a highlighted explanation and the way that works.
export default function HideInIosApp({ children }: { children: React.ReactNode }) {
  const [inApp, setInApp] = useState(false),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setInApp((navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);
  return (
    <div
      onClickCapture={(e) => {
        if (inApp && (e.target as HTMLElement).closest('button')) {
          e.preventDefault();
          e.stopPropagation();
          setBlocked(true);
        }
      }}
    >
      {blocked && (
        <p className="flash bad" role="alert">
          Google sign-in can&apos;t finish inside the iPhone app.{' '}
          <a href="/code" className="underline">
            Log in with an email code
          </a>{' '}
          instead (it works for Google accounts too), or use your password below.
        </p>
      )}
      {children}
    </div>
  );
}
