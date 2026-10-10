'use client';
import { useState } from 'react';
// An amount field with a ± button: phone number pads have no minus key, and a starting balance can be negative (a debt).
export default function MoneyInput({ name, defaultValue = '', label, placeholder }: { name: string; defaultValue?: string; label: string; placeholder?: string }) {
  const [v, setV] = useState(defaultValue), neg = v.trim().startsWith('-');
  return <span className="money"><input className="inp" name={name} value={v} onChange={e => setV(e.target.value)} inputMode="decimal" aria-label={label} placeholder={placeholder} autoComplete="off" />
    <button type="button" className="btn pm" aria-label={neg ? 'Make positive' : 'Make negative (debt)'} aria-pressed={neg} onClick={() => setV(neg ? v.trim().slice(1) : '-' + v.trim().replace(/^[+-]/, ''))}>±</button></span>;
}
