import { ImageResponse } from 'next/og';

// iPhone home-screen icon (iOS applies its own rounded corners, so the tile is square). Same mark as the app icon.
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
        background: 'linear-gradient(145deg, #7a52ff, #4b27d6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 112,
          height: 112,
          borderRadius: 38,
          background: '#ffc53d',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="84" height="84" viewBox="0 0 48 48" fill="none">
          <polyline points="13,13 35,13 13,35 35,35" stroke="#3b2a00" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="20.5" x2="38" y2="20.5" stroke="#3b2a00" strokeWidth="3.4" strokeLinecap="round" />
          <line x1="10" y1="26.5" x2="38" y2="26.5" stroke="#3b2a00" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>,
    size,
  );
}
