import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

interface ReferralLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ReferralLayout({ children, params }: ReferralLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className='min-h-screen bg-gradient-to-b from-primary/5 to-background'>{children}</div>
    </NextIntlClientProvider>
  );
}
