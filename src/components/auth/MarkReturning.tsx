'use client';
import { useEffect } from 'react';
// Remembers (in a plain cookie, no personal data) that this device has used the app, so the login page can say "Welcome back" and the front door skips the sample.
export default function MarkReturning() {
  useEffect(() => {
    document.cookie = `zovix_seen=1; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }, []);
  return null;
}
