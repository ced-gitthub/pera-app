'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { mfaStart, mfaConfirm } from '@/app/actions';
import OtpField from './OtpField';
const OFFLINE = 'We could not reach the server. Check your connection and try again.';
type Setup = { factorId: string; qr: string; secret: string };
export default function MfaSetup() {
  const router = useRouter(), [s, setS] = useState<Setup | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function start() { setBusy(true); setErr(''); const r = await mfaStart().catch(() => ({ ok: false as const, error: OFFLINE })); setBusy(false); if (r.ok) setS(r); else setErr(r.error); }
  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!s || busy) return; const code = String(new FormData(e.currentTarget).get('code') ?? '');
    setBusy(true); setErr(''); const r = await mfaConfirm(s.factorId, code).catch(() => ({ ok: false, error: OFFLINE })); setBusy(false);
    if (r.ok) router.refresh(); else setErr(r.error ?? 'Something went wrong. Please try again.');
  }
  if (!s) return <div className="grid gap-3">{err && <p className="flash bad" role="alert">{err}</p>}<div><button type="button" className="btn p" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Set up two-step verification'}</button></div></div>;
  return <div className="grid gap-3">
    <ol className="steps">
      <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) and scan this code.
        <div className="qr" style={{ marginTop: 10 }}><img src={s.qr} alt="QR code that adds Pera to your authenticator app" width={184} height={184} /></div>
        <p className="sub" style={{ marginTop: 10 }}>Can’t scan? Type this key into the app instead. Keep it somewhere safe: it sets up your codes again if you lose your phone.</p>
        <code className="key" aria-label="Setup key">{s.secret}</code></li>
      <li>Enter the 6-digit code the app shows.
        <form onSubmit={confirm} className="grid gap-3" style={{ marginTop: 10 }}><OtpField autoSubmit autoFocus label="6-digit code from your app" /><button className="btn p" disabled={busy}>{busy ? 'Checking…' : 'Turn on'}</button></form></li>
    </ol>
    {err && <p className="flash bad" role="alert">{err}</p>}
  </div>;
}
