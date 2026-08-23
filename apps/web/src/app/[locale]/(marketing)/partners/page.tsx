import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';

interface PartnersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PartnersPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/partners',
    locale: locale as Locale,
    title: 'Partner With Us - Too Fresh To Waste',
    description:
      'Turn unsold inventory into revenue. Join the Too Fresh To Waste partner network and recover value from surplus food - same day, zero waste.',
  });
}

const impactStats = [
  {
    value: '40%',
    label: 'of all food produced globally is wasted every year',
    source: 'WWF Driven to Waste',
    href: 'https://wwf.panda.org/wwf_news/?5131564/',
  },
  {
    value: '172 kg',
    label: 'of food wasted per person per year in Tunisia',
    source: 'UNEP Food Waste Index 2024',
    href: 'https://www.unep.org/resources/publication/food-waste-index-report-2024',
  },
  {
    value: '10%',
    label: 'of all global greenhouse gas emissions come from wasted food',
    source: 'UNEP / WWF',
    href: 'https://www.unep.org/resources/report/unep-food-waste-index-report-2021',
  },
  {
    value: '49%',
    label: 'of consumers pay a premium for demonstrably sustainable brands',
    source: 'IBM IBV Consumer Study 2022',
    href: 'https://www.ibm.com/thought-leadership/institute-business-value/en-us/report/2022-consumer-study',
  },
];

const howItWorks = [
  {
    n: '01',
    title: 'List your surplus',
    body: 'Create a Surprise Bag in under 2 minutes - set a photo, a price, and a pickup window. We handle the rest.',
  },
  {
    n: '02',
    title: 'Customers reserve & pay',
    body: 'Shoppers on the TFTW app see your listing in real time and pay in-app. You get notified instantly.',
  },
  {
    n: '03',
    title: 'They pick up, you scan',
    body: 'Customers arrive during the pickup window. Scan their code, hand the bag over - done. Zero admin, zero chasing.',
  },
];

const benefits = [
  {
    icon: '💰',
    title: 'Revenue from waste',
    body: 'Recover real margin on inventory you would have binned. Even at 50% discount, that is 50% more than zero.',
  },
  {
    icon: '📣',
    title: 'Zero marketing effort',
    body: 'Your surplus is instantly visible to thousands of TFTW users searching for deals near them.',
  },
  {
    icon: '🤝',
    title: 'New loyal customers',
    body: 'Surprise Bag buyers become regulars. Many return at full price once they discover a brand they love.',
  },
  {
    icon: '🌿',
    title: 'ESG & CSR reporting',
    body: 'Every bag saved is tracked. Export carbon and waste diversion data for sustainability reports.',
  },
  {
    icon: '🗑️',
    title: 'Lower disposal costs',
    body: 'Less unsold stock going to waste means smaller bins, fewer collections, and lower disposal fees.',
  },
  {
    icon: '📰',
    title: 'Positive PR',
    body: 'Your brand is featured as a sustainability partner - in-app, on social, and in press coverage.',
  },
];

const whyNow = [
  {
    stat: '172 kg',
    label: 'per capita wasted in Tunisia per year - highest in the Maghreb (UNEP 2024)',
    source: 'UNEP Food Waste Index 2024',
    href: 'https://www.unep.org/resources/publication/food-waste-index-report-2024',
  },
  {
    stat: '$1 trillion',
    label: 'annual economic cost of food loss and waste globally',
    source: 'FAO Food Wastage Footprint 2014',
    href: 'https://www.fao.org/3/i3991e/i3991e.pdf',
  },
  {
    stat: '10–20%',
    label: 'of bakery daily output is discarded to keep shelves full until close',
    source: 'WRAP Hospitality & Food Service',
    href: 'https://wrap.org.uk/taking-action/food-drink/hospitality-food-service',
  },
  {
    stat: '80×',
    label: 'more potent than CO₂ - the warming power of methane from decomposing food in landfill',
    source: 'US EPA - Importance of Methane',
    href: 'https://www.epa.gov/gmi/importance-methane',
  },
];

const partners = [
  { name: 'Bonépi', category: 'Premium Patisserie & Bakery' },
  { name: 'BigBen', category: 'Fast Food & Café Chain' },
  { name: "L'Opéra", category: 'Established Restaurant' },
  { name: 'Kohn', category: 'Fine Dining & Bakery' },
];

