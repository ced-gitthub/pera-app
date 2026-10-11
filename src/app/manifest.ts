import type { MetadataRoute } from 'next';

// Makes Pera installable on Android and iPhone ("Add to Home Screen") and is the base for the Play Store (TWA) version.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pera - money tracker',
    short_name: 'Pera',
    description: 'Track every peso. Type it, done.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#5b35e8',
    lang: 'en-PH',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
