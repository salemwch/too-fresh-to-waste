import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { MerchantLayoutShell } from './merchant-layout-shell';

// Only the namespaces used by merchant dashboard client components.
// Saves ~41 % of the serialised translation payload vs. sending all messages.
const MERCHANT_NAMESPACES = ['dashboard', 'common', 'accessibility'] as const;

interface MerchantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MerchantLayout({ children, params }: MerchantLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, MERCHANT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <MerchantLayoutShell>{children}</MerchantLayoutShell>
    </NextIntlClientProvider>
  );
}
