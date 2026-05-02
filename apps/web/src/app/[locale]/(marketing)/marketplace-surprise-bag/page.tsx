import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import RevenueCalculator from '@/components/sections/RevenueCalculator';
import { SoftwareAppSchema, FAQSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Marketplace Surprise Bag — Turn Surplus Food Into Revenue',
    description:
      'List your unsold food as a Surprise Bag. Earn revenue you would have thrown away and reach thousands of eco-conscious customers on Too Fresh To Waste.',
  };
}

const surpriseBagFaqs = [
  {
    question: 'What is a surprise bag?',
    answer:
      'A surprise bag is a discounted package of surplus food sold by local restaurants and shops at 35–90% off the original price. The contents are a surprise — you save money while preventing food waste.',
  },
  {
    question: 'How do I pick up my surprise bag?',
    answer:
      'After purchasing, you receive a pickup code valid until the offer expiry time. Present the code at the establishment during the pickup window to collect your bag.',
  },
  {
    question: 'What if the food does not meet my expectations?',
    answer:
      'Contact our support team. We review all complaints and take quality seriously. Merchants with consistent quality issues are removed from the platform.',
  },
  {
    question: 'How much can I save with a surprise bag?',
    answer:
      'Surprise bags are sold at 35–90% below the original price. A bag worth 20 TND in food may be available for as little as 5 TND.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Create Your Bag',
    body: "At the end of your service, pack whatever didn't sell — pastries, meals, produce — and list it as a Surprise Bag. Set your price. Takes under 3 minutes.",
    colorClass: 'bg-primary-500',
  },
  {
    n: '02',
    title: 'We Find Your Customer',
    body: 'Our app notifies thousands of nearby customers looking for great deals. They browse, they buy, they come to you. Zero marketing effort on your end.',
    colorClass: 'bg-brand-coral',
  },
  {
    n: '03',
    title: 'You Earn, We All Win',
    body: 'Revenue hits your dashboard instantly. Food waste drops to zero. And your business gets discovered by a growing community of loyal, eco-conscious buyers.',
    colorClass: 'bg-secondary-dark',
  },
];

const categories = [
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <path d='M5 8a7 7 0 0114 0v1a2 2 0 01-2 2H7a2 2 0 01-2-2V8z' />
        <path d='M7 11v8a1 1 0 001 1h8a1 1 0 001-1v-8' />
        <path d='M9 15h6M9 18h4' />
      </svg>
    ),
    type: 'Bakeries',
    items: 'Breads, croissants, pastries, tarts',
  },
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <path d='M3 3v6a3 3 0 006 0V3' />
        <path d='M6 9v12' />
        <path d='M18 3a4 4 0 014 4 4 4 0 01-4 4v10' />
      </svg>
    ),
    type: 'Restaurants',
    items: 'Main courses, soups, prepared salads',
  },
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <path d='M18 8h1a4 4 0 010 8h-1' />
        <path d='M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z' />
        <path d='M6 2v2M10 2v2M14 2v2' />
      </svg>
    ),
    type: 'Cafés',
    items: 'Sandwiches, wraps, hot drinks, sweet treats',
  },
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <circle cx='9' cy='21' r='1' />
        <circle cx='20' cy='21' r='1' />
        <path d='M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6' />
      </svg>
    ),
    type: 'Grocery Stores',
    items: 'Fruits, vegetables, dairy, deli items',
  },
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <path d='M3 22V8l9-6 9 6v14' />
        <path d='M9 22v-6h6v6' />
        <path d='M9 10h.01M12 10h.01M15 10h.01M9 14h.01M15 14h.01' />
      </svg>
    ),
    type: 'Hotels & Buffets',
    items: 'Buffet items, ready-made meals, desserts',
  },
  {
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-6 h-6'
      >
        <path d='M12 2L3 20h18L12 2z' />
        <path d='M12 2v18' />
        <circle cx='8' cy='13' r='1' fill='currentColor' stroke='none' />
        <circle cx='16' cy='15' r='1' fill='currentColor' stroke='none' />
      </svg>
    ),
    type: 'Fast Food',
    items: 'Pizza slices, sides, combo extras',
  },
];

