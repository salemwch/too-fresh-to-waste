import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { CookieConsent } from './CookieConsent';

export async function CookieConsentWrapper() {
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, ['cookieConsent']);

  return (
    <NextIntlClientProvider messages={messages}>
      <CookieConsent />
    </NextIntlClientProvider>
  );
}
