import { ImageResponse } from 'next/og';

// The picture shown when the link is shared in chats and social apps.
export const alt = 'Zovix Pera Tracker: type what you spent, Zovix does the rest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 80px',
        background: 'linear-gradient(150deg, #7a52ff, #4526c4)',
        color: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
        <div
          style={{
            display: 'flex',
            width: 84,
            height: 84,
            borderRadius: 28,
            background: '#ffc53d',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
            <polyline points="13,13 35,13 13,35 35,35" stroke="#3b2a00" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 800 }}>Zovix</div>
      </div>
      <div style={{ display: 'flex', fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        Your pesos keep disappearing.
      </div>
      <div style={{ display: 'flex', fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: '#ffc53d' }}>
        Catch them.
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 44,
          alignSelf: 'flex-start',
          padding: '16px 28px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.16)',
          fontSize: 38,
          fontWeight: 700,
        }}
      >
        lunch 150 gcash → done. Free for Android.
      </div>
    </div>,
    size,
  );
}
