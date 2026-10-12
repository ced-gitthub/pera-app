import './globals.css';
import './polish.css'; // in-app look (hero, cards, buttons, tabs); must load after globals.css
import './joy.css'; // the shared joyful look (sign-in screens, page banners, buttons); loads last
import RegisterSW from '@/components/RegisterSW';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
export const metadata = {
  title: 'Zovix — budget & money tracker',
  description: 'Budget and money tracker. Type it, done.',
  appleWebApp: { capable: true, title: 'Zovix', statusBarStyle: 'default' as const },
};
export const viewport = { themeColor: '#5b35e8', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
