import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';
import { SoftwareAppSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/consumer',
    locale: locale as Locale,
    title: 'Save Food, Save Money, Win Prizes - Too Fresh To Waste',
    description:
      'Rescue unsold food from local restaurants and bakeries at up to 70% off. Earn points, help the planet, and compete for smartphones in the community Drop.',
  });
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z' />
      <path d='M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z' />
      <circle cx='17' cy='13' r='1.5' fill='currentColor' stroke='none' />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20' />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M6 9H4a2 2 0 01-2-2V5h4' />
      <path d='M18 9h2a2 2 0 002-2V5h-4' />
      <path d='M8 21h8M12 17v4' />
      <path d='M6 5h12v7a6 6 0 01-12 0V5z' />
    </svg>
  );
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M12 2.69l5.66 5.66a8 8 0 11-11.31 0z' />
    </svg>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M11 20A7 7 0 014 13c0-5 4-9 8-11 4 2 8 6 8 11a7 7 0 01-7 7c-1 0-1.4-.1-2-.3' />
      <path d='M12 9c0 5-4 9-8 11' />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='18' cy='5' r='3' />
      <circle cx='6' cy='12' r='3' />
      <circle cx='18' cy='19' r='3' />
      <path d='M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='currentColor' className={className} aria-hidden='true'>
      <path
        fillRule='evenodd'
        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
        clipRule='evenodd'
      />
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const quickWins = [
  {
    Icon: WalletIcon,
    iconBg: 'bg-brand-coral/15',
    iconColor: 'text-brand-coral',
    stat: 'Up to 70% off',
    label: 'Real food, real savings',
    body: 'Restaurant and bakery food worth 2–3× more than what you pay. Every day, all across Tunisia.',
  },
  {
    Icon: GlobeIcon,
    iconBg: 'bg-primary-500/10',
    iconColor: 'text-primary-500',
    stat: 'Every bag = less waste',
    label: 'Help Tunisia eat smarter',
    body: 'Each bag you rescue keeps food out of the bin and cuts real CO₂ emissions from landfills.',
  },
  {
    Icon: TrophyIcon,
    iconBg: 'bg-secondary-dark/15',
    iconColor: 'text-secondary-dark',
    stat: 'Earn points, win prizes',
    label: 'The more you save, the more you gain',
    body: 'Every bag earns you points. Hit the community goal together and the Drop unlocks - phones for the top 3, a discount for everyone else.',
  },
];

