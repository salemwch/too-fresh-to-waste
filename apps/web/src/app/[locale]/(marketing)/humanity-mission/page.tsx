import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { OrganizationSchema, DonateActionSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface HumanityMissionPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HumanityMissionPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'humanityMission' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

// SVG icons for the four pillars
const PillarIcons = [
  // Zero Hungry Nights — bowl of food
  <svg viewBox='0 0 64 64' fill='none' className='w-8 h-8' aria-hidden='true'>
    <path
      d='M8 36c0-13.255 10.745-24 24-24s24 10.745 24 24'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
    />
    <path
      d='M4 36h56M16 44c0 4.418 7.163 8 16 8s16-3.582 16-8'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
    />
    <circle cx='32' cy='28' r='4' fill='currentColor' opacity='0.4' />
  </svg>,
  // Dignity for the Elderly — heart with medical cross
  <svg viewBox='0 0 64 64' fill='none' className='w-8 h-8' aria-hidden='true'>
    <path
      d='M32 54S8 40 8 22a12 12 0 0 1 24 0 12 12 0 0 1 24 0c0 18-24 32-24 32z'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinejoin='round'
    />
    <path d='M32 20v8M28 24h8' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
  </svg>,
  // Empowering the Next Generation — open book
  <svg viewBox='0 0 64 64' fill='none' className='w-8 h-8' aria-hidden='true'>
    <path
      d='M32 16c-4-4-12-6-20-4v36c8-2 16 0 20 4 4-4 12-6 20-4V12c-8-2-16 0-20 4z'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinejoin='round'
    />
    <path d='M32 16v36' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
    <path
      d='M20 22h6M20 30h6M38 22h6M38 30h6'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      opacity='0.5'
    />
  </svg>,
  // Warmth & Care — folded shirt
  <svg viewBox='0 0 64 64' fill='none' className='w-8 h-8' aria-hidden='true'>
    <path
      d='M20 10L8 22l8 4 4-4v28h24V22l4 4 8-4L44 10c-2 4-6 6-12 6S22 14 20 10z'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinejoin='round'
    />
  </svg>,
];

export default async function HumanityMissionPage({ params }: HumanityMissionPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'humanityMission' });

  const pillars = t.raw('pillars.items') as Array<{ title: string; body: string }>;

  return (
    <>
      <OrganizationSchema locale={locale as Locale} />
      <DonateActionSchema />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Humanity Mission', url: getCanonicalUrl('/humanity-mission', locale as Locale) },
        ]}
      />
      <Header />

      <main className='min-h-screen bg-cream'>
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section
          className='relative overflow-hidden'
          style={{
            backgroundImage: "url('/images/hero-impact.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        >
          {/* Decorative floating hearts */}
          <span
            className='absolute top-16 left-[8%] text-primary-500 text-5xl animate-float select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>
          <span
            className='absolute top-24 right-[10%] text-primary-500 text-3xl animate-float-slow select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>
          <span
            className='absolute bottom-20 left-[20%] text-primary-500 text-2xl animate-float-slower select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>
          <span
            className='absolute bottom-16 right-[18%] text-primary-500 text-4xl animate-float select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>

          <div className='relative max-w-3xl mx-auto px-4 pt-36 pb-20 text-center'>
            {/* Eyebrow */}
            <p className='inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-primary-500 mb-4'>
              <svg viewBox='0 0 512 512' className='w-3 h-3 flex-shrink-0' aria-hidden='true'>
                <path
                  d='M365.4,59.628c60.56,0,109.6,49.03,109.6,109.47c0,109.47-109.6,171.8-219.06,281.271
                  C146.47,340.898,37,278.568,37,169.099c0-60.44,49.04-109.47,109.47-109.47
                  c54.73,0,82.1,27.37,109.47,82.1C283.3,86.999,310.67,59.628,365.4,59.628z'
                  fill='currentColor'
                />
              </svg>
              {t('hero.eyebrow')}
              <svg viewBox='0 0 512 512' className='w-3 h-3 flex-shrink-0' aria-hidden='true'>
                <path
                  d='M365.4,59.628c60.56,0,109.6,49.03,109.6,109.47c0,109.47-109.6,171.8-219.06,281.271
                  C146.47,340.898,37,278.568,37,169.099c0-60.44,49.04-109.47,109.47-109.47
                  c54.73,0,82.1,27.37,109.47,82.1C283.3,86.999,310.67,59.628,365.4,59.628z'
                  fill='currentColor'
                />
              </svg>
            </p>

            {/* Headline */}
            <h1 className='text-4xl md:text-6xl font-bold text-white leading-tight mb-5 font-playfair'>
              {t('hero.headline')}
            </h1>

            {/* Sub */}
            <p className='text-base md:text-lg text-white/75 max-w-xl mx-auto leading-relaxed'>
              {t('hero.sub')}
            </p>

            {/* Scroll indicator */}
            <div className='mt-10 flex justify-center'>
              <div
                className='w-px h-10 bg-gradient-to-b from-white/40 to-transparent'
                aria-hidden='true'
              />
            </div>
          </div>

          {/* Wave into cream — fill covers from wave DOWN so no gap band */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='#f9f3f0' />
            </svg>
          </div>
        </section>

        {/* ── 5% PLEDGE ────────────────────────────────────────── */}
        <section className='bg-cream px-4 pt-16 pb-20'>
          <div className='max-w-2xl mx-auto text-center'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-primary-500 mb-3'>
              {t('pledge.eyebrow')}
            </p>

            {/* The card */}
            <div className='bg-white rounded-3xl shadow-teal-form border border-brand-coral/10 p-8 md:p-10 relative overflow-hidden'>
              {/* Soft coral glow top-right */}
              <div
                className='absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none'
                style={{
                  background: 'radial-gradient(circle, rgba(255,121,115,0.12) 0%, transparent 70%)',
                }}
                aria-hidden='true'
              />

              {/* Big 5% */}
              <div className='relative'>
                <p
                  className='text-8xl md:text-9xl font-bold font-playfair leading-none mb-2'
                  style={{ color: '#ff7973' }}
                >
                  {t('pledge.percent')}
                </p>
                <h2 className='text-2xl md:text-3xl font-bold text-primary-500 mb-4 font-playfair'>
                  {t('pledge.headline')}
                </h2>
                <p className='text-sm md:text-base text-primary-500/70 leading-relaxed max-w-lg mx-auto'>
                  {t('pledge.body')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOUR PILLARS ─────────────────────────────────────── */}
        <section className='bg-white px-4 py-20'>
          <div className='max-w-5xl mx-auto'>
            {/* Section header */}
            <div className='text-center mb-12'>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-primary-500 mb-2'>
                {t('pillars.eyebrow')}
              </p>
              <h2 className='text-3xl md:text-4xl font-bold text-primary-500 font-playfair'>
                {t('pillars.headline')}
              </h2>
            </div>

            {/* Cards grid */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'>
              {pillars.map((pillar, i) => (
                <div
                  key={i}
                  className='group bg-cream rounded-2xl p-6 border border-brand-coral/10 hover:border-brand-coral/30 hover:shadow-md transition-all duration-300'
                >
                  {/* Icon circle */}
                  <div className='w-14 h-14 rounded-full bg-brand-coral/10 flex items-center justify-center mb-4 text-primary-500 group-hover:bg-brand-coral/20 transition-colors duration-300'>
                    {PillarIcons[i]}
                  </div>

                  <h3 className='text-base font-bold text-primary-500 mb-2 leading-snug'>
                    {pillar.title}
                  </h3>
                  <p className='text-sm text-primary-500/65 leading-relaxed'>{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── B2B PARTNER SHOUTOUT ─────────────────────────────── */}
        <section className='bg-primary-500 px-4 py-20 relative overflow-hidden'>
          {/* Decorative hearts */}
          <span
            className='absolute top-10 right-[6%] text-primary-500 opacity-15 text-6xl animate-float-slow select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>
          <span
            className='absolute bottom-10 left-[4%] text-primary-500 opacity-10 text-4xl animate-float select-none pointer-events-none'
            aria-hidden='true'
          >
            ♥
          </span>

          {/* Wave from white pillars section — fill covers from TOP down to wave */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' fill='white' />
            </svg>
          </div>

          <div className='relative max-w-3xl mx-auto text-center pt-16'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-primary-300 mb-3'>
              {t('partner.eyebrow')}
            </p>
            <h2 className='text-3xl md:text-4xl font-bold text-white font-playfair mb-5'>
              {t('partner.headline')}
            </h2>
            <p className='text-sm md:text-base text-white/70 leading-relaxed mb-8 max-w-xl mx-auto'>
              {t('partner.body')}
            </p>

            <Link
              href='/companies'
              className='inline-flex items-center gap-2 bg-brand-coral text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-md'
            >
              {t('partner.cta')}
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M17 8l4 4m0 0l-4 4m4-4H3'
                />
              </svg>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
