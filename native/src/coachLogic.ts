// Pure geometry for the live coach-mark tour. No React here, so it is unit-tested (tests/native-coach.test.ts).
export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Placement = { side: 'above' | 'below' | 'center'; top: number; left: number; arrowX: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, hi < lo ? lo : v));

// The spotlight hole: the control's rect, grown by pad and kept inside the screen.
export function padRect(r: Rect, pad: number, screen: Size): Rect {
  const x = clamp(r.x - pad, 0, screen.w);
  const y = clamp(r.y - pad, 0, screen.h);
  const x2 = clamp(r.x + r.w + pad, 0, screen.w);
  const y2 = clamp(r.y + r.h + pad, 0, screen.h);
  return { x, y, w: x2 - x, h: y2 - y };
}

// Where the tooltip goes. edge.top / edge.bottom are the unusable bands (status bar, tab bar). gap = room for the arrow.
// Prefers below the hole, then above, else the roomier side, always clamped on screen. arrowX is measured from the tooltip's left edge.
export function placeTip(
  hole: Rect | null,
  screen: Size,
  tip: Size,
  edge: { top: number; bottom: number },
  gap: number,
  margin: number,
): Placement {
  const minTop = edge.top;
  const maxTop = screen.h - edge.bottom - tip.h;
  if (!hole)
    return {
      side: 'center',
      top: clamp((screen.h - tip.h) / 2, minTop, maxTop),
      left: clamp((screen.w - tip.w) / 2, 0, screen.w),
      arrowX: tip.w / 2,
    };
  const below = screen.h - edge.bottom - (hole.y + hole.h);
  const above = hole.y - edge.top;
  const need = tip.h + gap;
  const side: 'above' | 'below' = below >= need ? 'below' : above >= need ? 'above' : below >= above ? 'below' : 'above';
  const raw = side === 'below' ? hole.y + hole.h + gap : hole.y - gap - tip.h;
  const left = clamp(hole.x + hole.w / 2 - tip.w / 2, margin, screen.w - tip.w - margin);
  const arrowX = clamp(hole.x + hole.w / 2 - left, margin, tip.w - margin);
  return { side, top: clamp(raw, minTop, maxTop), left, arrowX };
}

// How far (in px) the scroll view must move so the target sits inside the visible band. 0 when it already does.
export function scrollDelta(r: Rect, band: { top: number; bottom: number }, margin: number): number {
  if (r.y < band.top + margin) return r.y - (band.top + margin);
  if (r.y + r.h > band.bottom - margin) {
    const down = r.y + r.h - (band.bottom - margin);
    return Math.min(down, r.y - (band.top + margin)); // never push the top edge out of view
  }
  return 0;
}

export const sameRect = (a: Rect | null, b: Rect | null, tol = 1): boolean =>
  !!a && !!b && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;

// Next / Back with clamping. done = Next pressed on the last step.
export function nextIndex(i: number, n: number, dir: 1 | -1): { index: number; done: boolean } {
  const k = i + dir;
  if (k >= n) return { index: n - 1, done: dir === 1 };
  return { index: Math.max(0, k), done: false };
}
