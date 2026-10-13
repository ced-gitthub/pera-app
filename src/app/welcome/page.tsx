import type { Metadata } from 'next';
import './welcome.css'; // shared landing styles
import './landing.css';
import Landing from '@/components/Landing';
import type { SP } from '@/components/ui';
import { landingPath } from '@/lib/site';
const CONFIRMED = 'Email confirmed. Welcome to Zovix.';
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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zovix Pera Tracker',
    description: 'Type what you spent. Zovix does the rest. Free for Android.',
  },
};
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ok = (await searchParams).ok === CONFIRMED ? CONFIRMED : undefined; // only the fixed message from the email-confirmed redirect, never free text from the URL
  return <Landing ok={ok} />;
}
