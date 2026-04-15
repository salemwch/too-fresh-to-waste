import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { MerchantLayoutShell } from './merchant-layout-shell';

// Only the namespaces used by merchant dashboard client components.
// Saves ~41 % of the serialised translation payload vs. sending all messages.
const MERCHANT_NAMESPACES = ['dashboard', 'common', 'accessibility'] as const;

interface MerchantLayoutProps {
  children: React.ReactNode;
}

export default async function MerchantLayout({ children }: MerchantLayoutProps) {
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, MERCHANT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <MerchantLayoutShell>{children}</MerchantLayoutShell>
    </NextIntlClientProvider>
  );
}
