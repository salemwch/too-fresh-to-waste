import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'How to Collect a Surprise Bag — Too Fresh To Waste',
    description:
      'Step-by-step guide to browsing, reserving, picking up, and earning points with a Too Fresh To Waste Surprise Bag.',
    alternates: { canonical: '/how-to-collect' },
  };
}

const STEPS = [
  {
    n: '01',
    title: 'Browse available offers near you',
    body: "Open the app and you'll see all Surprise Bags available around you. Each card shows the business name, food type, price, and pickup window. Scroll, filter by distance or category, and tap the one you want.",
    bullets: [
      'See offers sorted by distance from your location',
      'Each card shows the price, original value, and pickup window',
      'Filter by food type — bakery, restaurant, café, or fast food',
      'Listings refresh daily — new bags appear as businesses confirm their surplus',
    ],
    tip: 'Popular bakery listings sell out fast — check early afternoon for the best selection.',
    image: '/images/buy-screen-onoarding/home-screen.png',
    alt: 'Browse offers screen',
  },
  {
    n: '02',
    title: 'View the offer details',
    body: "Tapping a listing opens the full details screen. You'll see the food description, what's typically inside, the exact pickup window, and the address. When you're ready, tap the Reserve button.",
    bullets: [
      'Read the bag description — the business tells you what type of food to expect',
      'Check the pickup window so you can plan your route',
      'See the original retail value vs. what you pay',
      "Tap Reserve when you're ready — it only takes a few seconds",
    ],
    tip: null,
    image: '/images/buy-screen-onoarding/offer-details.png',
    alt: 'Offer details screen',
  },
  {
    n: '03',
    title: 'Choose your quantity',
    body: 'A reservation sheet slides up asking how many bags you want. Select your quantity and confirm. Payment is handled securely in-app — no cash needed at the counter.',
    bullets: [
      'Choose 1 or more bags depending on availability',
      'See the total price update in real time as you select',
      'Your slot is locked the moment you confirm — no one else can take it',
    ],
    tip: null,
    image: '/images/buy-screen-onoarding/reserve.png',
    alt: 'Reserve quantity screen',
  },
  {
    n: '04',
    title: 'Confirm your order at checkout',
    body: 'At checkout you can select Pickup (always available) or delivery where offered. Review your order and tap Confirm Order to lock in your reservation.',
    bullets: [
      'Choose Pickup to collect in person — always available',
      'Delivery is available at select partners',
      'Review the business address and pickup window one more time',
      'Tap Confirm Order — your reservation is immediately locked in',
    ],
    tip: null,
    image: '/images/buy-screen-onoarding/checkout.png',
    alt: 'Checkout screen',
  },
  {
    n: '05',
    title: 'Your order is confirmed',
    body: "Your order summary shows what you ordered, the business name, and your exact pickup window. You'll also see a code field — this is where you enter the pickup code you receive at the business when you arrive.",
    bullets: [
      'See the business name, address, and pickup time clearly at the top',
      "The code field is ready — you'll fill it in when you arrive",
      "You'll receive a confirmation notification on your phone",
      "Save the screen or keep the app open — you'll need it at pickup",
    ],
    tip: null,
    image: '/images/buy-screen-onoarding/order-summary.png',
    alt: 'Order summary screen',
  },
  {
    n: '06',
    title: 'Enter the pickup code',
    body: 'When you arrive, the staff gives you a code. Enter it into the code field in your order summary and tap Confirm Pickup. This verifies the handover on both sides and completes your order.',
    bullets: [
      'Show up during your pickup window — the business is expecting you',
      'The staff will give you a short code when you present your order',
      'Type the code into the field and tap Confirm Pickup',
      'Both you and the business receive a confirmation that the handover is complete',
    ],
    tip: null,
    image: '/images/buy-screen-onoarding/code-order-summary.png',
    alt: 'Pickup code confirmation screen',
  },
  {
    n: '07',
    title: 'Collect your points and climb the leaderboard',
    body: 'Points land in your account automatically once pickup is confirmed. Every bag you rescue earns you points — and every user on the list wins something.',
    bullets: [
      'Points are added instantly after each confirmed pickup',
      'Check your rank on the community leaderboard anytime',
      'Top 5 users win a smartphone — next 5 win a smartwatch',
      'Every other user on the list receives a 10–15% discount voucher',
    ],
    tip: 'The more bags you rescue, the higher you climb. Every pickup counts.',
    image: '/images/buy-screen-onoarding/MY-Points.png',
    alt: 'My Points screen',
  },
];

