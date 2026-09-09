import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { getAllPosts, formatDate, type PostMeta } from '@/lib/blog';
import { buildLocalizedPageMetadata, type LocalizedMeta } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

const PATH = '/blog';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

const META: LocalizedMeta = {
  en: {
    title: 'Blog - Food Waste Insights from Tunisia',
    description:
      'Food waste insights, tips and stories from Too Fresh To Waste - reducing food waste across Tunisia, one surprise bag at a time.',
  },
  fr: {
    title: 'Blog - Comprendre le Gaspillage Alimentaire en Tunisie',
    description:
      'Analyses, conseils et chiffres sur le gaspillage alimentaire en Tunisie - et ce que commerçants et consommateurs peuvent y faire concrètement.',
  },
  ar: {
    title: 'المدونة - رؤى حول هدر الطعام في تونس',
    description:
      'تحليلات ونصائح وأرقام حول هدر الطعام في تونس، وما يمكن للتجار والمستهلكين فعله حياله.',
  },
};

// The index previously emitted a bare relative '/blog' canonical for all three
// locales, collapsing them into one indexable page. buildLocalizedPageMetadata
// gives each locale its own absolute canonical plus reciprocal hreflang.
export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedPageMetadata(PATH, locale as Locale, META);
}

const TAG_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    'food-waste': 'Food Waste',
    sustainability: 'Sustainability',
    restaurants: 'Restaurants',
    bakeries: 'Bakeries',
    tips: 'Tips',
    tunisia: 'Tunisia',
  },
  fr: {
    'food-waste': 'Gaspillage Alimentaire',
    sustainability: 'Durabilité',
    restaurants: 'Restaurants',
    bakeries: 'Boulangeries',
    tips: 'Conseils',
    tunisia: 'Tunisie',
  },
  ar: {
    'food-waste': 'هدر الطعام',
    sustainability: 'الاستدامة',
    restaurants: 'مطاعم',
    bakeries: 'مخابز',
    tips: 'نصائح',
    tunisia: 'تونس',
  },
};

const UI = {
  en: {
    eyebrow: 'Journal',
    headingA: 'Stories about',
    headingEm: 'food',
    lede: 'Insights, tips, and the numbers behind food waste in Tunisia - and what we can do about it.',
    latest: 'Latest Post',
    readArticle: 'Read article',
    allPosts: 'All Posts',
    minRead: 'min read',
    empty: 'No posts yet. Check back soon.',
  },
  fr: {
    eyebrow: 'Journal',
    headingA: 'Histoires de',
    headingEm: 'nourriture',
    lede: 'Analyses, conseils et chiffres sur le gaspillage alimentaire en Tunisie - et ce que nous pouvons y faire.',
    latest: 'Dernier article',
    readArticle: 'Lire l’article',
    allPosts: 'Tous les articles',
    minRead: 'min de lecture',
    empty: 'Pas encore d’articles. Revenez bientôt.',
  },
  ar: {
    eyebrow: 'المدونة',
    headingA: 'قصص عن',
    headingEm: 'الطعام',
    lede: 'تحليلات ونصائح وأرقام حول هدر الطعام في تونس، وما يمكننا فعله حياله.',
    latest: 'أحدث مقال',
    readArticle: 'اقرأ المقال',
    allPosts: 'كل المقالات',
    minRead: 'دقائق قراءة',
    empty: 'لا توجد مقالات بعد. عد قريبًا.',
  },
} as const;

