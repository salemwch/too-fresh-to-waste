import * as Sentry from '@sentry/nextjs';

// Next.js instrumentation hook — runs once per server process start.
// @sentry/nextjs reads this file to initialize server and edge Sentry instances.
// Do NOT add application logic here; keep it purely for SDK registration.

// Captures errors thrown by nested React Server Components (Next.js 15+).
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
