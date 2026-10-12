import type { Metadata } from 'next';
import './welcome.css'; // styles for this page only
import GoogleButton from '@/components/GoogleButton';
import Welcome from '@/components/Welcome';
export const metadata: Metadata = {
  title: 'Zovix Pera Tracker: know where every peso goes',
  description: 'Try Zovix right now, no sign-up. Type what you spent and see where your money goes.',
};
export default function Page() {
  return <Welcome google={<GoogleButton />} />;
}
