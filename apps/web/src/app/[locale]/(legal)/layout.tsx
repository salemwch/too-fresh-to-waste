import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { Header, Footer } from '@/components/layout';

// Legal pages are static — revalidate once a month.
export const revalidate = 2592000;

// Only the namespaces needed by Header and Footer client components.
const LEGAL_NAMESPACES = ['header', 'footer', 'nav', 'common'] as const;

interface LegalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LegalLayout({ children, params }: LegalLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, LEGAL_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <Header />
      <main id='main-content'>{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
