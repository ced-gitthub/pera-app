'use client';
import { useEffect, useState } from 'react';
// iPhone home-screen apps keep their own cookies, separate from Safari, so Google sign-in (which round-trips through the browser) can never finish there. Show a hint instead of a button that cannot work.
export default function HideInIosApp({ children }: { children: React.ReactNode }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp((navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);
  if (!inApp) return <>{children}</>;
  return (
    <p className="m">
      Google sign-in does not work inside the installed iPhone app.{' '}
      <a href="/code" className="underline">
        Log in with an email code
      </a>{' '}
      (works for Google accounts too), or use your password below.
    </p>
  );
}
