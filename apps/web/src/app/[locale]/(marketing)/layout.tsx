import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { Footer } from '@/components/layout';
import { Newsletter } from '@/components/sections';
import { AppLaunchModal } from '@/components/sections/AppLaunchModal';

// Marketing pages are static content — revalidate every 24h (ISR).
// Vercel serves cached HTML instantly; regenerates in background when stale.
// Lower this value if marketing copy changes frequently.
export const revalidate = 86400;

// Only the namespaces actually used by marketing client components.
// Saves ~67 % of the serialised translation payload vs. sending all messages.
const MARKETING_NAMESPACES = [
  'hero',
  'rollout',
  'audienceSplit',
  'rewards',
  'dream',
  'careers',
  'missionDriven',
  'header',
  'footer',
  'section2',
  'section3',
  'section4',
  'section5',
  'marquee',
  'newsletter',
  'merchantSignup',
  'features',
  'howItWorks',
  'comingSoon',
  'appLaunchModal',
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
  'humanityMission',
  'foodWasteFacts',
  'blog',
  'parclessBag',
] as const;

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, MARKETING_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      {/* Main content */}
      <div id='main-content'>{children}</div>

      {/* Newsletter */}
      <Newsletter />

      {/* Footer */}
      <Footer />

      {/* App launch modal - triggered by all download buttons */}
      <AppLaunchModal />
    </NextIntlClientProvider>
  );
}
