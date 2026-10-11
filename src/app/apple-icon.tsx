import { ImageResponse } from 'next/og';

// iPhone home-screen icon (iOS applies its own rounded corners, so the tile is square).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export default function AppleIcon() {
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
        fontSize: 112,
        fontWeight: 800,
      }}
    >
      Z
    </div>,
    size,
  );
}
