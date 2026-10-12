'use client';
import { useEffect, useState } from 'react';
// Installed iPhone apps keep their own cookies, separate from Safari, so Google sign-in (which round-trips through the browser) can never finish there: show a hint instead of a button that cannot work.
// The Android app (a wrapper around this site) opens Google in Chrome, and on some phones the result never reaches the app: keep the Google button but put the email-code way in first, which always works inside the app.
const ANDROID_APP = 'android-app://';
// In the Android app, Google opens in Chrome. The app and Chrome share the same login cookies, so once Google finishes there the app is already logged in; it only has to look again when you switch back to it.
function AndroidApp({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let left = false;
    const onChange = () => {
      if (document.visibilityState === 'hidden') left = true;
      else if (left) window.location.reload(); // back from Chrome: the login page reloads and, if Google finished, goes straight in
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return (
    <>
      {children}
      <p className="m">
        After Google finishes in Chrome, come back to this app and it signs you in by itself. Stuck?{' '}
        <a href="/code" className="underline">
          Use an email code instead
        </a>
        .
      </p>
    </>
  );
}
export default function HideInIosApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'' | 'ios' | 'android'>('');
  useEffect(() => {
    const fromApp = document.referrer.startsWith(ANDROID_APP);
    const android = (() => {
      try {
        // The launcher sets the referrer to android-app://<package> on start; remember it for the rest of this session.
        if (fromApp) sessionStorage.setItem('zovix-android-app', '1');
        return sessionStorage.getItem('zovix-android-app') === '1';
      } catch {
        return fromApp;
      }
    })();
    setMode((navigator as Navigator & { standalone?: boolean }).standalone === true ? 'ios' : android ? 'android' : '');
  }, []);
  if (mode === 'ios')
    return (
      <p className="m">
        Google sign-in does not work inside the installed iPhone app.{' '}
        <a href="/code" className="underline">
          Log in with an email code
        </a>{' '}
        (works for Google accounts too), or use your password below.
      </p>
    );
  if (mode === 'android') return <AndroidApp>{children}</AndroidApp>;
  return <>{children}</>;
}
