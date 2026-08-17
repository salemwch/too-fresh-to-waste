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
} from '@/components/sections';
import { HashScrollHandler } from '@/components/HashScrollHandler';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';
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
function HeroSection({ locale }: { locale: Locale }) {
  const t = useTranslations('hero');
  const isRTL = locale === 'ar';

  return (
    <section
      id='hero'
      className='bg-primary-500 flex flex-col items-center justify-center px-4 py-12 md:py-16 relative overflow-hidden'
      aria-labelledby='hero-heading'
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 3D Phone Mockup Stack - Positioned Above Title */}
      <div
        className='flex items-start justify-center gap-0'
        style={{
          perspective: '1500px',
          perspectiveOrigin: 'center center',
        }}
      >
        {/* Left Phone - Profile (Back Layer) */}
        <div
          className='relative transition-all duration-700 ease-out hover:scale-105'
          style={{
            transform:
              'perspective(1500px) rotateY(-20deg) translateX(-40px) translateZ(-100px) scale(0.85)',
            transformStyle: 'preserve-3d',
            zIndex: 10,
          }}
        >
          <div className='relative'>
            <Image
              src='/images/profile.webp'
              alt='Profile Screen'
              width={390}
              height={844}
              sizes='(max-width: 768px) 128px, (max-width: 1024px) 176px, 208px'
              className='w-32 md:w-44 lg:w-52 h-auto opacity-90'
              priority
            />
            <div
              className='absolute left-1/2 -translate-x-1/2'
              style={{
                bottom: '-15px',
                width: '80%',
                height: '12px',
                background:
                  'radial-gradient(ellipse, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 50%, transparent 80%)',
                filter: 'blur(8px)',
              }}
            />
          </div>
        </div>

        {/* Center Phone - Get Started (Front Layer - Hero) */}
        <div
          className='relative transition-all duration-700 ease-out hover:scale-110 hover:translateZ-[100px]'
          style={{
            transform: 'perspective(1500px) rotateY(0deg) translateZ(80px) scale(1)',
            transformStyle: 'preserve-3d',
            zIndex: 20,
          }}
        >
          <div className='relative'>
            <Image
              src='/images/getstarted.webp'
              alt='Get Started Screen'
              width={390}
              height={844}
              sizes='(max-width: 768px) 160px, 192px'
              className='w-40 md:w-48 lg:w-48 h-auto'
              priority
              fetchPriority='high'
            />
            <div
              className='absolute left-1/2 -translate-x-1/2'
              style={{
                bottom: '-18px',
                width: '85%',
                height: '16px',
                background:
                  'radial-gradient(ellipse, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 80%)',
                filter: 'blur(10px)',
              }}
            />
          </div>
        </div>

        {/* Right Phone - Login (Back Layer) */}
        <div
          className='relative transition-all duration-700 ease-out hover:scale-105'
          style={{
            transform:
              'perspective(1500px) rotateY(20deg) translateX(40px) translateZ(-100px) scale(0.85)',
            transformStyle: 'preserve-3d',
            zIndex: 10,
          }}
        >
          <div className='relative'>
            <Image
              src='/images/login.webp'
              alt='Login Screen'
              width={390}
              height={844}
              sizes='(max-width: 768px) 128px, (max-width: 1024px) 176px, 208px'
              className='w-32 md:w-44 lg:w-52 h-auto opacity-90'
              priority
            />
            <div
              className='absolute left-1/2 -translate-x-1/2'
              style={{
                bottom: '-15px',
                width: '80%',
                height: '12px',
                background:
                  'radial-gradient(ellipse, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 50%, transparent 80%)',
                filter: 'blur(8px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Foreground: Text content */}
      <div className='max-w-5xl w-full text-center font-sans'>
        <div className='space-y-5'>
          <h1
            id='hero-heading'
            className='text-white/90 drop-shadow-md pt-[15px] md:pt-0'
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 1.875rem)',
              lineHeight: 'calc(1em + 2px)',
              minHeight: '2.4375rem',
            }}
          >
            {(() => {
              const tagline = t('tagline');
              const lastPeriodIndex = tagline.lastIndexOf('.');
              const secondLastPeriodIndex = tagline.lastIndexOf('.', lastPeriodIndex - 1);

              if (secondLastPeriodIndex > 0) {
                const firstParts = tagline.substring(0, secondLastPeriodIndex + 1);
                const lastPart = tagline.substring(secondLastPeriodIndex + 1);
                return (
                  <>
                    {firstParts}
                    <span className='text-secondary'>{lastPart}</span>
                  </>
                );
              }

              return tagline;
            })()}
          </h1>

          {/* CTA Buttons */}
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-stretch w-full max-w-2xl mx-auto px-4 sm:px-0'>
            <AppDownloadButton
              className='w-full sm:w-auto sm:flex-1 px-6 py-3.5 border-[0.5px] border-white text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition-all duration-300 hover:bg-white hover:text-primary-500 transform hover:scale-105 outline-none text-center whitespace-nowrap'
              aria-label={t('cta.download')}
            >
              {t('cta.download')}
            </AppDownloadButton>
            <a
              href='#faq'
              className='w-full sm:w-auto sm:flex-1 px-6 py-3.5 border-[0.5px] border-white text-white rounded-full font-bold text-sm sm:text-base tracking-wide transition-all duration-300 hover:bg-white hover:text-primary-500 transform hover:scale-105 outline-none text-center whitespace-nowrap'
              aria-label={t('cta.business')}
            >
              {t('cta.business')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
