import { redirect } from '@/i18n/routing';

import type { Locale } from '@/i18n/config';

interface ComingSoonPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * The launch placeholder is retired; anyone still holding the link goes home.
 *
 * This redirects through `@/i18n/routing` rather than `next/navigation`, and
 * passes the locale it was reached in. The previous `redirect('/')` dropped the
 * prefix, so a reader arriving at `/fr/coming-soon` landed on the English home
 * page - a language switch they did not ask for, at the first URL they tried.
 */
export default async function ComingSoonPage({ params }: ComingSoonPageProps) {
  const { locale } = await params;
  redirect({ href: '/', locale: locale as Locale });
}
