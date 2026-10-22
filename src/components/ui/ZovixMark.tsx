// The Zovix mark: a bold Z crossed by two horizontal bars, the way the peso sign (₱) is. Drawn as strokes so it stays sharp at any size.
export const MARK = {
  z: '13,13 35,13 13,35 35,35',
  bars: [
    [10, 20.5, 38, 20.5],
    [10, 26.5, 38, 26.5],
  ] as [number, number, number, number][],
};
export function MarkSvg({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <polyline points={MARK.z} stroke={color} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      {MARK.bars.map(([x1, y1, x2, y2]) => (
        <line key={y1} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      ))}
    </svg>
  );
}
export default function ZovixMark() {
  return (
    <span className="logo" role="img" aria-label="Zovix">
      <MarkSvg size={24} />
    </span>
  );
}
