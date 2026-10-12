'use client';
import { useEffect, useState } from 'react';
// "Install Zovix" card. Chrome/Edge/Android give us a real install prompt; iPhone Safari has none, so we show the two taps; Android phones can also download the app file. Hidden once Zovix is already installed.
type Deferred = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type Env = { installed: boolean; ios: boolean; android: boolean };
const KEY = 'zovix-install-dismissed';
export default function InstallApp({ dismissible = false }: { dismissible?: boolean }) {
  const [deferred, setDeferred] = useState<Deferred | null>(null),
    [env, setEnv] = useState<Env | null>(null),
    [hidden, setHidden] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent,
      standalone =
        window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = dismissible && localStorage.getItem(KEY) === '1';
    } catch {
      /* storage blocked: just show it */
    }
    setHidden(dismissed);
    setEnv({
      installed: standalone || document.referrer.startsWith('android-app://'),
      ios: /iPhone|iPad|iPod/.test(ua),
      android: /Android/.test(ua),
    });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as Deferred);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [dismissible]);
  if (!env || env.installed || hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  return (
    <section className="card install" aria-label="Install Zovix">
      <div className="install-ic" aria-hidden="true">
        📲
      </div>
      <div className="install-body">
        <h2>Get Zovix on your phone</h2>
        {done ? (
          <p className="m">Installed! Open Zovix from your home screen.</p>
        ) : env.ios ? (
          <p className="m">
            In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. Zovix opens full screen like a real app.
          </p>
        ) : (
          <p className="m">Opens full screen with its own icon, like a real app. Free, and nothing extra to download from a store.</p>
        )}
        {!done && (
          <div className="install-btns">
            {deferred && (
              <button
                type="button"
                className="btn p"
                onClick={async () => {
                  await deferred.prompt();
                  const c = await deferred.userChoice;
                  if (c.outcome === 'accepted') setDone(true);
                  setDeferred(null);
                }}
              >
                Install app
              </button>
            )}
            {env.android && (
              <a className="btn" href="/zovix.apk" download>
                Download the Android app
              </a>
            )}
            {!deferred && !env.ios && !env.android && (
              <span className="m">In Chrome or Edge, use the install icon at the right of the address bar.</span>
            )}
          </div>
        )}
      </div>
      {dismissible && (
        <button type="button" className="linkbtn install-x" aria-label="Hide this" onClick={close}>
          ✕
        </button>
      )}
    </section>
  );
}
