import { ImageResponse } from 'next/og';

// App icon drawn in code (purple tile, white "P"), so there is no image file to maintain. "maskable" keeps the letter inside the safe zone for Android's round/squircle masks.
const SIZES: Record<string, { px: number; letter: number }> = {
  '192': { px: 192, letter: 0.62 },
  '512': { px: 512, letter: 0.62 },
  maskable: { px: 512, letter: 0.42 },
};
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params,
    s = SIZES[size];
  if (!s) return new Response('Not found', { status: 404 });
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#5b35e8',
        color: '#ffffff',
        fontSize: s.px * s.letter,
        fontWeight: 800,
        borderRadius: size === 'maskable' ? 0 : s.px * 0.22,
      }}
    >
      Z
    </div>,
    { width: s.px, height: s.px, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
