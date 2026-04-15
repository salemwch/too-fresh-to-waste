import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';

const ONBOARDING_NAMESPACES = ['merchantSignup', 'common'] as const;

interface OnboardingLayoutProps {
  children: React.ReactNode;
}

export default async function OnboardingLayout({ children }: OnboardingLayoutProps) {
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, ONBOARDING_NAMESPACES);

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
