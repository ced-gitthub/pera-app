'use client';
import { useEffect } from 'react';

// Registers the offline-page service worker (public/sw.js). Failure is harmless: the app works the same without it.
export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
