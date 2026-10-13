import type { Metadata } from 'next';
import './welcome.css'; // shared landing styles
import './landing.css';
import Landing from '@/components/Landing';
import type { SP } from '@/components/ui';
export const metadata: Metadata = {
  title: 'Zovix Pera Tracker: know where every peso goes',
  description: 'Free money tracker for Filipinos. Type "lunch 150 gcash" and Zovix sorts it. Download for Android. No ads, no bank login.',
  openGraph: { title: 'Zovix Pera Tracker', description: 'Type what you spent. Zovix does the rest. Free for Android.', type: 'website' },
};
export default async function Page({ searchParams }: { searchParams: SP }) {
  const ok = (await searchParams).ok;
  return <Landing ok={ok && ok.length < 120 ? ok : undefined} />;
}
