'use client';
import { useEffect } from 'react';
// Scroll motion for the landing page. Each kind of block gets its own entrance (cards tilt in, step badges spin, bars fill, ladder rungs light up one by one,
// the comparison sweeps, the closing section rains coins), driven by one IntersectionObserver. Content is NEVER hidden unless this script runs:
// no script, or "reduce motion" in the phone settings, means everything simply shows. Blocks already on screen at load are not hidden at all.
const TARGETS: [string, string][] = [
  ['main.ld h2', 'h2'],
  ['main.ld .ld-what .wl-card', 'card'],
  ['main.ld .wl-grid .wl-card', 'card'],
  ['main.ld .wl-steps li', 'row'],
  ['main.ld .ld-sample', 'card'],
  ['main.ld .ld-res li', 'check'],
  ['main.ld .ld-cmp tbody tr', 'row'],
  ['main.ld .wl-rung', 'rung'],
  ['main.ld .ld-quests li', 'chip'],
  ['main.ld .wl-gbar', 'fill'],
  ['main.ld .ld-faq', 'row'],
  ['main.ld .ld-info', 'card'],
  ['main.ld .wl-final', 'burst'],
];
export default function ScrollFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const els: HTMLElement[] = [];
    for (const [selector, kind] of TARGETS) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (el.dataset.fx) return;
        el.dataset.fx = kind;
        // stagger among siblings of the same kind, capped so a long list never waits
        const sibs = el.parentElement ? Array.from(el.parentElement.children).filter((c) => (c as HTMLElement).dataset.fx === kind) : [el];
        el.style.setProperty('--i', String(Math.min(sibs.indexOf(el), 5)));
        els.push(el);
      });
    }
    const vh = window.innerHeight;
    const pending = els.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > 0) {
        el.dataset.in = '1'; // already on screen: show as is, no hidden state first
        return false;
      }
      return true;
    });
    document.documentElement.classList.add('fx');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = '1';
            io.unobserve(e.target);
          }
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
    );
    pending.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.documentElement.classList.remove('fx');
    };
  }, []);
  return null;
}