export default async function PartnersPage({ params }: PartnersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='relative'>
          <div className='mx-auto w-full max-w-[1400px] px-8 py-14 md:py-20 grid gap-12 md:grid-cols-12 items-center'>
            <div className='md:col-span-7'>
              <p className='mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-brand-deep/60'>
                Partner Programme
              </p>
              <h1 className='font-heading text-5xl font-light leading-[0.95] text-balance md:text-7xl lg:text-8xl'>
                Turn surplus
                <span className='italic text-brand-coral'> into sales</span>.
              </h1>
              <p className='mt-8 max-w-xl text-lg leading-relaxed text-brand-deep/75'>
                Too Fresh To Waste connects your unsold daily inventory with thousands of conscious
                consumers - same day, same city. You keep real margin on what would otherwise be
                thrown away.
              </p>
              <div className='mt-10 flex flex-wrap gap-4'>
                <Link
                  href='/partner-kit'
                  className='rounded-full bg-brand-deep px-7 py-3.5 text-sm text-brand-cream hover:bg-brand-coral hover:text-brand-deep transition-all'
                >
                  Download Partner Kit
                </Link>
                <Link
                  href='/contact'
                  className='rounded-full border border-brand-deep/30 px-7 py-3.5 text-sm hover:border-brand-coral hover:text-brand-coral transition-colors'
                >
                  Talk to our team →
                </Link>
              </div>
            </div>

            <div className='md:col-span-5'>
              <div className='grid grid-cols-2 gap-3'>
                {impactStats.slice(0, 4).map((s, i) => (
                  <div
                    key={i}
                    className='bg-white/60 border border-brand-deep/10 rounded-sm p-5 hover:bg-brand-coral/10 transition-colors'
                  >
                    <p className='font-heading text-4xl font-light text-brand-deep leading-none'>
                      {s.value}
                    </p>
                    <p className='mt-3 text-xs leading-relaxed text-brand-deep/70'>{s.label}</p>
                    <a
                      href={s.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mt-2 block text-[10px] uppercase tracking-wider text-brand-coral hover:underline'
                    >
                      {s.source}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticker */}
          <div className='border-y border-brand-deep/15 bg-brand-deep py-2 text-brand-cream overflow-hidden'>
            <div className='flex w-max animate-marquee-fw gap-12 whitespace-nowrap'>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className='flex items-center gap-12 font-heading text-2xl italic'>
                  <span>40% of food produced is wasted</span>
                  <span className='text-brand-coral'>●</span>
                  <span>172 kg per person per year in Tunisia</span>
                  <span className='text-brand-coral'>●</span>
                  <span>Turn surplus into revenue - today</span>
                  <span className='text-brand-coral'>●</span>
                  <span>Join a growing partner network</span>
                  <span className='text-brand-coral'>●</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE PROBLEM ───────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-12 md:py-16'>
          <div className='grid gap-8 md:grid-cols-12 mb-10'>
            <div className='md:col-span-4'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>The Problem</p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                Every day, <em>good food disappears</em>.
              </h2>
            </div>
            <div className='md:col-span-7 md:col-start-6 space-y-5 text-brand-deep/75 leading-relaxed'>
              <p className='text-lg'>
                Bakeries, restaurants, hotels, and supermarkets across Tunisia discard between{' '}
                <strong className='text-brand-deep'>10 and 20%</strong> of their daily production
                every single evening. Not because the food is bad - because the shelf ran out of
                time.{' '}
                <a
                  href='https://wrap.org.uk/taking-action/food-drink/hospitality-food-service'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-brand-coral hover:underline text-sm'
                >
                  (WRAP)
                </a>
              </p>
              <p>
                The economic cost of global food waste is estimated at{' '}
                <a
                  href='https://www.fao.org/3/i3991e/i3991e.pdf'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-brand-coral hover:underline font-semibold'
                >
                  $1 trillion per year
                </a>{' '}
                (FAO, 2014) - a figure that excludes the environmental cost. When food decomposes in
                landfill, it releases methane, a gas{' '}
                <a
                  href='https://www.epa.gov/gmi/importance-methane'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-brand-coral hover:underline font-semibold'
                >
                  80 times more potent than CO₂
                </a>{' '}
                over a 20-year period (US EPA).
              </p>
              <p>
                Tunisia alone generates{' '}
                <a
                  href='https://www.unep.org/resources/publication/food-waste-index-report-2024'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-brand-coral hover:underline font-semibold'
                >
                  172 kg of food waste per person per year
                </a>{' '}
                (UNEP, 2024) - the highest in the Maghreb, second in the Arab world. The food sector
                accounts for a significant share of that figure, and the opportunity to recover it
                is entirely untapped.
              </p>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
        <section className='bg-brand-deep text-brand-cream py-12 md:py-16'>
          <div className='mx-auto w-full max-w-[1400px] px-8'>
            <div className='mb-10 grid gap-8 md:grid-cols-12'>
              <div className='md:col-span-5'>
                <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-3'>
                  The Solution
                </p>
                <h2 className='font-heading text-5xl font-light md:text-6xl'>
                  Three steps. <em className='text-brand-coral'>Zero waste.</em>
                </h2>
              </div>
              <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/70 self-end'>
                The Too Fresh To Waste platform lets food businesses list surplus inventory as
                discounted &ldquo;Surprise Bags&rdquo; - claimed by customers before closing time,
                every day.
              </p>
            </div>

            <div className='space-y-px'>
              {howItWorks.map(step => (
                <article
                  key={step.n}
                  className='grid gap-6 border-t border-brand-cream/15 py-5 md:grid-cols-12 group'
                >
                  <p className='md:col-span-2 font-heading text-5xl font-light text-brand-coral'>
                    {step.n}
                  </p>
                  <div className='md:col-span-9'>
                    <h3 className='font-heading text-3xl md:text-4xl'>{step.title}</h3>
                    <p className='mt-3 text-brand-cream/70 leading-relaxed max-w-2xl'>
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ──────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-12 md:py-16'>
          <div className='mb-10'>
            <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>Partner Benefits</p>
            <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
              What partners <em>actually get</em>.
            </h2>
          </div>
          <div className='grid gap-px bg-brand-deep/15 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-sm'>
            {benefits.map((b, i) => (
              <div
                key={i}
                className='bg-brand-cream p-8 hover:bg-brand-coral/10 transition-colors group'
              >
                <span className='text-3xl'>{b.icon}</span>
                <h3 className='mt-5 font-heading text-2xl'>{b.title}</h3>
                <div className='mt-4 h-px w-10 bg-brand-deep/30 group-hover:bg-brand-deep transition-colors' />
                <p className='mt-5 text-sm leading-relaxed text-brand-deep/70'>{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHY NOW ───────────────────────────────────────────────── */}
        <section className='bg-white/40 py-12 md:py-16'>
          <div className='mx-auto w-full max-w-[1400px] px-8'>
            <div className='mb-10 grid gap-8 md:grid-cols-12'>
              <div className='md:col-span-4'>
                <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>Why Now?</p>
                <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                  The window is opening.
                </h2>
              </div>
              <p className='md:col-span-7 md:col-start-6 text-lg leading-relaxed text-brand-deep/75 self-end'>
                Regulatory pressure, consumer expectations, and competitive dynamics are converging.
                Early partners gain the advantages that followers will have to buy.
              </p>
            </div>

            <div className='grid gap-px bg-brand-deep/15 sm:grid-cols-2 overflow-hidden rounded-sm'>
              {whyNow.map((w, i) => (
                <div
                  key={i}
                  className='bg-brand-cream p-8 hover:bg-brand-coral/10 transition-colors'
                >
                  <p className='font-heading text-5xl font-light text-brand-deep leading-none'>
                    {w.stat}
                  </p>
                  <div className='mt-5 h-px w-12 bg-brand-deep/30' />
                  <p className='mt-5 leading-relaxed text-brand-deep/75'>{w.label}</p>
                  <a
                    href={w.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-4 block text-[11px] uppercase tracking-wider text-brand-coral hover:underline'
                  >
                    {w.source}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY TFTW ──────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-12 md:py-16'>
          <div className='grid gap-10 md:grid-cols-12 items-start'>
            <div className='md:col-span-5'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>
                Why Too Fresh To Waste
              </p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                Built <em>here</em>, for here.
              </h2>
              <p className='mt-6 text-lg leading-relaxed text-brand-deep/75'>
                We are not adapting a European model to Tunisia. We built Too Fresh To Waste from
                scratch for the Tunisian food market - its rhythms, its languages, its logistics.
              </p>
              <div className='mt-8'>
                <Link
                  href='/partner-kit'
                  className='inline-block rounded-full bg-brand-coral text-brand-deep px-7 py-3.5 text-sm font-medium hover:bg-brand-deep hover:text-brand-cream transition-all'
                >
                  Download our Partner Kit →
                </Link>
              </div>
            </div>

            <div className='md:col-span-6 md:col-start-7 grid gap-4'>
              {[
                {
                  title: 'Live in under 48 hours',
                  body: 'Onboarding takes one call. Your first listing can go live the same week.',
                },
                {
                  title: 'Full-language support',
                  body: 'Platform, support, and communications in Arabic, French, and English.',
                },
                {
                  title: 'Real-time merchant dashboard',
                  body: 'Track bags sold, revenue recovered, CO₂ saved, and customer ratings.',
                },
                {
                  title: 'No exclusivity, no lock-in',
                  body: 'You remain free to use any other channel. We earn when you earn.',
                },
                {
                  title: 'Dedicated account support',
                  body: 'A real person, reachable. Not a ticket system.',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className='flex gap-5 border-b border-brand-deep/10 pb-4 last:border-0'
                >
                  <span className='mt-1 size-1.5 shrink-0 rounded-full bg-brand-coral' />
                  <div>
                    <p className='font-semibold text-sm'>{item.title}</p>
                    <p className='text-sm leading-relaxed text-brand-deep/65 mt-0.5'>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOUNDING PARTNERS ─────────────────────────────────────── */}
        <section className='bg-brand-deep text-brand-cream py-12 md:py-16'>
          <div className='mx-auto w-full max-w-[1400px] px-8'>
            <div className='mb-10 grid gap-6 md:grid-cols-12'>
              <div className='md:col-span-5'>
                <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-3'>
                  Founding Partners
                </p>
                <h2 className='font-heading text-5xl font-light md:text-6xl'>
                  They moved <em className='text-brand-coral'>first</em>.
                </h2>
              </div>
              <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/70 self-end'>
                These brands believed in the mission before we had scale. They helped us build the
                product, prove the model, and set the standard for what a TFTW partner looks like.
              </p>
            </div>

            <div className='grid gap-px bg-brand-cream/15 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-sm'>
              {partners.map((p, i) => (
                <div key={i} className='p-8 hover:bg-brand-cream/10 transition-colors'>
                  <div className='size-12 rounded-full bg-brand-coral/20 flex items-center justify-center mb-6'>
                    <span className='font-heading text-xl text-brand-coral'>
                      {p.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className='font-heading text-3xl'>{p.name}</h3>
                  <p className='mt-2 text-sm text-brand-cream/60'>{p.category}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-16 md:py-24 text-center'>
          <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-5'>
            Ready to join?
          </p>
          <h2 className='font-heading text-5xl font-light md:text-7xl text-balance max-w-3xl mx-auto'>
            Stop throwing away <em>margin</em>.
          </h2>
          <p className='mt-6 text-lg text-brand-deep/70 max-w-xl mx-auto leading-relaxed'>
            Every evening, unsold food sits on your shelves. Every morning, it is gone. We can
            change that - starting this week.
          </p>
          <div className='mt-10 flex flex-wrap justify-center gap-4'>
            <Link
              href='/partner-kit'
              className='rounded-full bg-brand-deep px-8 py-4 text-sm text-brand-cream hover:bg-brand-coral hover:text-brand-deep transition-all font-medium'
            >
              Download Partner Kit
            </Link>
            <Link
              href='/contact'
              className='rounded-full border border-brand-deep/30 px-8 py-4 text-sm hover:border-brand-coral hover:text-brand-coral transition-colors'
            >
              Talk to our team
            </Link>
          </div>
          <p className='mt-8 text-xs text-brand-deep/40'>
            Onboarding is free. You go live in under 48 hours.
          </p>
        </section>
      </div>
    </>
  );
}
