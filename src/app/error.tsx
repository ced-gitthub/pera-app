'use client';
export default function Err({ error, reset }: { error: Error; reset: () => void }) {
  return <div className="card" role="alert"><h2>Something went wrong</h2><p>{error.message}</p><button className="btn p" onClick={reset}>Try again</button></div>;
}
