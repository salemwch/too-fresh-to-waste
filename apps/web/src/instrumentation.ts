// Next.js instrumentation hook — runs once per server process start.
// @sentry/nextjs reads this file to initialize server and edge Sentry instances.
// Do NOT add application logic here; keep it purely for SDK registration.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
