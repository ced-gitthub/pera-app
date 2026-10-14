import type { Metadata } from 'next';
import './welcome.css'; // shared landing styles
import './landing.css';
import './motion.css';
import Landing from '@/components/Landing';
import { landingPath } from '@/lib/site';
export const metadata: Metadata = {
  title: 'Zovix Pera Tracker: know where every peso goes',
  description: 'Free money tracker for Filipinos. Type "lunch 150 gcash" and Zovix sorts it. Download for Android. No ads, no bank login.',
  alternates: { canonical: landingPath() },
  openGraph: {
    title: 'Zovix Pera Tracker',
    description: 'Type what you spent. Zovix does the rest. Free for Android.',
    type: 'website',
    url: landingPath(),
    siteName: 'Zovix',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image'],
    title: 'Zovix Pera Tracker',
    description: 'Type what you spent. Zovix does the rest. Free for Android.',
  },
};
// Nothing request-specific is read here on purpose: the page is prerendered once and served from the CDN (see next.config.mjs), so a visit costs no function run.
export default function Page() {
  return <Landing />;
}
