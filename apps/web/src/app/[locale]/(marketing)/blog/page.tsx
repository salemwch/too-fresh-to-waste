import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { getAllPosts, formatDate, type PostMeta } from '@/lib/blog';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Blog — Too Fresh To Waste',
    description:
      'Food waste insights, tips, and stories from Too Fresh To Waste — reducing food waste across Tunisia, one Surprise Bag at a time.',
    alternates: { canonical: '/blog' },
    openGraph: {
      title: 'Blog — Too Fresh To Waste',
      description: 'Food waste insights, tips, and stories from Too Fresh To Waste.',
      type: 'website',
    },
  };
}

const TAG_LABELS: Record<string, string> = {
  'food-waste': 'Food Waste',
  sustainability: 'Sustainability',
  restaurants: 'Restaurants',
  bakeries: 'Bakeries',
  tips: 'Tips',
  tunisia: 'Tunisia',
};

function PostCard({ post }: { post: PostMeta }) {
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
        <div className='p-6'>
          <div className='flex flex-wrap gap-1.5 mb-4'>
            {post.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className='text-[10px] uppercase tracking-wider text-brand-coral bg-brand-coral/10 px-2 py-0.5 rounded-full'
              >
                {TAG_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>
          <h2 className='font-display text-xl font-light leading-snug text-brand-deep group-hover:text-brand-coral transition-colors'>
            {post.title}
          </h2>
          <p className='mt-3 text-sm leading-relaxed text-brand-deep/65 line-clamp-3'>
            {post.description}
          </p>
          <div className='mt-5 flex items-center justify-between text-[11px] text-brand-deep/45 uppercase tracking-wider'>
            <span>{formatDate(post.date)}</span>
            <span>{post.readTime} min read</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <>
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 pt-14 pb-10 md:pt-20'>
          <p className='flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-brand-deep/60 mb-6'>
            <span className='h-px w-10 bg-brand-coral' /> Journal
          </p>
          <div className='grid gap-8 md:grid-cols-12'>
            <h1 className='md:col-span-6 font-display text-6xl font-light leading-[0.92] md:text-7xl'>
              Stories about <em className='italic text-brand-coral'>food</em>.
            </h1>
            <p className='md:col-span-5 md:col-start-8 self-end text-lg leading-relaxed text-brand-deep/65'>
              Insights, tips, and the numbers behind food waste in Tunisia — and what we can do
              about it.
            </p>
          </div>
        </section>

        {/* ── FEATURED POST ─────────────────────────────────────────── */}
        {featured && (
          <section className='mx-auto w-full max-w-[1400px] px-8 pb-12'>
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
                <div className='bg-white/60 p-8 md:p-12 flex flex-col justify-center'>
                  <p className='text-[10px] uppercase tracking-wider text-brand-coral mb-4'>
                    Latest Post
                  </p>
                  <div className='flex flex-wrap gap-1.5 mb-5'>
                    {featured.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className='text-[10px] uppercase tracking-wider text-brand-coral bg-brand-coral/10 px-2 py-0.5 rounded-full'
                      >
                        {TAG_LABELS[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                  <h2 className='font-display text-3xl font-light leading-snug md:text-4xl group-hover:text-brand-coral transition-colors'>
                    {featured.title}
                  </h2>
                  <p className='mt-4 text-sm leading-relaxed text-brand-deep/65 max-w-md'>
                    {featured.description}
                  </p>
                  <div className='mt-8 flex items-center gap-6 text-[11px] text-brand-deep/45 uppercase tracking-wider'>
                    <span>{formatDate(featured.date)}</span>
                    <span>·</span>
                    <span>{featured.readTime} min read</span>
                  </div>
                  <span className='mt-6 inline-flex items-center gap-2 text-sm text-brand-deep group-hover:text-brand-coral transition-colors'>
                    Read article{' '}
                    <span className='transition-transform group-hover:translate-x-1'>→</span>
                  </span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ── POST GRID ─────────────────────────────────────────────── */}
        {rest.length > 0 && (
          <section className='mx-auto w-full max-w-[1400px] px-8 pb-20'>
            <div className='flex items-center gap-4 mb-8'>
              <div className='h-px flex-1 bg-brand-deep/10' />
              <p className='text-[11px] uppercase tracking-[0.2em] text-brand-deep/40'>All Posts</p>
              <div className='h-px flex-1 bg-brand-deep/10' />
            </div>
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {rest.map(post => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        {posts.length === 0 && (
          <div className='mx-auto max-w-[1400px] px-8 pb-20 text-center py-20'>
            <p className='text-brand-deep/40'>No posts yet. Check back soon.</p>
          </div>
        )}
      </div>
    </>
  );
}
