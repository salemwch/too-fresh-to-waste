import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Header } from '@/components/layout';
import {
  Section2,
  Section3Animated,
  Section4,
  Section5,
  InfiniteMarquee,
  RolloutMap,
} from '@/components/sections';
import { HashScrollHandler } from '@/components/HashScrollHandler';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { locales, getLocaleConfig } from '@/i18n/config';
import { OrganizationSchema, WebSiteSchema, FAQSchema } from '@/components/seo/schemas';
import { getCanonicalUrl, getLocaleSeoMetadata } from '@/config/seo.config';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as Locale;
  const localeMetadata = getLocaleSeoMetadata(loc);

  const alternateLanguages: Record<string, string> = {};
  locales.forEach(l => {
    alternateLanguages[getLocaleConfig(l).hreflang] = getCanonicalUrl('/', l);
  });
  alternateLanguages['x-default'] = getCanonicalUrl('/', 'en');

  return {
    title: localeMetadata.title,
    description: localeMetadata.description,
    alternates: {
      canonical: getCanonicalUrl('/', loc),
      languages: alternateLanguages,
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  // FAQPage schema for the questions Section5 renders below. Read from the same
  // translation keys the component uses, so the markup can never describe
  // questions that are not actually on the page — which is what earns the
  // rich result and what gets it revoked if it drifts.
  const tFaq = await getTranslations({ locale, namespace: 'section5' });
  const faqItems = (['faq1', 'faq2', 'faq3', 'faq4'] as const).map(key => ({
    question: tFaq(`faqs.${key}.question`),
    answer: tFaq(`faqs.${key}.answer`)
      .replace(/\s*\n\s*/g, ' ')
      .trim(),
  }));

  return (
    <>
      <OrganizationSchema locale={locale as Locale} />
      <WebSiteSchema locale={locale as Locale} />
      <FAQSchema items={faqItems} />
      <HashScrollHandler />
      <Header />

      <main role='main'>
        {/* Hero Section with 3D Phone Mockups */}
        <HeroSection locale={locale as Locale} />

        {/* Where we are open, and which city opens next */}
        <RolloutMap showStoryLink />

        {/* Section 2: App Introduction with Download Buttons */}
        <Section2 />

        {/* Section 3: Why Use Too Fresh To Waste - Animated "Cycle of Good" */}
        <Section3Animated />

        {/* Section 4: How to Use the App & Get Points - Card Carousel */}
        <Section4 />

        {/* Section 5: FAQ - Frequently Asked Questions */}
        <Section5 />

        {/* Infinite Marquee - Features Ticker */}
        <InfiniteMarquee />
      </main>
    </>
  );
}

// Client component for translations
/**
 * Phone screens in the 3D fan, back to front. The centre one is the LCP
 * candidate on most viewports, so only it gets `fetchPriority`.
 */
const HERO_PHONES = [
  {
    src: '/images/profile.webp',
    alt: 'Profile Screen',
    className: 'w-28 md:w-36 lg:w-44 h-auto opacity-90',
    sizes: '(max-width: 768px) 112px, (max-width: 1024px) 144px, 176px',
    transform:
      'perspective(1500px) rotateY(-20deg) translateX(-40px) translateZ(-100px) scale(0.85)',
    zIndex: 10,
    shadow: { bottom: '-15px', width: '80%', height: '12px', blur: '8px', alpha: 0.7 },
    lead: false,
  },
  {
    src: '/images/getstarted.webp',
    alt: 'Get Started Screen',
    className: 'w-36 md:w-44 lg:w-52 h-auto',
    sizes: '(max-width: 768px) 144px, (max-width: 1024px) 176px, 208px',
    transform: 'perspective(1500px) rotateY(0deg) translateZ(80px) scale(1)',
    zIndex: 20,
    shadow: { bottom: '-18px', width: '85%', height: '16px', blur: '10px', alpha: 0.8 },
    lead: true,
  },
  {
    src: '/images/login.webp',
    alt: 'Login Screen',
    className: 'w-28 md:w-36 lg:w-44 h-auto opacity-90',
    sizes: '(max-width: 768px) 112px, (max-width: 1024px) 144px, 176px',
    transform: 'perspective(1500px) rotateY(20deg) translateX(40px) translateZ(-100px) scale(0.85)',
    zIndex: 10,
    shadow: { bottom: '-15px', width: '80%', height: '12px', blur: '8px', alpha: 0.7 },
    lead: false,
  },
] as const;

function HeroSection({ locale }: { locale: Locale }) {
  const t = useTranslations('hero');
  const isRTL = locale === 'ar';

  // Korolev carries no Arabic glyphs, so Arabic stays on the Noto Sans Arabic
  // stack the root layout selects rather than falling back mid-headline.
  const headingFont = isRTL ? 'font-sans' : 'font-heading';

  return (
    /*
     * The section fills the first screen so nothing from the block below
     * shows through on load. `svh` rather than `vh`: mobile browsers measure
     * `vh` against the viewport with the address bar hidden, which leaves a
     * strip of the next section visible until the user scrolls.
     */
    <section
      id='hero'
      className='bg-primary-500 relative flex min-h-[100svh] items-center overflow-hidden px-4 py-12 md:py-16 lg:py-24'
      aria-labelledby='hero-heading'
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className='mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14'>
        {/* ── Copy column ── */}
        <div className='text-center font-sans lg:text-start'>
          <h1
            id='hero-heading'
            className={`${headingFont} text-white drop-shadow-md`}
            style={{
              fontSize: 'clamp(2rem, 5.2vw, 3.5rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
            }}
          >
            {t('headline')}
          </h1>

          {/* The slogan, moved down from its old role as the page heading. */}
          <p className='mt-4 text-secondary text-lg font-semibold md:text-xl'>{t('tagline')}</p>

          <p className='mt-4 max-w-xl text-white/80 text-sm leading-relaxed md:text-base lg:mx-0 mx-auto'>
            {t('subheadline')}
          </p>

          {/* Objection handling, in three claims that are all verifiable in
              product: signup is free, the split is 81/19, and the merchant
              chooses price and quantity in the create-offer panel. */}
          <ul className='mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start'>
            {(['join', 'share', 'control'] as const).map(key => (
              <li key={key} className='flex items-center gap-2 text-white/75 text-xs md:text-sm'>
                <span aria-hidden='true' className='bg-secondary size-1.5 shrink-0 rounded-full' />
                {t(`trust.${key}`)}
              </li>
            ))}
          </ul>

          <div className='mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start'>
            <Link
              href='/business-signup'
              className='bg-secondary text-primary-500 hover:bg-white rounded-full px-7 py-3.5 text-center text-sm font-bold tracking-wide whitespace-nowrap outline-none transition-all duration-300 hover:scale-105 sm:text-base'
              aria-label={t('cta.merchant')}
            >
              {t('cta.merchant')}
            </Link>
            <AppDownloadButton
              className='hover:text-primary-500 rounded-full border-[0.5px] border-white px-7 py-3.5 text-center text-sm font-bold tracking-wide whitespace-nowrap text-white outline-none transition-all duration-300 hover:scale-105 hover:bg-white sm:text-base'
              aria-label={t('cta.download')}
            >
              {t('cta.download')}
            </AppDownloadButton>
          </div>
        </div>

        {/* ── Phone column ── */}
        <div
          className='flex items-start justify-center'
          style={{ perspective: '1500px', perspectiveOrigin: 'center center' }}
        >
          {HERO_PHONES.map(phone => (
            <div
              key={phone.src}
              className='relative transition-all duration-700 ease-out hover:scale-105'
              style={{
                transform: phone.transform,
                transformStyle: 'preserve-3d',
                zIndex: phone.zIndex,
              }}
            >
              <div className='relative'>
                <Image
                  src={phone.src}
                  alt={phone.alt}
                  width={390}
                  height={844}
                  sizes={phone.sizes}
                  className={phone.className}
                  priority
                  {...(phone.lead ? { fetchPriority: 'high' as const } : {})}
                />
                <div
                  className='absolute left-1/2 -translate-x-1/2'
                  style={{
                    bottom: phone.shadow.bottom,
                    width: phone.shadow.width,
                    height: phone.shadow.height,
                    background: `radial-gradient(ellipse, rgba(0, 0, 0, ${phone.shadow.alpha}) 0%, rgba(0, 0, 0, ${phone.shadow.alpha / 2}) 50%, transparent 80%)`,
                    filter: `blur(${phone.shadow.blur})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
