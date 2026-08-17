import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { NOINDEX_METADATA } from '@/lib/seo-metadata';

// Authenticated / transactional area — must never enter the search index.
export const metadata = NOINDEX_METADATA;

const ONBOARDING_NAMESPACES = ['merchantSignup', 'common'] as const;

interface OnboardingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function OnboardingLayout({ children, params }: OnboardingLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, ONBOARDING_NAMESPACES);

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
