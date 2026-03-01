import type { ReactNode } from 'react';

// Intentional bare passthrough required by Next.js app router.
// The real <html> and <body> tags are rendered in app/[locale]/layout.tsx,
// which sets locale-aware attributes (lang, dir, fonts, providers).
// The "Missing <html>/<body>" dev warning is a Next.js false positive for
// this well-known next-intl i18n routing pattern — it does not affect runtime.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
