'use client';
import { useEffect, useState } from 'react';
import { APK_URL } from '@/lib/landing/site';
// A bottom download bar that only appears once the hero button has been scrolled past, and steps aside again when the final button is on screen.
export default function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('get-hero'),
      end = document.getElementById('join');
    if (!hero || !('IntersectionObserver' in window)) {
      setShow(true);
      return;
    }
    let heroPast = false,
      endSeen = false;
    const update = () => setShow(heroPast && !endSeen);
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.target === hero)
          heroPast = !e.isIntersecting && e.boundingClientRect.top < 0; // only once scrolled PAST it, not while it is still below the fold
        else endSeen = e.isIntersecting;
      }
      update();
    });
    io.observe(hero);
    if (end) io.observe(end);
    return () => io.disconnect();
  }, []);
  return (
    <div className={show ? 'ld-sticky on' : 'ld-sticky'} aria-hidden={!show}>
      <a className="btn p wl-big ld-cta" href={APK_URL} download id="get-sticky" tabIndex={show ? 0 : -1}>
        ⬇ Get Zovix free
      </a>
    </div>
  );
}
