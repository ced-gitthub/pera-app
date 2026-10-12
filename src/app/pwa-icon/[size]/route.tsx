import { ImageResponse } from 'next/og';

// App icon drawn in code (purple tile, the Zovix mark: a Z crossed by two peso bars), so there is no image file to maintain. "maskable" keeps the mark inside the safe zone for Android's round/squircle masks.
const SIZES: Record<string, { px: number; mark: number }> = {
  '192': { px: 192, mark: 0.64 },
  '512': { px: 512, mark: 0.64 },
  maskable: { px: 512, mark: 0.44 },
};
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params,
    s = SIZES[size];
  if (!s) return new Response('Not found', { status: 404 });
  const m = s.px * s.mark;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #7a52ff, #4b27d6)',
        borderRadius: size === 'maskable' ? 0 : s.px * 0.22,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: m * 1.25,
          height: m * 1.25,
          borderRadius: m * 0.34,
          background: '#ffc53d',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={m} height={m} viewBox="0 0 48 48" fill="none">
          <polyline points="13,13 35,13 13,35 35,35" stroke="#3b2a00" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="20.5" x2="38" y2="20.5" stroke="#3b2a00" strokeWidth="3.4" strokeLinecap="round" />
          <line x1="10" y1="26.5" x2="38" y2="26.5" stroke="#3b2a00" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>,
    { width: s.px, height: s.px, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
