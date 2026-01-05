// Root layout is minimal - all content is handled by [locale]/layout.tsx
// This file exists only for Next.js structure requirements

import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
