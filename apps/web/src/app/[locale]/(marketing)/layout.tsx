import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { type Locale } from '@/i18n/config';
import { pickMessages } from '@/lib/pick-messages';
import {
  OrganizationStructuredData,
  WebsiteStructuredData,
  MobileApplicationStructuredData,
} from '@/components/StructuredData';
import { Footer } from '@/components/layout';
import { Newsletter } from '@/components/sections';

// Marketing pages are static content — revalidate every 24h (ISR).
// Vercel serves cached HTML instantly; regenerates in background when stale.
// Lower this value if marketing copy changes frequently.
export const revalidate = 86400;

// Only the namespaces actually used by marketing client components.
// Saves ~67 % of the serialised translation payload vs. sending all messages.
const MARKETING_NAMESPACES = [
  'hero',
  'header',
  'footer',
  'section2',
  'section3',
  'section4',
  'section5',
  'marquee',
  'newsletter',
  'merchantSignup',
  'businessSignup',
  'features',
  'howItWorks',
  'comingSoon',
  'download',
  'cta',
  'testimonials',
  'nav',
  'common',
  'accessibility',
  'metadata',
  'business',
  'companies',
  'contact',
] as const;

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, MARKETING_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      {/* Structured Data for SEO */}
      <OrganizationStructuredData locale={locale as Locale} />
      <WebsiteStructuredData locale={locale as Locale} />
      <MobileApplicationStructuredData locale={locale as Locale} />

      {/* Main content */}
      <div id='main-content'>{children}</div>

      {/* Newsletter */}
      <Newsletter />

      {/* Footer */}
      <Footer />
    </NextIntlClientProvider>
  );
}