const howItWorksSteps = [
  {
    n: '01',
    icon: '/icons/browsing.png',
    iconAlt: 'Browse nearby bags',
    title: 'Browse surprise bags near you',
    body: "Open the app, find restaurants and bakeries listing today's unsold food - fresh, real, discounted. Filter by distance, type, or pickup time.",
    colorClass: 'bg-primary-500',
  },
  {
    n: '02',
    icon: '/icons/booking.png',
    iconAlt: 'Reserve your bag',
    title: 'Reserve yours in seconds',
    body: 'Tap to claim your bag. Pay securely in-app. Get your pickup window. Your slot is locked - no one else can grab it.',
    colorClass: 'bg-brand-coral',
  },
  {
    n: '03',
    icon: '/icons/order.png',
    iconAlt: 'Pick up your bag',
    title: 'Pick up & enjoy',
    body: 'Head to the spot, show your code, grab your bag. Zero waste. Full stomach. Points automatically added to your account.',
    colorClass: 'bg-secondary-dark',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ConsumerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SoftwareAppSchema
        name='Too Fresh To Waste'
        description='Save up to 90% on surplus food from local restaurants and shops. Fight food waste and save money every day.'
        locale={locale as Locale}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'For Consumers', url: getCanonicalUrl('/consumer', locale as Locale) },
        ]}
      />
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          {/* Decorative radial glows */}

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-12 pb-0 lg:pt-16'>
            <div className='grid lg:grid-cols-2 gap-10 lg:gap-16 items-center'>
              {/* Left - copy */}
              <div className='pb-10 lg:pb-16'>
                {/* Eyebrow */}
                <h1 className='font-heading text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-5'>
                  Great Food. <span className='text-brand-coral italic'>Lower Price.</span> Better
                  World.
                </h1>

                <p className='text-white/70 text-base lg:text-lg leading-relaxed mb-8 max-w-lg'>
                  Every day, restaurants and bakeries in Tunisia have delicious unsold food. You
                  grab it for 50% off and more - and together we stop it from going to waste.
                </p>

                {/* Download CTAs */}
                <div className='flex flex-col sm:flex-row gap-3 mb-5'>
                  {/* App Store */}
                  <AppDownloadButton
                    className='inline-flex items-center gap-3 bg-white text-primary-500 font-bold px-6 py-3.5 rounded-full hover:bg-cream transition-colors shadow-lg text-sm'
                    aria-label='Download on App Store'
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='w-5 h-5 shrink-0'
                      fill='currentColor'
                      aria-hidden='true'
                    >
                      <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
                    </svg>
                    Download on App Store
                  </AppDownloadButton>

                  {/* Google Play */}
                  <AppDownloadButton
                    className='inline-flex items-center gap-3 border border-white/40 text-white font-bold px-6 py-3.5 rounded-full hover:border-white/70 hover:bg-white/5 transition-colors text-sm'
                    aria-label='Get it on Google Play'
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='w-5 h-5 shrink-0'
                      fill='currentColor'
                      aria-hidden='true'
                    >
                      <path d='M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11.109 11.04c.28.106.591.108.87-.004l13.052-7.176-2.813-3.86z' />
                    </svg>
                    Get it on Google Play
                  </AppDownloadButton>
                </div>
              </div>

              {/* Right - PickUpToday illustration */}
              <div className='flex justify-center lg:justify-end items-end relative'>
                <Image
                  src='/images/PickUpToday.svg'
                  alt='Pick up today - fresh food bags available near you'
                  width={520}
                  height={480}
                  className='w-full max-w-[260px] lg:max-w-[360px] h-auto object-contain drop-shadow-2xl'
                  priority
                />
              </div>
            </div>
          </div>

          {/* Wave into cream */}
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

        {/* ── MARQUEE TICKER ───────────────────────────────────────────────── */}
        <div className='bg-brand-coral py-3 overflow-hidden' aria-hidden='true'>
          <div className='flex w-max animate-marquee-fw gap-16 whitespace-nowrap'>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className='flex items-center gap-16 font-bold text-white text-xs uppercase tracking-[0.2em]'
              >
                <span>Up to 70% Off</span>
                <span className='text-white/40'>✦</span>
                <span>Earn Points</span>
                <span className='text-white/40'>✦</span>
                <span>Win a Smartphone</span>
                <span className='text-white/40'>✦</span>
                <span>Help the Planet</span>
                <span className='text-white/40'>✦</span>
                <span>Smart Watches</span>
                <span className='text-white/40'>✦</span>
                <span>Available in Tunisia</span>
                <span className='text-white/40'>✦</span>
                <span>Help Family</span>
                <span className='text-white/40'>✦</span>
                <span>Grand Prize</span>
                <span className='text-white/40'>✦</span>
                <span>Giveaway</span>
                <span className='text-white/40'>✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── QUICK WINS ───────────────────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-10'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-2'>
                Why consumers love it
              </p>
              <h2 className='font-heading text-3xl lg:text-4xl font-bold text-primary-500'>
                Three reasons to open the app right now.
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-5'>
              {quickWins.map((w, i) => (
                <div
                  key={i}
                  className='bg-white rounded-3xl p-7 border border-primary-500/10 hover:border-brand-coral/25 hover:shadow-lg transition-all duration-300 group'
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${w.iconBg} flex items-center justify-center mb-5 ${w.iconColor} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <w.Icon className='w-7 h-7' />
                  </div>
                  <p className='text-xl font-black text-primary-500 mb-1 leading-tight'>{w.stat}</p>
                  <p className='text-xs font-bold uppercase tracking-widest text-brand-coral mb-3'>
                    {w.label}
                  </p>
                  <p className='text-sm text-primary-500/60 leading-relaxed'>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className='bg-white py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-12'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Simple as 1-2-3
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                From browse to bite <span className='text-brand-coral italic'>in minutes.</span>
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-6'>
              {howItWorksSteps.map((step, i) => (
                <div
                  key={i}
                  className='group bg-cream rounded-3xl p-7 hover:shadow-md transition-all duration-300 border border-transparent hover:border-brand-coral/20 relative overflow-hidden'
                >
                  {/* Step number badge */}
                  <div
                    className={`w-14 h-14 rounded-2xl ${step.colorClass} flex items-center justify-center mb-5 shadow-md`}
                  >
                    <span className='text-white font-black text-xl font-heading'>{step.n}</span>
                  </div>

                  {/* Icon */}
                  <div className='w-12 h-12 mb-4'>
                    <Image
                      src={step.icon}
                      alt={step.iconAlt}
                      width={48}
                      height={48}
                      className='w-full h-full object-contain'
                    />
                  </div>

                  <h3 className='font-bold text-lg text-primary-500 mb-3 leading-snug'>
                    {step.title}
                  </h3>
                  <p className='text-sm text-primary-500/65 leading-relaxed'>{step.body}</p>

                  {/* Connector line on desktop */}
                  {i < howItWorksSteps.length - 1 && (
                    <div
                      className='hidden md:block absolute top-10 -right-3 w-6 h-px bg-primary-500/15 z-10'
                      aria-hidden='true'
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WALLET STORY ─────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-16 lg:py-24 relative overflow-hidden'>
          {/* Top wave from white */}
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
          {/* Bottom wave to cream */}
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

          {/* Glow */}

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-10'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-16 items-center'>
              {/* Left - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-4'>
                  Save More
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-white leading-tight mb-5'>
                  Why pay full price for unsold food that&apos;s still delicious?
                </h2>
                <p className='text-white/65 text-base lg:text-lg leading-relaxed mb-7'>
                  Surprise Bags are packed with the day&apos;s best unsold food - worth 2–3× more
                  than what you pay. Bakeries, restaurants, cafés. All near you. All today.
                </p>

                <ul className='space-y-3 mb-8'>
                  {[
                    'Fresh food, every day - baked goods, hot meals, produce',
                    'Bags typically worth 2–3× the price you pay',
                    'Pickup takes under 5 minutes - no waiting, no waste',
                    'New bags listed daily from places in your neighbourhood',
                  ].map((item, i) => (
                    <li key={i} className='flex items-center gap-3 text-sm text-white/75'>
                      <span className='w-5 h-5 rounded-full bg-brand-coral/25 text-brand-coral flex items-center justify-center shrink-0'>
                        <CheckIcon className='w-3 h-3' />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <AppDownloadButton
                  className='inline-flex items-center gap-2 bg-brand-coral text-white font-bold px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-lg text-sm'
                  aria-label='Download the app'
                >
                  Get the app - it&apos;s free
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
                </AppDownloadButton>
              </div>

              {/* Right - price comparison card */}
              <div className='flex justify-center lg:justify-end'>
                <div className='relative w-full max-w-[320px]'>
                  {/* Main card */}
                  <div className='bg-white rounded-3xl shadow-2xl p-6 relative overflow-hidden'>
                    {/* Header */}
                    <div className='bg-primary-500 rounded-2xl p-5 mb-5 text-center relative overflow-hidden bg-grain'>
                      <p className='relative text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1'>
                        Too Fresh To Waste
                      </p>
                      <p className='relative font-heading text-2xl font-bold text-white mb-1'>
                        Surprise Bag
                      </p>
                      <p className='relative text-white/55 text-sm'>Mystery selection inside</p>
                    </div>

                    {/* Price comparison */}
                    <div className='flex items-center justify-between bg-cream rounded-2xl p-4 mb-3'>
                      <div>
                        <p className='text-xs text-primary-500/50 mb-1'>Original value</p>
                        <p className='text-xl font-bold text-primary-500/30 line-through'>30 TND</p>
                      </div>
                      <div className='h-8 w-px bg-primary-500/10' aria-hidden='true' />
                      <div className='text-right'>
                        <p className='text-xs text-primary-500/50 mb-1'>You pay</p>
                        <p className='text-2xl font-black text-brand-coral'>10 TND</p>
                      </div>
                    </div>

                    {/* You save highlight */}
                    <div className='bg-secondary-dark/10 border border-secondary-dark/20 rounded-2xl p-4 text-center'>
                      <p className='text-secondary-dark text-[10px] uppercase tracking-widest font-bold mb-1'>
                        You save
                      </p>
                      <p className='text-secondary-dark text-3xl font-black font-heading'>20 TND</p>
                      <p className='text-secondary-dark/60 text-xs mt-1'>on every bag</p>
                    </div>
                  </div>

                  {/* Save badge */}
                  <div
                    className='absolute -top-4 -right-4 bg-brand-coral text-white rounded-full w-16 h-16 flex flex-col items-center justify-center shadow-xl rotate-[12deg]'
                    aria-label='Save 67%'
                  >
                    <span className='text-[10px] font-bold leading-tight'>Save</span>
                    <span className='text-base font-black leading-tight'>67%</span>
                  </div>

                  {/* Bottom label */}
                  <p className='text-center text-white/35 text-xs mt-4'>
                    Actual bag prices vary by establishment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PLANET STORY ─────────────────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24 relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-16 items-center'>
              {/* Left - impact numbers */}
              <div className='space-y-6'>
                {/* Big stat */}
                <div className='bg-white rounded-3xl p-8 border border-primary-500/10 shadow-teal-sm'>
                  <p className='text-xs font-bold uppercase tracking-widest text-primary-500/50 mb-2'>
                    Global food waste
                  </p>
                  <p className='font-heading text-7xl font-bold text-primary-500 leading-none mb-2'>
                    1/3
                  </p>
                  <p className='text-primary-500/60 text-base leading-relaxed'>
                    of all food produced globally is wasted every year. That&apos;s 1.3 billion
                    tonnes.
                  </p>
                </div>

                {/* Two mini stats */}
                <div className='grid grid-cols-2 gap-4'>
                  <div className='bg-white rounded-2xl p-5 border border-primary-500/10'>
                    <div className='w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center mb-3'>
                      <LeafIcon className='w-5 h-5' />
                    </div>
                    <p className='font-black text-primary-500 text-base leading-tight mb-1'>
                      ~2.5 kg CO₂
                    </p>
                    <p className='text-xs text-primary-500/55 leading-relaxed'>
                      avoided per bag rescued
                    </p>
                  </div>
                  <div className='bg-white rounded-2xl p-5 border border-primary-500/10'>
                    <div className='w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center mb-3'>
                      <DropletIcon className='w-5 h-5' />
                    </div>
                    <p className='font-black text-primary-500 text-base leading-tight mb-1'>
                      1,000 L
                    </p>
                    <p className='text-xs text-primary-500/55 leading-relaxed'>
                      of water saved per bag
                    </p>
                  </div>
                </div>
              </div>

              {/* Right - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-4'>
                  Your Impact
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-5'>
                  Your lunch break can{' '}
                  <span className='text-brand-coral italic'>change something real.</span>
                </h2>
                <p className='text-primary-500/65 text-base lg:text-lg leading-relaxed mb-6'>
                  When you rescue a bag, you&apos;re not just eating well. You&apos;re cutting
                  methane emissions, saving water, and sending a message that food deserves better
                  than the bin.
                </p>
                <p className='text-primary-500/65 text-base leading-relaxed mb-8'>
                  Every bag you save in Tunisia is one small act with a very real ripple. And when
                  thousands of us do it together - it becomes something much bigger.
                </p>

                <Link
                  href='/food-waste-facts'
                  className='inline-flex items-center gap-2 text-primary-500 font-bold text-sm hover:text-brand-coral transition-colors'
                >
                  Read the facts
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
            </div>
          </div>

          {/* Wave into white */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='white' />
            </svg>
          </div>
        </section>

        {/* ── REFERRAL ─────────────────────────────────────────────────────── */}
        <section className='bg-white py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-16 items-center'>
              {/* Left - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-4'>
                  Referral Program
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-5'>
                  Share the link. <span className='text-brand-coral italic'>Both win.</span>
                </h2>
                <p className='text-primary-500/65 text-base lg:text-lg leading-relaxed mb-6'>
                  Invite a friend with your personal referral link. When they save their first bag,
                  you both earn bonus points - pushing you closer to the top of the Drop.
                </p>

                <div className='space-y-1.5 mb-8'>
                  {[
                    { Icon: ShareIcon, text: 'Share your unique link with anyone' },
                    {
                      Icon: TrophyIcon,
                      text: 'They rescue their first bag - you both earn bonus points',
                    },
                    {
                      Icon: WalletIcon,
                      text: 'More points = higher rank = bigger prizes in the Drop',
                    },
                  ].map((item, i) => (
                    <div key={i} className='flex items-center gap-2.5'>
                      <div className='w-7 h-7 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0'>
                        <item.Icon className='w-4 h-4' />
                      </div>
                      <p className='text-sm text-primary-500/75'>{item.text}</p>
                    </div>
                  ))}
                </div>

                <AppDownloadButton
                  className='inline-flex items-center gap-2 bg-primary-500 text-white font-bold px-7 py-3.5 rounded-full hover:bg-primary-600 transition-colors text-sm'
                  aria-label='Download the app and start collecting points'
                >
                  Download &amp; start collecting →
                </AppDownloadButton>
              </div>

              {/* Right - referral card mockup */}
              <div className='flex justify-center lg:justify-end'>
                <div className='w-full max-w-[320px]'>
                  {/* Card */}
                  <div className='bg-cream rounded-3xl p-6 border-2 border-dashed border-primary-500/20 relative overflow-hidden'>
                    {/* Glow top-right */}

                    {/* Share row */}
                    <div className='flex items-center gap-3 mb-5'>
                      <div className='flex items-center gap-2 flex-1'>
                        <Image
                          src='/icons/earn-points.png'
                          alt=''
                          width={32}
                          height={32}
                          className='w-8 h-8 object-contain'
                          aria-hidden='true'
                        />
                        <div>
                          <p className='text-xs font-bold text-primary-500'>+50 pts for you</p>
                          <p className='text-[10px] text-primary-500/50'>
                            per friend who saves their first bag
                          </p>
                        </div>
                      </div>
                      <Image
                        src='/icons/share.png'
                        alt=''
                        width={32}
                        height={32}
                        className='w-8 h-8 object-contain opacity-60'
                        aria-hidden='true'
                      />
                    </div>

                    {/* Bottom note */}
                    <div className='pt-4 border-t border-primary-500/10'>
                      <p className='text-[10px] text-primary-500/40 text-center'>
                        Your link is available in your profile inside the app
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden py-20 lg:py-28'>
          {/* Top wave from white */}
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

          {/* Decorative glows */}

          <div className='relative mx-auto max-w-3xl px-6 text-center pt-10'>
            <p className='text-white/60 text-xs font-bold uppercase tracking-[0.3em] mb-4'>
              Your next great meal is waiting
            </p>
            <h2 className='font-heading text-4xl lg:text-6xl font-bold text-white leading-tight mb-5'>
              Eat well. Spend less. <span className='text-secondary'>Win something.</span>
            </h2>
            <p className='text-white/75 text-base lg:text-lg leading-relaxed mb-10 max-w-xl mx-auto'>
              Download Too Fresh To Waste. Find surprise bags near you. Earn points with every
              rescue. Climb the leaderboard - and when the community hits 30,000 bags, the Drop
              begins.
            </p>

            {/* Download buttons */}
            <div className='flex flex-col sm:flex-row gap-4 justify-center mb-6'>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-3 bg-white text-brand-coral font-black text-sm px-8 py-4 rounded-full hover:bg-cream transition-colors shadow-xl'
                aria-label='Download on App Store'
              >
                <svg
                  viewBox='0 0 24 24'
                  className='w-5 h-5 shrink-0'
                  fill='currentColor'
                  aria-hidden='true'
                >
                  <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
                </svg>
                Download on App Store
              </AppDownloadButton>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-3 border-2 border-white text-white font-black text-sm px-8 py-4 rounded-full hover:bg-white/10 transition-colors'
                aria-label='Get it on Google Play'
              >
                <svg
                  viewBox='0 0 24 24'
                  className='w-5 h-5 shrink-0'
                  fill='currentColor'
                  aria-hidden='true'
                >
                  <path d='M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11.109 11.04c.28.106.591.108.87-.004l13.052-7.176-2.813-3.86z' />
                </svg>
                Get it on Google Play
              </AppDownloadButton>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
