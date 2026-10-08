'use client';
import { useRef } from 'react';
// Six-digit code box for an authenticator app: numeric keypad, one-time-code autofill, digits only, optional auto-submit on the 6th digit.
export default function OtpField({ autoSubmit = false, autoFocus = false, label = 'Authenticator code' }: { autoSubmit?: boolean; autoFocus?: boolean; label?: string }) {
  const sent = useRef(false);
  return <input className="inp otp" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="000000" required aria-label={label} autoFocus={autoFocus} spellCheck={false}
    onChange={e => { const el = e.currentTarget, v = el.value.replace(/\D/g, '').slice(0, 6); if (v !== el.value) el.value = v; if (v.length < 6) sent.current = false; else if (autoSubmit && !sent.current) { sent.current = true; el.form?.requestSubmit(); } }} />;
}
