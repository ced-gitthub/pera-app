'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions';
const I: Record<string, string> = {
  '/': 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  '/transactions': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  '/accounts': 'M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2',
  '/budgets': 'M12 3a9 9 0 109 9h-9zM15 3.5A9 9 0 0120.5 9H15z',
  '/reports': 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  '/assistant': 'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z',
  '/settings': 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
};
const L: [string, string, string][] = [['/', 'Home', 'Dashboard'], ['/transactions', 'Txns', 'Transactions'], ['/accounts', 'Accounts', 'Accounts'], ['/budgets', 'Budgets', 'Budgets'], ['/reports', 'Reports', 'Reports'], ['/assistant', 'Ask', 'Assistant'], ['/settings', 'Settings', 'Settings']];
const Ic = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
export function Brand() { return <div className="brand"><span className="logo">₱</span>Pera</div>; }
export default function Nav() {
  const p = usePathname(), on = (h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(h + '/'));
  return <>
    <header className="top"><Brand /><form action={signOut}><button className="linkbtn">Log out</button></form></header>
    <aside className="side"><Brand /><nav aria-label="Main" style={{ display: 'grid', gap: 4 }}>{L.map(([h, , n]) => <Link key={h} href={h} className="nl" aria-current={on(h) ? 'page' : undefined}><Ic d={I[h]} />{n}</Link>)}</nav><form action={signOut}><button className="linkbtn">Log out</button></form></aside>
    <nav className="tabs" aria-label="Main">{L.map(([h, s]) => <Link key={h} href={h} className="tab" aria-current={on(h) ? 'page' : undefined}><Ic d={I[h]} />{s}</Link>)}</nav>
  </>;
}
