import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { getPostBySlug, getAllSlugs, getAllPosts, formatDate } from '@/lib/blog';
import { ArticleStructuredData } from '@/components/StructuredData';
import { getCanonicalUrl } from '@/config/seo.config';

interface PostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — Too Fresh To Waste`,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      ...(post.coverImage && { images: [{ url: post.coverImage }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
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

const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className='font-display text-3xl font-light mt-12 mb-5 text-brand-deep leading-snug'
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className='text-lg font-semibold mt-8 mb-3 text-brand-deep' {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className='text-[15px] leading-[1.85] text-brand-deep/80 mb-5' {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className='text-brand-coral underline underline-offset-2 hover:text-brand-deep transition-colors'
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className='space-y-2 my-5 ps-5 list-disc marker:text-brand-coral text-[15px] text-brand-deep/80'
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className='space-y-2 my-5 ps-5 list-decimal marker:text-brand-coral text-[15px] text-brand-deep/80'
      {...props}
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className='leading-relaxed' {...props} />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className='font-semibold text-brand-deep' {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em className='italic text-brand-deep/70' {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className='border-s-2 border-brand-coral ps-5 my-6 text-brand-deep/65 italic text-[15px] leading-relaxed'
      {...props}
    />
  ),
  hr: () => <hr className='border-brand-deep/10 my-10' />,
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className='overflow-x-auto my-6'>
      <table className='w-full text-sm border-collapse' {...props} />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className='text-left px-4 py-2 bg-brand-deep text-brand-cream text-xs uppercase tracking-wider font-medium'
      {...props}
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className='px-4 py-2 border-b border-brand-deep/10 text-brand-deep/75' {...props} />
  ),
};

export default async function BlogPostPage({ params }: PostPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const related = allPosts
    .filter(p => p.slug !== slug && p.tags.some(t => post.tags.includes(t)))
    .slice(0, 3);

  const canonicalUrl = getCanonicalUrl(`/blog/${slug}`, locale as 'en' | 'fr' | 'ar');

  return (
    <>
      <Header />

      <ArticleStructuredData
        title={post.title}
        description={post.description}
        date={post.date}
        url={canonicalUrl}
        {...(post.coverImage ? { coverImage: post.coverImage } : {})}
      />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[800px] px-8 pt-14 pb-8 md:pt-20'>
          {/* Breadcrumb */}
          <nav className='flex items-center gap-2 text-xs text-brand-deep/45 mb-10 uppercase tracking-wider'>
            <Link href='/' className='hover:text-brand-deep transition-colors'>
              Home
            </Link>
            <span>/</span>
            <Link href='/blog' className='hover:text-brand-deep transition-colors'>
              Blog
            </Link>
            <span>/</span>
            <span className='text-brand-deep/70 truncate max-w-[200px]'>{post.title}</span>
          </nav>

          {/* Tags */}
          <div className='flex flex-wrap gap-2 mb-6'>
            {post.tags.map(tag => (
              <span
                key={tag}
                className='text-[10px] uppercase tracking-wider text-brand-coral bg-brand-coral/10 px-2.5 py-1 rounded-full'
              >
                {TAG_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className='font-display text-4xl font-light leading-[1.05] text-brand-deep md:text-5xl lg:text-6xl'>
            {post.title}
          </h1>

          {/* Meta */}
          <div className='mt-6 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-wider text-brand-deep/40'>
            <span>{post.author}</span>
            <span className='text-brand-coral'>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className='text-brand-coral'>·</span>
            <span>{post.readTime} min read</span>
          </div>
        </section>

        {/* ── COVER IMAGE ───────────────────────────────────────────── */}
        {post.coverImage && (
          <div className='mx-auto w-full max-w-[1000px] px-8 pb-12'>
            <div className='relative h-64 md:h-[420px] overflow-hidden rounded-sm'>
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className='object-cover'
                sizes='(max-width: 768px) 100vw, 1000px'
                priority
              />
              <div className='absolute inset-0 bg-gradient-to-t from-brand-deep/20 to-transparent' />
            </div>
          </div>
        )}

        {/* ── ARTICLE BODY ──────────────────────────────────────────── */}
        <article className='mx-auto w-full max-w-[720px] px-8 pb-20'>
          <MDXRemote
            source={post.content}
            components={mdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
              },
            }}
          />
        </article>

        {/* ── RELATED POSTS ─────────────────────────────────────────── */}
        {related.length > 0 && (
          <section className='border-t border-brand-deep/10 bg-white/30'>
            <div className='mx-auto w-full max-w-[1400px] px-8 py-14'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Keep reading
              </p>
              <h2 className='font-display text-3xl font-light mb-8'>More articles</h2>
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {related.map(p => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className='group block'>
                    <article className='border-t-2 border-brand-deep/10 pt-5 group-hover:border-brand-coral transition-colors'>
                      <div className='flex flex-wrap gap-1.5 mb-3'>
                        {p.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className='text-[10px] uppercase tracking-wider text-brand-deep/40'
                          >
                            {TAG_LABELS[tag] ?? tag}
                          </span>
                        ))}
                      </div>
                      <h3 className='font-display text-xl font-light leading-snug group-hover:text-brand-coral transition-colors'>
                        {p.title}
                      </h3>
                      <p className='mt-2 text-sm text-brand-deep/55 line-clamp-2'>
                        {p.description}
                      </p>
                      <p className='mt-4 text-[11px] text-brand-deep/35 uppercase tracking-wider'>
                        {p.readTime} min read
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className='bg-brand-deep text-brand-cream py-14'>
          <div className='mx-auto w-full max-w-[720px] px-8 text-center'>
            <p className='text-xs uppercase tracking-[0.25em] text-brand-coral mb-4'>
              Too Fresh To Waste
            </p>
            <h2 className='font-display text-3xl font-light md:text-4xl mb-5'>
              Stop throwing away <em>margin</em>.
            </h2>
            <p className='text-brand-cream/65 text-sm leading-relaxed mb-8 max-w-md mx-auto'>
              Join the platform turning Tunisia&rsquo;s daily food surplus into revenue — for
              businesses and savings for consumers.
            </p>
            <div className='flex flex-wrap justify-center gap-4'>
              <Link
                href='/partners'
                className='rounded-full bg-brand-coral text-brand-deep px-6 py-3 text-sm font-medium hover:bg-brand-cream transition-colors'
              >
                Become a partner
              </Link>
              <Link
                href='/blog'
                className='rounded-full border border-brand-cream/30 px-6 py-3 text-sm hover:border-brand-cream/60 transition-colors'
              >
                ← Back to Blog
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
