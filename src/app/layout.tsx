import './globals.css';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
export const metadata = { title: 'Pera — money tracker', description: 'Track every peso. Type it, done.' };
export const viewport = { themeColor: '#5b35e8', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Root({ children }: { children: React.ReactNode }) { return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>; }
