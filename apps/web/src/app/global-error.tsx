'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#dc2626' }}>500</h1>
        <p style={{ fontSize: '1.125rem', color: '#64748b', marginTop: '0.5rem' }}>
          Something went wrong
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            padding: '0.625rem 1.5rem',
            backgroundColor: '#005250',
            color: '#fff',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
