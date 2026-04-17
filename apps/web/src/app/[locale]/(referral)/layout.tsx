import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

interface ReferralLayoutProps {
  children: React.ReactNode;
}

export default async function ReferralLayout({ children }: ReferralLayoutProps) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className='min-h-screen bg-gradient-to-b from-primary/5 to-background'>{children}</div>
    </NextIntlClientProvider>
  );
}
