'use client';

import React from 'react';

// ─── helpers ────────────────────────────────────────────────────────────────

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /loading (css )?chunk \d+ failed/i.test(error.message) ||
    /loading chunk \d+ failed/i.test(error.message)
  );
}

/** Per-path key so a chunk error on /en/dashboard doesn't block /en/home */
function reloadKey(): string {
  return `chunk_reload_${typeof window !== 'undefined' ? window.location.pathname : ''}`;
}

// ─── component ──────────────────────────────────────────────────────────────

interface State {
  hasError: boolean;
  isChunk: boolean;
}

/**
 * ChunkErrorBoundary
 *
 * Catches webpack ChunkLoadError (stale chunks after a deployment) and
 * automatically reloads the page once to fetch the latest bundles.
 * Uses sessionStorage to guard against infinite reload loops.
 *
 * After one failed auto-reload it renders a manual fallback instead of
 * looping forever.
 */
export class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunk: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      isChunk: isChunkLoadError(error),
    };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    if (isChunkLoadError(error)) {
      const key = reloadKey();
      const alreadyAttempted = sessionStorage.getItem(key) === '1';

      if (!alreadyAttempted) {
        // First attempt: mark + reload. The reload resets React state so the
        // boundary starts fresh with the new bundles.
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return;
      }
      // Second attempt: reload didn't fix it — show manual fallback below.
    }

    // Non-chunk errors: log for Sentry / other global handlers.
    console.error('[ChunkErrorBoundary]', error, info);
  }

  private handleRetry = (): void => {
    sessionStorage.removeItem(reloadKey());
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem 1rem',
          gap: '1rem',
        }}
      >
        <p style={{ fontSize: '2.5rem' }}>🔄</p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          {this.state.isChunk ? 'New version available' : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', maxWidth: 340, margin: 0 }}>
          {this.state.isChunk
            ? 'The page failed to load updated files. Refresh to get the latest version.'
            : 'An unexpected error occurred. Try refreshing the page.'}
        </p>
        <button
          onClick={this.handleRetry}
          style={{
            marginTop: '0.5rem',
            padding: '0.625rem 1.75rem',
            backgroundColor: '#1E4448',
            color: '#fff',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          Refresh page
        </button>
      </div>
    );
  }
}
