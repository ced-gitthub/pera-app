'use client';
import { useEffect, useState } from 'react';
// The email-confirmed link lands on the landing page with ?ok=<message>. It is read in the browser so the page itself stays static (served from the CDN, no function run per visit).
// Only the one fixed message is ever shown, never free text from the URL.
const CONFIRMED = 'Email confirmed. Welcome to Zovix.';
export default function OkBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get('ok') === CONFIRMED);
  }, []);
  if (!show) return null;
  return (
    <p className="flash good ld-ok" role="status">
      {CONFIRMED} Open the Zovix app and sign in.
    </p>
  );
}
