import Link from 'next/link';
import { signOut } from '@/app/actions';
const L = [['/', 'Dashboard'], ['/transactions', 'Transactions'], ['/accounts', 'Accounts'], ['/budgets', 'Budgets'], ['/reports', 'Reports'], ['/assistant', 'Assistant'], ['/settings', 'Settings']];
export default function Nav() {
  return <nav className="row mb-4" aria-label="Main">{L.map(([h, n]) => <Link key={h} href={h} className="btn">{n}</Link>)}<form action={signOut} className="ml-auto"><button className="btn">Log out</button></form></nav>;
}