export default async function HowToCollectPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 pt-20 pb-16'>
          <div className='mx-auto max-w-4xl px-6 text-center'>
            <div className='inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/70 text-[10px] font-bold uppercase tracking-[0.25em] px-4 py-2 rounded-full mb-6'>
              Step-by-step guide
            </div>
            <h1 className='font-playfair text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-5'>
              How to Collect a <span className='text-brand-coral italic'>Surprise Bag</span>
            </h1>
            <p className='text-white/65 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              From browsing to pickup to earning points — the full flow explained with real app
              screens. The whole process takes under two minutes.
            </p>
          </div>
        </section>

        {/* Wave */}
        <div className='bg-primary-500' aria-hidden='true'>
          <svg viewBox='0 0 1440 48' className='block w-full' preserveAspectRatio='none'>
            <path d='M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z' fill='white' />
          </svg>
        </div>

        {/* ── STEPS ────────────────────────────────────────────────────── */}
        <section className='py-16 lg:py-24'>
          <div className='mx-auto max-w-6xl px-6 lg:px-8'>
            <div className='space-y-16 lg:space-y-20'>
              {STEPS.map((step, i) => (
                <div key={step.n} className='grid lg:grid-cols-2 gap-10 lg:gap-16 items-start'>
                  {/* LEFT — text */}
                  <div className='order-2 lg:order-1'>
                    <div className='flex items-center gap-3 mb-5'>
                      <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white font-black text-sm font-playfair shrink-0'>
                        {step.n}
                      </span>
                      <div className='h-px flex-1 bg-primary-500/10' />
                    </div>

                    <h2 className='font-playfair text-2xl lg:text-3xl font-bold text-primary-500 leading-snug mb-4'>
                      {step.title}
                    </h2>

                    <p className='text-primary-500/70 text-base leading-relaxed mb-5'>
                      {step.body}
                    </p>

                    <ul className='space-y-2.5 mb-5'>
                      {step.bullets.map((bullet, bi) => (
                        <li key={bi} className='flex items-start gap-3 text-sm text-primary-500/70'>
                          <span className='mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-coral shrink-0' />
                          {bullet}
                        </li>
                      ))}
                    </ul>

                    {step.tip && (
                      <div className='flex items-start gap-3 bg-primary-500/5 border border-primary-500/10 rounded-xl px-4 py-3'>
                        <span className='text-brand-coral font-bold text-sm shrink-0 mt-0.5'>
                          Tip
                        </span>
                        <p className='text-sm text-primary-500/65 leading-relaxed'>{step.tip}</p>
                      </div>
                    )}

                    {/* Step connector on mobile */}
                    {i < STEPS.length - 1 && (
                      <div className='flex lg:hidden items-center gap-2 mt-8 text-primary-500/30'>
                        <div className='h-px flex-1 bg-primary-500/10' />
                        <span className='text-xs uppercase tracking-widest'>Next step</span>
                        <div className='h-px flex-1 bg-primary-500/10' />
                      </div>
                    )}
                  </div>

                  {/* RIGHT — screen */}
                  <div className='order-1 lg:order-2 flex justify-center lg:justify-end'>
                    <div
                      className='relative rounded-[2.5rem] p-6 flex items-center justify-center'
                      style={{ background: 'hsl(174,72%,17%)' }}
                    >
                      {/* Subtle inner glow */}
                      <div
                        className='absolute inset-0 rounded-[2.5rem] pointer-events-none'
                        style={{
                          background:
                            'radial-gradient(ellipse at 30% 20%, rgba(245,84,73,0.15) 0%, transparent 60%)',
                        }}
                        aria-hidden='true'
                      />
                      <Image
                        src={step.image}
                        alt={step.alt}
                        width={280}
                        height={560}
                        className='relative w-[200px] lg:w-[240px] h-auto drop-shadow-2xl'
                        sizes='280px'
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-16 lg:py-20'>
          <div className='mx-auto max-w-2xl px-6 text-center'>
            <h2 className='font-playfair text-3xl lg:text-4xl font-bold text-white mb-4'>
              Ready to rescue your first bag?
            </h2>
            <p className='text-white/65 text-base leading-relaxed mb-8'>
              Download Too Fresh To Waste, find what's available near you, and start earning points
              with every pickup.
            </p>
            <div className='flex flex-col sm:flex-row gap-3 justify-center'>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-3 bg-white text-primary-500 font-bold px-6 py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-lg text-sm'
                aria-label='Download on App Store'
              >
                Download on App Store
              </AppDownloadButton>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-3 border border-white/40 text-white font-bold px-6 py-3.5 rounded-full hover:border-white/70 hover:bg-white/5 transition-colors text-sm'
                aria-label='Get it on Google Play'
              >
                Get it on Google Play
              </AppDownloadButton>
            </div>
            <Link
              href='/blog/how-to-collect-surprise-bag'
              className='inline-block mt-6 text-white/40 text-xs hover:text-white/70 transition-colors'
            >
              Read the full article instead →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
