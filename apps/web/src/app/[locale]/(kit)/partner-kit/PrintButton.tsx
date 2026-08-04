'use client';

import Link from 'next/link';

export function PrintButton() {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50, display: 'flex', gap: 12 }}>
      <Link
        href='/partners'
        style={{
          background: 'white',
          color: '#1E4448',
          border: '1px solid rgba(30,68,72,0.2)',
          borderRadius: 9999,
          padding: '10px 20px',
          fontSize: 13,
          textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          transition: 'all 0.2s',
        }}
      >
        ← Back
      </Link>
      <button
        onClick={() => window.print()}
        style={{
          background: '#1E4448',
          color: 'white',
          border: 'none',
          borderRadius: 9999,
          padding: '10px 24px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        Print / Save PDF
      </button>
    </div>
  );
}
