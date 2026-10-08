'use client';
export default function Err({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="card" role="alert"><h2>Something went wrong</h2><p className="m" style={{ marginBottom: 12 }}>We couldn't load this page. Try again, and if it keeps happening, come back in a few minutes.{error.digest ? ` (ref ${error.digest})` : ''}</p><button className="btn p" onClick={reset}>Try again</button></div>;
}
