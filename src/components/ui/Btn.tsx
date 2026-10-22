'use client';
import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes } from 'react';

// A submit button that disables itself while its form is saving (stops double-taps creating duplicates).
// Pass `confirm="Delete this account?"` to ask first; cancelling stops the submit.
export function Btn({ confirm: msg, onClick, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...p}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (msg && !window.confirm(msg)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
