import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { FAQSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

interface FoodWasteFactsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as Locale;
  const PATH = '/food-waste-facts';
  const alternateLanguages: Record<string, string> = {
    'x-default': getCanonicalUrl(PATH, 'en'),
  };
  locales.forEach(l => {
    alternateLanguages[getLocaleConfig(l).hreflang] = getCanonicalUrl(PATH, l);
  });
  return {
    title: 'Food Waste Facts - The Scale of What We Throw Away',
    description:
      'Each year, 2.5 billion tonnes of food never make it to a plate. Explore the data, the journey, and the usual suspects behind global food waste.',
    alternates: {
      canonical: getCanonicalUrl(PATH, loc),
      languages: alternateLanguages,
    },
  };
}

const stats = [
  {
    value: '40%',
    label: 'of all food produced globally is wasted each year',
    source: 'WWF Driven to Waste, 2021',
  },
  {
    value: '2.5B',
    label: 'tonnes of food lost or wasted annually worldwide',
    source: 'WWF & Tesco Report',
  },
  {
    value: '10%',
    label: 'of all greenhouse gas emissions come from wasted food',
    source: 'WWF',
  },
  {
    value: '$1.7B',
    label: 'spent yearly by U.S. schools on food that ends up in the trash',
    source: 'WWF Fact Sheet',
  },
];

const chapters = [
  {
    n: '01',
    title: 'On the Farm',
    text: '1.2 billion tonnes of food never even leave the field - lost to cosmetic standards, market gluts, and labor shortages.',
    imgSrc: '/images/food-waste/tomato.jpg',
  },
  {
    n: '02',
    title: 'In the Supply Chain',
    text: 'Refrigeration gaps, overproduction, and rejected harvests turn good food into landfill before it ever reaches a shelf.',
    imgSrc: '/images/food-waste/bread.jpg',
  },
  {
    n: '03',
    title: 'On Our Plates',
    text: 'Households are the single largest source of consumer waste - half a meal scraped off, every day, multiplied by billions.',
    imgSrc: '/images/food-waste/hero-waste.jpg',
  },
];

const foodWasteFactsFaqs = [
  {
    question: 'How much food is wasted globally each year?',
    answer:
      'According to the WWF, approximately 2.5 billion tonnes of food is lost or wasted annually worldwide - roughly 40% of all food produced.',
  },
  {
    question: 'What percentage of greenhouse gas emissions come from food waste?',
    answer:
      'Food waste is responsible for about 10% of all global greenhouse gas emissions, according to WWF research.',
  },
  {
    question: 'How does Too Fresh To Waste help reduce food waste in Tunisia?',
    answer:
      'Too Fresh To Waste connects consumers with local restaurants and shops that have surplus food, allowing it to be sold at 35-90% discount instead of being thrown away.',
  },
  {
    question: 'What is a surprise bag?',
    answer:
      'A surprise bag is a discounted package of surplus food from a local restaurant or store. You pay a fraction of the original price and pick it up at the end of service.',
  },
];

// Sources: ScienceDirect studies on food waste across the hospitality and retail sectors
// (Filimonau et al., Journal of Cleaner Production; Eriksson et al., Resources, Conservation & Recycling)
const wastedItems = [
  {
    sector: 'Hotels & Buffets',
    item: 'Bread & pastries',
    note: 'Over-prepared at breakfast buffets; ~30% returned uneaten.',
  },
  {
    sector: 'Restaurants',
    item: 'Cooked rice & pasta',
    note: 'Batch-cooked in excess; among the top plate-waste items.',
  },
  {
    sector: 'Supermarkets',
    item: 'Fresh fruit & vegetables',
    note: 'Highest in-store loss category - bruising and cosmetic culling.',
  },
  {
    sector: 'Grocery stores',
    item: 'Dairy (milk, yogurt)',
    note: 'Pulled days before expiry due to short shelf-life policies.',
  },
  {
    sector: 'Bakeries',
    item: 'Bread & baked goods',
    note: "10–20% of daily output discarded to keep shelves 'full till close'.",
  },
  {
    sector: 'Cafés & Restaurants',
    item: 'Meat & seafood trimmings',
    note: 'Highest carbon-cost waste per kilogram in foodservice.',
  },
];

