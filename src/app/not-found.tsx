import Link from 'next/link';
export default function NotFound() {
  return <main className="card" style={{ maxWidth: 480, margin: '48px auto' }}><h1>Page not found</h1><p className="m" style={{ marginBottom: 12 }}>That page doesn't exist or was moved.</p><Link className="btn p" href="/">Go to Pera</Link></main>;
}
