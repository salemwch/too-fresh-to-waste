import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#005250' }}>404</h1>
        <p style={{ fontSize: '1.125rem', color: '#64748b', marginTop: '0.5rem' }}>
          Page not found
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.625rem 1.5rem',
            backgroundColor: '#005250',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Go Home
        </Link>
      </body>
    </html>
  );
}