const benefits = [
  {
    title: 'Turn Waste Into Revenue',
    body: "Every bag sold is money you'd have thrown away. Zero extra cost — pure recovered profit.",
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        className='w-6 h-6'
        stroke='currentColor'
        strokeWidth={1.8}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      </svg>
    ),
  },
  {
    title: 'Free Marketing Built-In',
    body: 'Your business gets listed, promoted, and seen by thousands of deal-hunters — no advertising spend required.',
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        className='w-6 h-6'
        stroke='currentColor'
        strokeWidth={1.8}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'
        />
      </svg>
    ),
  },
  {
    title: 'Build a Loyal Community',
    body: 'Eco-conscious customers come back, rate you, and bring friends. One bag today = one loyal customer for life.',
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        className='w-6 h-6'
        stroke='currentColor'
        strokeWidth={1.8}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
        />
      </svg>
    ),
  },
  {
    title: 'Real-Time Dashboard',
    body: 'Track bags sold, revenue earned, and CO₂ saved. Numbers that make you proud — and help you plan smarter.',
    icon: (
      <svg
        viewBox='0 0 24 24'
        fill='none'
        className='w-6 h-6'
        stroke='currentColor'
        strokeWidth={1.8}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
        />
      </svg>
    ),
  },
];

export default async function MarketplaceSurpriseBagPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SoftwareAppSchema
        name='Too Fresh To Waste — Surprise Bag Marketplace'
        description='Buy surplus food surprise bags from local restaurants and shops at up to 90% off. Available in Tunisia.'
        locale={locale as Locale}
      />
      <FAQSchema items={surpriseBagFaqs} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          {
            name: 'Surprise Bag',
            url: getCanonicalUrl('/marketplace-surprise-bag', locale as Locale),
          },
        ]}
      />
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          <div className='absolute inset-0 bg-grain opacity-30' aria-hidden='true' />

          {/* Decorative circles */}
          <div
            className='absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-10'
            style={{ background: 'radial-gradient(circle, #ff7973 0%, transparent 70%)' }}
            aria-hidden='true'
          />
          <div
            className='absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10'
            style={{ background: 'radial-gradient(circle, #FFA000 0%, transparent 70%)' }}
            aria-hidden='true'
          />

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-16 items-center'>
              {/* Left — copy */}
              <div>
                <p className='inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-6'>
                  <span className='h-px w-8 bg-brand-coral' aria-hidden='true' />
                  For Food Businesses
                </p>

                <h1 className='font-playfair text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-5'>
                  Make Profit From Your Surplus Food &amp; Grow As a Business With Our{' '}
                  <span className='text-brand-coral italic'>Marketing Strategies</span>
                </h1>

                <div className='mb-5'>
                  <span className='inline-block bg-brand-coral/20 border border-brand-coral/40 text-brand-coral text-xs font-black uppercase tracking-[0.3em] px-4 py-2 rounded-full'>
                    ✦ The Surprise Bag
                  </span>
                </div>

                <p className='text-white/70 text-base lg:text-lg leading-relaxed mb-8 max-w-lg'>
                  List your unsold food as a mystery Surprise Bag. Customers pay a discounted price,
                  you recover revenue you would have lost — and we handle all the marketing.
                </p>

                <div className='flex flex-wrap gap-4'>
                  <Link
                    href='/merchant-signup'
                    className='inline-flex items-center gap-2 bg-brand-coral text-white font-bold px-8 py-4 rounded-full hover:opacity-90 transition-opacity shadow-lg text-sm tracking-wide'
                  >
                    Start Making Revenue
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
                  <a
                    href='#how-it-works'
                    className='inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-8 py-4 rounded-full hover:border-white/60 transition-colors text-sm'
                  >
                    See how it works ↓
                  </a>
                </div>
              </div>

              {/* Right — Surprise Bag card mockup */}
              <div className='flex justify-center lg:justify-end'>
                <div className='relative w-full max-w-[340px]'>
                  {/* Main card */}
                  <div className='bg-white rounded-3xl shadow-2xl p-6 relative overflow-hidden'>
                    {/* Card header */}
                    <div className='bg-primary-500 rounded-2xl p-5 mb-5 text-center relative overflow-hidden'>
                      <div className='absolute inset-0 bg-grain opacity-20' aria-hidden='true' />
                      <p className='relative text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1'>
                        Too Fresh To Waste
                      </p>
                      <p className='relative font-playfair text-3xl font-bold text-white mb-1'>
                        Surprise Bag
                      </p>
                      <p className='relative text-white/55 text-sm'>🛍️ Mystery selection inside</p>
                    </div>

                    {/* Food icons */}
                    <div className='flex justify-center gap-3 mb-5' aria-hidden='true'>
                      {[
                        {
                          bg: 'bg-secondary-dark/10 text-secondary-dark',
                          svg: (
                            <svg
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='1.8'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-5 h-5'
                            >
                              <path d='M5 8a7 7 0 0114 0v1a2 2 0 01-2 2H7a2 2 0 01-2-2V8z' />
                              <path d='M7 11v8a1 1 0 001 1h8a1 1 0 001-1v-8' />
                            </svg>
                          ),
                        },
                        {
                          bg: 'bg-primary-300/20 text-primary-500',
                          svg: (
                            <svg
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='1.8'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-5 h-5'
                            >
                              <path d='M3 3v6a3 3 0 006 0V3' />
                              <path d='M6 9v12' />
                              <path d='M18 3a4 4 0 014 4 4 4 0 01-4 4v10' />
                            </svg>
                          ),
                        },
                        {
                          bg: 'bg-brand-coral/10 text-brand-coral',
                          svg: (
                            <svg
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='1.8'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-5 h-5'
                            >
                              <path d='M18 8h1a4 4 0 010 8h-1' />
                              <path d='M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z' />
                            </svg>
                          ),
                        },
                        {
                          bg: 'bg-secondary-dark/10 text-secondary-dark',
                          svg: (
                            <svg
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='1.8'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className='w-5 h-5'
                            >
                              <rect x='3' y='14' width='18' height='7' rx='1.5' />
                              <rect x='6' y='10' width='12' height='4' rx='1' />
                              <path d='M12 10V8' />
                              <circle cx='12' cy='7' r='1.5' fill='currentColor' stroke='none' />
                            </svg>
                          ),
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}
                        >
                          {item.svg}
                        </div>
                      ))}
                    </div>

                    {/* Price comparison */}
                    <div className='flex items-center justify-between bg-cream rounded-2xl p-4 mb-3'>
                      <div>
                        <p className='text-xs text-primary-500/50 mb-1'>Original value</p>
                        <p className='text-xl font-bold text-primary-500/30 line-through'>30 TND</p>
                      </div>
                      <div className='h-8 w-px bg-primary-500/10' aria-hidden='true' />
                      <div className='text-right'>
                        <p className='text-xs text-primary-500/50 mb-1'>Bag price</p>
                        <p className='text-2xl font-black text-brand-coral'>12 TND</p>
                      </div>
                    </div>

                    {/* Revenue highlight */}
                    <div className='bg-primary-500 rounded-2xl p-4 text-center'>
                      <p className='text-white/50 text-[10px] uppercase tracking-widest mb-1'>
                        You earn per bag
                      </p>
                      <p className='text-white text-3xl font-black font-playfair'>12 TND</p>
                      <p className='text-white/35 text-xs mt-1'>vs. 0 TND thrown away</p>
                    </div>
                  </div>

                  {/* Save badge */}
                  <div
                    className='absolute -top-4 -right-4 bg-secondary-dark text-white rounded-full w-16 h-16 flex flex-col items-center justify-center shadow-xl rotate-[12deg]'
                    aria-label='Save 67%'
                  >
                    <span className='text-[10px] font-bold leading-tight'>Save</span>
                    <span className='text-base font-black leading-tight'>67%</span>
                  </div>

                  {/* Floating label */}
                  <div
                    className='absolute -bottom-3 -left-3 bg-brand-coral text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-[-3deg]'
                    aria-hidden='true'
                  >
                    🔥 Selling now in Tunis
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MARQUEE TICKER ────────────────────────────────────────── */}
        <div className='bg-brand-coral py-3 overflow-hidden' aria-hidden='true'>
          <div className='flex w-max animate-marquee-fw gap-16 whitespace-nowrap'>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className='flex items-center gap-16 font-bold text-white text-xs uppercase tracking-[0.2em]'
              >
                <span>Zero Waste</span>
                <span className='text-white/40'>✦</span>
                <span>Extra Revenue</span>
                <span className='text-white/40'>✦</span>
                <span>Free Marketing</span>
                <span className='text-white/40'>✦</span>
                <span>More Customers</span>
                <span className='text-white/40'>✦</span>
                <span>Join For Free</span>
                <span className='text-white/40'>✦</span>
                <span>No Setup Fee</span>
                <span className='text-white/40'>✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── WHAT IS THE SURPRISE BAG ──────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-16 items-start'>
              {/* Left — explanation */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                  What is it?
                </p>
                <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-6'>
                  Your unsold food,{' '}
                  <span className='text-brand-coral italic'>someone else&apos;s treasure.</span>
                </h2>
                <p className='text-primary-500/70 text-base leading-relaxed mb-6'>
                  A Surprise Bag is a mystery box of unsold food from your establishment, sold at a
                  fraction of its original price. Customers love the thrill — and you love the
                  revenue you&apos;d otherwise bin at the end of the day.
                </p>

                <ul className='space-y-4 mb-8'>
                  {[
                    'You decide what goes inside — anything unsold and still delicious',
                    "You set the price — typically 40% or more of the food's original value",
                    'Customers come to you — no delivery, no logistics, pure simplicity',
                    'We handle visibility — your bag appears to thousands of nearby buyers',
                  ].map((item, i) => (
                    <li key={i} className='flex items-center gap-3 text-sm text-primary-500/80'>
                      <span className='w-5 h-5 rounded-full bg-brand-coral/15 text-brand-coral flex items-center justify-center shrink-0'>
                        <svg
                          className='w-3 h-3'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                          aria-hidden='true'
                        >
                          <path
                            fillRule='evenodd'
                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                            clipRule='evenodd'
                          />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href='/merchant-signup'
                  className='inline-flex items-center gap-2 bg-primary-500 text-white font-bold px-7 py-3.5 rounded-full hover:bg-primary-600 transition-colors text-sm'
                >
                  Create my first bag →
                </Link>
              </div>

              {/* Right — what can go inside grid */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-primary-500/40 mb-4'>
                  Works for every type of food business
                </p>
                <div className='grid grid-cols-2 gap-3'>
                  {categories.map((cat, i) => (
                    <div
                      key={i}
                      className='bg-white rounded-2xl p-4 border border-primary-500/8 hover:border-brand-coral/30 hover:shadow-md transition-all duration-300 group'
                    >
                      <div className='w-10 h-10 rounded-xl bg-primary-500/8 text-primary-500 flex items-center justify-center mb-3 group-hover:bg-brand-coral/10 group-hover:text-brand-coral transition-colors'>
                        {cat.icon}
                      </div>
                      <p className='font-bold text-sm text-primary-500 mb-1'>{cat.type}</p>
                      <p className='text-xs text-primary-500/55 leading-relaxed'>{cat.items}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
        <section id='how-it-works' className='bg-white py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-12'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Simple as 1-2-3
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500'>
                How it works
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-6'>
              {steps.map((step, i) => (
                <div
                  key={i}
                  className='group bg-cream rounded-3xl p-7 hover:shadow-md transition-all duration-300 border border-transparent hover:border-brand-coral/20'
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${step.colorClass} flex items-center justify-center mb-5 shadow-md`}
                  >
                    <span className='text-white font-black text-xl font-playfair'>{step.n}</span>
                  </div>
                  <h3 className='font-bold text-lg text-primary-500 mb-3'>{step.title}</h3>
                  <p className='text-sm text-primary-500/65 leading-relaxed'>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── REVENUE CALCULATOR ────────────────────────────────────── */}
        <section className='bg-primary-500 py-16 lg:py-20 bg-grain'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-10'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Your potential
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-white mb-4'>
                Calculate your revenue.
              </h2>
              <p className='text-white/50 text-base max-w-xl mx-auto leading-relaxed'>
                Move the sliders and see in real time how much your surplus food could earn you
                every month.
              </p>
            </div>

            <RevenueCalculator />
          </div>
        </section>

        {/* ── WHY JOIN ──────────────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-12'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Why businesses join
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500'>
                More than just <span className='text-brand-coral italic'>less waste</span>.
              </h2>
            </div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-5'>
              {benefits.map((b, i) => (
                <div
                  key={i}
                  className='bg-white rounded-3xl p-6 border border-primary-500/8 hover:border-brand-coral/25 hover:shadow-lg transition-all duration-300 group'
                >
                  <div className='w-12 h-12 rounded-2xl bg-primary-500/8 flex items-center justify-center mb-4 text-primary-500 group-hover:bg-brand-coral/10 group-hover:text-brand-coral transition-colors'>
                    {b.icon}
                  </div>
                  <h3 className='font-bold text-base text-primary-500 mb-2 leading-snug'>
                    {b.title}
                  </h3>
                  <p className='text-sm text-primary-500/60 leading-relaxed'>{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── URGENCY STRIP ─────────────────────────────────────────── */}
        <section className='bg-white py-10 border-y border-primary-500/8'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='flex flex-col md:flex-row items-center justify-between gap-6'>
              <div className='flex items-center gap-4'>
                <div
                  className='w-12 h-12 rounded-full bg-secondary-dark/15 flex items-center justify-center shrink-0 text-xl'
                  aria-hidden='true'
                >
                  ⚡
                </div>
                <div>
                  <p className='font-bold text-primary-500 text-base'>
                    First 100 businesses get featured placement — free.
                  </p>
                  <p className='text-sm text-primary-500/55'>
                    Early adopters set their own bag price and keep full visibility in the app
                    launch.
                  </p>
                </div>
              </div>
              <Link
                href='/merchant-signup'
                className='shrink-0 inline-flex items-center gap-2 bg-secondary-dark text-white font-bold px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity text-sm shadow-md'
              >
                Claim my spot →
              </Link>
            </div>
          </div>
        </section>

        {/* ── CLOSING CTA ───────────────────────────────────────────── */}
        <section className='bg-brand-coral relative overflow-hidden py-20 lg:py-28'>
          <div
            className='absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none'
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
            aria-hidden='true'
          />
          <div
            className='absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none'
            style={{
              background: 'radial-gradient(circle, rgba(30,68,72,0.25) 0%, transparent 70%)',
            }}
            aria-hidden='true'
          />

          <div className='relative mx-auto max-w-3xl px-6 text-center'>
            <p className='text-white/60 text-xs font-bold uppercase tracking-[0.3em] mb-4'>
              Limited early access
            </p>
            <h2 className='font-playfair text-4xl lg:text-6xl font-bold text-white leading-tight mb-6'>
              Ready to turn waste into revenue?
            </h2>
            <p className='text-white/80 text-base lg:text-lg leading-relaxed mb-8 max-w-xl mx-auto'>
              Join the businesses already using Too Fresh To Waste to recover lost revenue, grow
              their customer base, and do their part for the planet.
            </p>
            <Link
              href='/merchant-signup'
              className='inline-flex items-center gap-3 bg-white text-brand-coral font-black text-base px-10 py-5 rounded-full hover:bg-cream transition-colors shadow-xl'
            >
              Start Making Revenue
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2.5}
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
