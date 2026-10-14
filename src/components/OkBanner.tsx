'use client';
import { useEffect, useState } from 'react';
import { CONFIRMED, isConfirmed } from '@/lib/okMessage';
// Read in the browser so the landing page itself stays static (served from the CDN). The live region is always on the page and only filled in afterwards, so screen readers announce it.
export default function OkBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(isConfirmed(window.location.search));
  }, []);
  return (
    <div role="status" aria-live="polite">
      {show && <p className="flash good ld-ok">{CONFIRMED} Open the Zovix app and sign in.</p>}
    </div>
  );
}
