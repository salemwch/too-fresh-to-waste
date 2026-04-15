'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// global-error.tsx catches unhandled errors from the root layout tree.
// It must render its own <html> and <body> because the normal layout is unavailable.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang='en'>
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#dc2626' }}>500</h1>
        <p style={{ fontSize: '1.125rem', color: '#64748b', marginTop: '0.5rem' }}>
          Something went wrong
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            padding: '0.625rem 1.5rem',
            backgroundColor: '#1E4448',
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
