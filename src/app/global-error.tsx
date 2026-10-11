'use client';
// Last-resort error page: shown when the root layout itself fails. It must render its own <html> and <body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 480, margin: '0 auto' }}>
        <main role="alert">
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p>Zovix couldn't load. Try again, and if it keeps happening, come back in a few minutes. Your data is safe.</p>
          <button onClick={reset} style={{ padding: '10px 16px', fontSize: 16 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
