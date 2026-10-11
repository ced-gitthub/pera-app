'use client';
import { useEffect, useState } from 'react';
// iPhone home-screen apps keep their own cookies, separate from Safari, so Google sign-in (which round-trips through the browser) can never finish there. Show a hint instead of a button that cannot work.
export default function HideInIosApp({ children }: { children: React.ReactNode }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp((navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);
  if (!inApp) return <>{children}</>;
  return <p className="muted">Google sign-in is not available in the installed iPhone app. Log in with your email and password below.</p>;
}