function PostCard({ post, loc }: { post: PostMeta; loc: Locale }) {
  const tags = TAG_LABELS[loc] ?? TAG_LABELS.en;
  const ui = UI[loc] ?? UI.en;
  return (
    <Link href={`/blog/${post.slug}`} className='group block'>
      <article className='h-full bg-white/60 border border-brand-deep/10 rounded-sm overflow-hidden hover:border-brand-coral/40 transition-colors'>
        {post.coverImage && (
          <div className='relative h-48 overflow-hidden'>
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className='object-cover transition-transform duration-500 group-hover:scale-105'
              sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            />
            <div className='absolute inset-0 bg-gradient-to-t from-brand-deep/40 to-transparent' />
          </div>
        )}
        <div className='p-2xl'>
          <div className='flex flex-wrap gap-1.5 mb-lg'>
            {post.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className='text-[10px] uppercase tracking-wider text-brand-green bg-brand-coral/10 px-sm py-xxs rounded-full'
              >
                {tags[tag] ?? tag}
              </span>
            ))}
          </div>
          <h2 className='font-heading text-xl font-light leading-snug text-brand-deep group-hover:text-brand-green transition-colors'>
            {post.title}
          </h2>
          <p className='mt-md text-sm leading-relaxed text-brand-deep/65 line-clamp-3'>
            {post.description}
          </p>
          <div className='mt-xl flex items-center justify-between text-[11px] text-brand-deep/45 uppercase tracking-wider'>
            <span>{formatDate(post.date, loc)}</span>
            <span>
              {post.readTime} {ui.minRead}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  const loc = locale as Locale;
  setRequestLocale(locale);

  const tags = TAG_LABELS[loc] ?? TAG_LABELS.en;
  const ui = UI[loc] ?? UI.en;

  // Only posts written in this locale. A locale with no translations shows the
  // empty state rather than silently listing English articles under /fr.
  const posts = getAllPosts(loc);
  const [featured, ...rest] = posts;

  return (
    <>
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-4xl pt-14 pb-6xl md:pt-5xl'>
          <p className='flex items-center gap-md text-xs uppercase tracking-[0.25em] text-brand-deep/60 mb-2xl'>
            {ui.eyebrow}
          </p>
          <div className='grid gap-4xl md:grid-cols-12'>
            <h1 className='md:col-span-6 font-heading text-6xl font-light leading-[0.92] md:text-7xl'>
              {ui.headingA} <em className='italic text-brand-green'>{ui.headingEm}</em>.
            </h1>
            <p className='md:col-span-5 md:col-start-8 self-end text-lg leading-relaxed text-brand-deep/65'>
              {ui.lede}
            </p>
          </div>
        </section>

        {/* ── FEATURED POST ─────────────────────────────────────────── */}
        {featured && (
          <section className='mx-auto w-full max-w-[1400px] px-4xl pb-3xl'>
            <Link href={`/blog/${featured.slug}`} className='group block'>
              <div className='grid gap-0 md:grid-cols-2 overflow-hidden rounded-sm border border-brand-deep/10 hover:border-brand-coral/40 transition-colors'>
                {featured.coverImage && (
                  <div className='relative h-64 md:h-auto overflow-hidden'>
                    <Image
                      src={featured.coverImage}
                      alt={featured.title}
                      fill
                      className='object-cover transition-transform duration-700 group-hover:scale-105'
                      sizes='(max-width: 768px) 100vw, 50vw'
                      priority
                    />
                    <div className='absolute inset-0 bg-gradient-to-r from-transparent to-brand-deep/20' />
                  </div>
                )}
                <div className='bg-white/60 p-4xl md:p-3xl flex flex-col justify-center'>
                  <p className='text-[10px] uppercase tracking-wider text-brand-green mb-lg'>
                    {ui.latest}
                  </p>
                  <div className='flex flex-wrap gap-1.5 mb-xl'>
                    {featured.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className='text-[10px] uppercase tracking-wider text-brand-green bg-brand-coral/10 px-sm py-xxs rounded-full'
                      >
                        {tags[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                  <h2 className='font-heading text-3xl font-light leading-snug md:text-4xl group-hover:text-brand-green transition-colors'>
                    {featured.title}
                  </h2>
                  <p className='mt-lg text-sm leading-relaxed text-brand-deep/65 max-w-md'>
                    {featured.description}
                  </p>
                  <div className='mt-4xl flex items-center gap-2xl text-[11px] text-brand-deep/45 uppercase tracking-wider'>
                    <span>{formatDate(featured.date, loc)}</span>
                    <span>·</span>
                    <span>
                      {featured.readTime} {ui.minRead}
                    </span>
                  </div>
                  <span className='mt-2xl inline-flex items-center gap-sm text-sm text-brand-deep group-hover:text-brand-green transition-colors'>
                    {ui.readArticle}{' '}
                    <span className='transition-transform group-hover:translate-x-xs'>→</span>
                  </span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ── POST GRID ─────────────────────────────────────────────── */}
        {rest.length > 0 && (
          <section className='mx-auto w-full max-w-[1400px] px-4xl pb-5xl'>
            <div className='flex items-center gap-lg mb-4xl'>
              <div className='h-px flex-1 bg-brand-deep/10' />
              <p className='text-[11px] uppercase tracking-[0.2em] text-brand-deep/40'>
                {ui.allPosts}
              </p>
              <div className='h-px flex-1 bg-brand-deep/10' />
            </div>
            <div className='grid gap-2xl sm:grid-cols-2 lg:grid-cols-3'>
              {rest.map(post => (
                <PostCard key={post.slug} post={post} loc={loc} />
              ))}
            </div>
          </section>
        )}

        {posts.length === 0 && (
          <div className='mx-auto max-w-[1400px] px-4xl pb-5xl text-center py-5xl'>
            <p className='text-brand-deep/40'>{ui.empty}</p>
          </div>
        )}
      </div>
    </>
  );
}
