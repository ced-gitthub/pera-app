'use client';
import { useEffect } from 'react';
// Scroll motion for the landing page. Each kind of block gets its own entrance (cards tilt in, step badges spin, bars fill, ladder rungs light up one by one,
// the comparison sweeps, the closing section rains coins), driven by the scroll position. Content is NEVER hidden unless this script runs:
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
    // "Reduce motion" (also switched on by many Android power-saving modes) gets the CALM tier: blocks still fade in as you scroll and bars still fill,
    // but nothing moves, tilts, spins, floats or rains. Switching everything off made the page feel dead on those phones.
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    document.documentElement.classList.add('fx');
    if (calm) document.documentElement.classList.add('fx-calm');
    // Reveals follow the scroll position directly (no viewport-observer API: some browsers delay or skip it, which would leave content hidden).
    // A light poll (a few cheap rect reads per second, only while something is still hidden) backs up the scroll event, because a throttled or
    // backgrounded page may fire no scroll event and paint no frame. Blocks already on screen at load are shown as they are, with no hidden state first.
    let pending = els;
    let timer = 0;
    const check = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight || 800;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) {
          el.dataset.in = '1';
          return false;
        }
        return true;
      });
      if (!pending.length) stop();
    };
    const stop = () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    pending.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || document.documentElement.clientHeight || 800) * 0.95 && r.bottom > 0) el.dataset.in = '1';
    });
    pending = pending.filter((el) => !el.dataset.in);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    timer = window.setInterval(check, 150);
    return () => {
      stop();
      document.documentElement.classList.remove('fx', 'fx-calm');
    };
  }, []);
  return null;
}