export default async function FoodWasteFactsPage({ params }: FoodWasteFactsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <FAQSchema items={foodWasteFactsFaqs} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Food Waste Facts', url: getCanonicalUrl('/food-waste-facts', locale as Locale) },
        ]}
      />
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='relative'>
          <div className='mx-auto w-full max-w-[1400px] px-8 grid gap-12 py-10 md:grid-cols-12 md:py-16'>
            {/* Left copy */}
            <div className='md:col-span-7 animate-rise'>
              <p className='mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-brand-deep/60'>
                <span className='h-px w-10 bg-brand-coral' /> A report on what we throw away
              </p>
              <h1 className='font-heading text-5xl font-light leading-[0.95] text-balance md:text-7xl lg:text-8xl'>
                We grow enough food
                <span className='italic text-brand-coral'> to feed the world </span>- and then we
                throw it out.
              </h1>
              <p className='mt-8 max-w-xl text-lg leading-relaxed text-brand-deep/75'>
                Each year, 2.5 billion tonnes of food never make it to a plate. Behind every wasted
                meal lies wasted water, soil, fuel - and a planet running short on all three.
              </p>
              <div className='mt-10 flex flex-wrap gap-4'>
                <Link
                  href='#scale'
                  className='rounded-full bg-brand-deep px-7 py-3.5 text-sm text-brand-cream hover:bg-brand-coral hover:text-brand-deep transition-all hover:shadow-coral'
                >
                  See the numbers
                </Link>
                <Link
                  href='#act'
                  className='rounded-full border border-brand-deep/30 px-7 py-3.5 text-sm hover:border-brand-coral hover:text-brand-coral transition-colors'
                >
                  What you can do →
                </Link>
              </div>
            </div>

            {/* Right image */}
            <div className='md:col-span-5 relative'>
              <div className='relative overflow-hidden rounded-sm shadow-soft h-full min-h-[420px]'>
                <Image
                  src='/images/food-waste/hero-waste.jpg'
                  alt='Wasted produce still life'
                  fill
                  className='object-cover'
                  sizes='(max-width: 768px) 100vw, 42vw'
                  priority
                />
                <div className='absolute inset-0 bg-gradient-to-t from-brand-deep/60 via-transparent to-transparent' />
                <div className='absolute bottom-6 left-6 right-6 text-brand-cream'>
                  <p className='font-heading text-3xl italic leading-tight'>
                    "A third of dinner ends up in the bin."
                  </p>
                </div>
              </div>
              <div className='absolute -bottom-6 -left-6 hidden md:block bg-brand-coral text-brand-deep px-6 py-4 rotate-[-4deg] shadow-soft'>
                <p className='font-heading text-2xl font-medium'>est. 2025</p>
              </div>
            </div>
          </div>

          {/* Marquee ticker */}
          <div className='border-y border-brand-deep/15 bg-brand-deep py-2 text-brand-cream overflow-hidden'>
            <div className='flex w-max animate-marquee-fw gap-12 whitespace-nowrap'>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className='flex items-center gap-12 font-heading text-2xl italic'>
                  <span>40% of all food wasted</span>
                  <span className='text-brand-coral'>●</span>
                  <span>10% of global emissions</span>
                  <span className='text-brand-coral'>●</span>
                  <span>2.5 billion tonnes per year</span>
                  <span className='text-brand-coral'>●</span>
                  <span>1.2 billion tonnes lost on farms</span>
                  <span className='text-brand-coral'>●</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE SCALE ─────────────────────────────────────────────── */}
        <section id='scale' className='mx-auto w-full max-w-[1400px] px-8 py-10 md:py-14'>
          <div className='mb-8 grid gap-8 md:grid-cols-12'>
            <div className='md:col-span-4'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>Chapter I</p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                The scale of it.
              </h2>
            </div>
            <p className='md:col-span-7 md:col-start-6 text-lg leading-relaxed text-brand-deep/75'>
              Numbers from the World Wildlife Fund&apos;s <em>Driven to Waste</em> report make it
              plain: this is not a kitchen problem. It is a planetary one - and it touches every
              link of the food chain.
            </p>
          </div>

          <div className='grid gap-px bg-brand-deep/15 md:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-sm'>
            {stats.map((s, i) => (
              <div
                key={i}
                className='bg-brand-cream p-8 transition-colors hover:bg-brand-coral group'
              >
                <p className='font-heading text-6xl font-light leading-none md:text-7xl'>
                  {s.value}
                </p>
                <div className='mt-6 h-px w-12 bg-brand-deep/40 group-hover:bg-brand-deep' />
                <p className='mt-6 text-sm leading-relaxed'>{s.label}</p>
                <p className='mt-4 text-[11px] uppercase tracking-wider text-brand-deep/50 group-hover:text-brand-deep/70'>
                  {s.source}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── JOURNEY ───────────────────────────────────────────────── */}
        <section id='journey' className='bg-brand-deep text-brand-cream py-10 md:py-14 bg-grain'>
          <div className='mx-auto w-full max-w-[1400px] px-8'>
            <div className='mb-10'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Chapter II
              </p>
              <div className='grid gap-8 md:grid-cols-12'>
                <h2 className='md:col-span-5 font-heading text-5xl font-light md:text-6xl'>
                  The journey of <em className='text-brand-coral'>a wasted</em> meal.
                </h2>
                <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/70'>
                  Food is lost long before it ever spoils on your counter. Follow it from soil to
                  scrap.
                </p>
              </div>
            </div>

            <div className='space-y-px'>
              {chapters.map(c => (
                <article
                  key={c.n}
                  className='grid gap-6 border-t border-brand-cream/15 py-4 md:grid-cols-12 md:py-5 group'
                >
                  <p className='md:col-span-2 font-heading text-5xl font-light text-brand-coral'>
                    {c.n}
                  </p>
                  <div className='md:col-span-5'>
                    <h3 className='font-heading text-3xl md:text-4xl'>{c.title}</h3>
                    <p className='mt-4 text-brand-cream/70 leading-relaxed'>{c.text}</p>
                  </div>
                  <div className='md:col-span-5 overflow-hidden rounded-sm relative h-36'>
                    <Image
                      src={c.imgSrc}
                      alt={c.title}
                      fill
                      className='object-cover transition-transform duration-700 group-hover:scale-105'
                      sizes='(max-width: 768px) 100vw, 42vw'
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-10 md:py-14'>
          <blockquote className='mx-auto max-w-4xl text-center'>
            <p className='font-heading text-4xl font-light italic leading-tight md:text-6xl text-balance'>
              "If food waste were a country, it would be the
              <span className='text-brand-coral'> third-largest emitter </span>
              of greenhouse gases on Earth."
            </p>
            <footer className='mt-8 text-xs uppercase tracking-[0.25em] text-brand-deep/60'>
              - World Wildlife Fund
            </footer>
          </blockquote>
        </section>

        {/* ── CHAPTER III - WHAT GETS WASTED ────────────────────────── */}
        <section
          id='act'
          className='mx-auto w-full max-w-[1400px] px-8 pt-10 md:pt-14 pb-4 md:pb-6'
        >
          <div className='mb-8 grid gap-8 md:grid-cols-12'>
            <div className='md:col-span-5'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral'>Chapter III</p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                The usual <em className='text-brand-coral'>suspects</em>.
              </h2>
            </div>
            <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-deep/75'>
              Across hotels, restaurants, supermarkets, grocery stores and bakeries, the same
              handful of foods dominate the bin. Findings drawn from peer-reviewed studies indexed
              on{' '}
              <a
                href='https://www.sciencedirect.com/'
                target='_blank'
                rel='noopener noreferrer'
                className='underline decoration-brand-coral underline-offset-4 hover:text-brand-coral'
              >
                ScienceDirect
              </a>
              .
            </p>
          </div>

          <div className='grid gap-px bg-brand-deep/15 md:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-sm'>
            {wastedItems.map((w, i) => (
              <article
                key={i}
                className='bg-brand-cream p-4 transition-colors hover:bg-brand-coral group'
              >
                <p className='font-heading text-5xl font-light text-brand-deep/30 group-hover:text-brand-deep/70'>
                  0{i + 1}
                </p>
                <p className='mt-4 text-[11px] uppercase tracking-[0.2em] text-brand-coral group-hover:text-brand-deep'>
                  {w.sector}
                </p>
                <h3 className='mt-3 font-heading text-3xl leading-tight'>{w.item}</h3>
                <div className='mt-5 h-px w-12 bg-brand-deep/40 group-hover:bg-brand-deep' />
                <p className='mt-5 text-sm leading-relaxed text-brand-deep/75 group-hover:text-brand-deep'>
                  {w.note}
                </p>
              </article>
            ))}
          </div>

          <p className='mt-8 text-xs uppercase tracking-[0.2em] text-brand-deep/50'>
            Source: ScienceDirect - Filimonau et al.; Eriksson et al.; Papargyropoulou et al.
          </p>
        </section>
      </div>
    </>
  );
}
