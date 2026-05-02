# SEO Plan 2: Blog Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete blog system inside Next.js — MDX file storage,
static generation, hub page, individual articles, author pages, category
archives — with E-E-A-T signals and thin-content protection on archive routes.

**Architecture:** MDX files stored in `/content/blog/[locale]/[slug].mdx`.
`gray-matter` parses frontmatter at build time. `next-mdx-remote/rsc` renders
content server-side. `generateStaticParams` builds all pages statically. No
database required. Archive pages enforce noindex thresholds via
`generateMetadata`.

**Tech Stack:** Next.js 15 App Router, TypeScript, `next-mdx-remote`,
`gray-matter`, `reading-time`, Jest + RTL, Tailwind CSS

**Prerequisite:** Plan 1 complete (uses `getCanonicalUrl`, `ArticleSchema`,
`BreadcrumbSchema`, `FAQSchema` from Plan 1)

---

## File Map

**Install:**

- `next-mdx-remote@5.x` — MDX rendering in App Router RSC
- `gray-matter@4.x` — frontmatter YAML parsing
- `reading-time@1.x` — auto read-time calculation

**Create:**

- `content/blog/en/.gitkeep`
- `content/blog/fr/.gitkeep`
- `content/blog/ar/.gitkeep`
- `content/authors/en/team.md` — seed author file
- `content/blog/en/what-is-a-surprise-bag.mdx` — seed article (English)
- `content/blog/fr/quest-ce-quun-surprise-bag.mdx` — seed article (French)
- `apps/web/src/types/blog.ts` — frontmatter + article types
- `apps/web/src/lib/blog.ts` — MDX read/parse utilities
- `apps/web/src/app/[locale]/(marketing)/blog/page.tsx` — hub
- `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx` — article
- `apps/web/src/app/[locale]/(marketing)/blog/category/[category]/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/blog/author/[author]/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/blog/tag/[tag]/page.tsx`
- `apps/web/src/__tests__/lib/blog.test.ts`

**Modify:**

- `apps/web/package.json` — add `next-mdx-remote`, `gray-matter`, `reading-time`
- `apps/web/src/app/sitemap.ts` — add blog article entries (uncomment stub from
  Plan 1)

---

## Task 1: Install MDX dependencies

- [ ] **Step 1: Install packages**

```bash
pnpm --filter @foodwaste/web add next-mdx-remote@5.0.0 gray-matter@4.0.3 reading-time@1.5.0
```

Note: `gray-matter`, `next-mdx-remote`, and `reading-time` all ship their own
TypeScript types — no `@types/` packages needed.

- [ ] **Step 3: Verify installation**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors (new packages have no TS conflicts)

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add next-mdx-remote, gray-matter, reading-time for blog MDX"
```

---

## Task 2: Blog types

**Files:** `apps/web/src/types/blog.ts`

- [ ] **Step 1: Write type tests**

Create `apps/web/src/__tests__/lib/blog.test.ts`:

```typescript
import { parseBlogFrontmatter } from '@/lib/blog';

describe('parseBlogFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const raw = `---
title: "Test Article"
description: "A test."
author: "team"
publishedAt: "2026-05-01"
updatedAt: "2026-05-01"
locale: "en"
category: "food-waste"
tags: ["food"]
pillar: "food-waste-mena"
readTime: 5
featured: false
---
Hello world`;
    const result = parseBlogFrontmatter(raw);
    expect(result.data.title).toBe('Test Article');
    expect(result.data.locale).toBe('en');
    expect(result.data.tags).toEqual(['food']);
  });

  it('throws if required fields are missing', () => {
    const raw = `---
title: "Missing Fields"
---
Content`;
    expect(() => parseBlogFrontmatter(raw)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="lib/blog" --no-coverage
```

Expected: FAIL — `parseBlogFrontmatter` not found

- [ ] **Step 3: Create `apps/web/src/types/blog.ts`**

```typescript
export type BlogLocale = 'en' | 'fr' | 'ar';

export type BlogCategory =
  | 'food-waste'
  | 'sustainability'
  | 'charity'
  | 'business'
  | 'rewards'
  | 'food';

export interface BlogFrontmatter {
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  locale: BlogLocale;
  category: BlogCategory;
  tags: string[];
  pillar: string;
  readTime: number;
  ogImage?: string;
  featured: boolean;
  hreflang?: Partial<Record<BlogLocale, string>>;
}

export interface BlogArticle {
  slug: string;
  locale: BlogLocale;
  frontmatter: BlogFrontmatter;
  content: string;
  readingTime: string;
}

export interface AuthorFrontmatter {
  name: string;
  title: string;
  bio: string;
  avatar?: string;
  linkedin?: string;
}

export interface Author {
  slug: string;
  frontmatter: AuthorFrontmatter;
  articleCount: number;
}

export const ARCHIVE_INDEX_THRESHOLDS = {
  category: 8,
  author: 3,
  tag: Infinity, // tags are never indexed
} as const;
```

- [ ] **Step 4: Create `apps/web/src/lib/blog.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type {
  BlogFrontmatter,
  BlogArticle,
  BlogLocale,
  AuthorFrontmatter,
  Author,
} from '@/types/blog';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const BLOG_DIR = path.join(CONTENT_DIR, 'blog');
const AUTHORS_DIR = path.join(CONTENT_DIR, 'authors');

const REQUIRED_FIELDS: (keyof BlogFrontmatter)[] = [
  'title',
  'description',
  'author',
  'publishedAt',
  'updatedAt',
  'locale',
  'category',
  'tags',
  'pillar',
  'readTime',
  'featured',
];

export function parseBlogFrontmatter(
  raw: string,
): matter.GrayMatterFile<string> {
  const parsed = matter(raw);
  for (const field of REQUIRED_FIELDS) {
    if (parsed.data[field] === undefined || parsed.data[field] === null) {
      throw new Error(
        `Blog article missing required frontmatter field: "${field}"`,
      );
    }
  }
  return parsed;
}

export function getAllArticles(locale: BlogLocale): BlogArticle[] {
  const dir = path.join(BLOG_DIR, locale);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(filename => {
      const slug = filename.replace(/\.mdx$/, '');
      const raw = fs.readFileSync(path.join(dir, filename), 'utf8');
      const parsed = parseBlogFrontmatter(raw);
      const stats = readingTime(parsed.content);
      return {
        slug,
        locale,
        frontmatter: parsed.data as BlogFrontmatter,
        content: parsed.content,
        readingTime: stats.text,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.frontmatter.publishedAt).getTime() -
        new Date(a.frontmatter.publishedAt).getTime(),
    );
}

export function getArticle(
  locale: BlogLocale,
  slug: string,
): BlogArticle | null {
  const filePath = path.join(BLOG_DIR, locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseBlogFrontmatter(raw);
  const stats = readingTime(parsed.content);
  return {
    slug,
    locale,
    frontmatter: parsed.data as BlogFrontmatter,
    content: parsed.content,
    readingTime: stats.text,
  };
}

export function getArticlesByCategory(
  locale: BlogLocale,
  category: string,
): BlogArticle[] {
  return getAllArticles(locale).filter(
    a => a.frontmatter.category === category,
  );
}

export function getArticlesByTag(
  locale: BlogLocale,
  tag: string,
): BlogArticle[] {
  return getAllArticles(locale).filter(a => a.frontmatter.tags.includes(tag));
}

export function getArticlesByAuthor(
  locale: BlogLocale,
  authorSlug: string,
): BlogArticle[] {
  return getAllArticles(locale).filter(
    a => a.frontmatter.author === authorSlug,
  );
}

export function getAllSlugs(locale: BlogLocale): string[] {
  const dir = path.join(BLOG_DIR, locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

export function getAuthor(locale: BlogLocale, slug: string): Author | null {
  const filePath = path.join(AUTHORS_DIR, locale, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const articles = getArticlesByAuthor(locale, slug);
  return {
    slug,
    frontmatter: parsed.data as AuthorFrontmatter,
    articleCount: articles.length,
  };
}

export function getAllCategories(locale: BlogLocale): string[] {
  const articles = getAllArticles(locale);
  return [...new Set(articles.map(a => a.frontmatter.category))];
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="lib/blog" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types/blog.ts apps/web/src/lib/blog.ts apps/web/src/__tests__/lib/blog.test.ts
git commit -m "feat(blog): add MDX blog types and file-system utility functions"
```

---

## Task 3: Seed content — author file + first article

- [ ] **Step 1: Create content directory structure**

```bash
mkdir -p content/blog/en content/blog/fr content/blog/ar
mkdir -p content/authors/en content/authors/fr content/authors/ar
```

- [ ] **Step 2: Create seed author file**

Create `content/authors/en/team.md`:

```markdown
---
name: 'Too Fresh To Waste Team'
title: 'Sustainability & Food Waste Experts'
bio:
  'The Too Fresh To Waste editorial team brings together food systems
  researchers, sustainability consultants, and digital product experts working
  to eliminate food waste across the MENA region.'
avatar: '/images/authors/team-avatar.jpg'
linkedin: 'https://www.linkedin.com/company/too-fresh-to-waste/'
---
```

Create `content/authors/fr/team.md`:

```markdown
---
name: 'Équipe Too Fresh To Waste'
title: 'Experts en Durabilité et Gaspillage Alimentaire'
bio:
  "L'équipe éditoriale de Too Fresh To Waste réunit des chercheurs en systèmes
  alimentaires, des consultants en durabilité et des experts en produit
  numérique, tous engagés à éliminer le gaspillage alimentaire dans la région
  MENA."
avatar: '/images/authors/team-avatar.jpg'
linkedin: 'https://www.linkedin.com/company/too-fresh-to-waste/'
---
```

Create `content/authors/ar/team.md`:

```markdown
---
name: 'فريق Too Fresh To Waste'
title: 'خبراء الاستدامة والحد من هدر الطعام'
bio:
  'يضم الفريق التحريري لـ Too Fresh To Waste باحثين في أنظمة الغذاء ومستشارين في
  الاستدامة وخبراء في المنتجات الرقمية، جميعهم ملتزمون بالقضاء على هدر الطعام في
  منطقة الشرق الأوسط وشمال أفريقيا.'
avatar: '/images/authors/team-avatar.jpg'
linkedin: 'https://www.linkedin.com/company/too-fresh-to-waste/'
---
```

- [ ] **Step 3: Create seed English article**

Create `content/blog/en/what-is-a-surprise-bag.mdx`:

```mdx
---
title: 'What Is a Surprise Bag? The Complete Guide to Fighting Food Waste'
description:
  'A surprise bag is a discounted package of surplus food from local restaurants
  and shops. Learn how it works, how much you save, and why it matters for food
  waste.'
author: 'team'
publishedAt: '2026-05-02'
updatedAt: '2026-05-02'
locale: 'en'
hreflang:
  fr: 'quest-ce-quun-surprise-bag'
  ar: 'ما-هي-حقيبة-المفاجأة'
category: 'food-waste'
tags: ['surprise-bag', 'food-waste', 'save-money', 'tunisia']
pillar: 'surprise-bag-guide'
readTime: 6
ogImage: '/images/blog/what-is-a-surprise-bag.jpg'
featured: true
---

Every day, restaurants and shops prepare more food than they sell. At closing
time, the excess either gets thrown away — or it ends up as a **surprise bag**.

## What Is a Surprise Bag?

A surprise bag is a discounted package of leftover or surplus food sold by a
local restaurant, bakery, or grocery store at the end of their service period.
You pay a fraction of the original price — typically **35–90% less** — and
collect it during a short pickup window.

The contents are, as the name suggests, a surprise. You might get three pastries
from a bakery, a full meal from a restaurant, or a box of produce from a grocery
store. The variety is part of the appeal.

## Why Do Restaurants Sell Surprise Bags?

Restaurants face two problems at closing time:

1. **Food waste**: Unsold food that cannot safely be sold the next day must be
   discarded.
2. **Lost revenue**: Prepared food that goes in the bin represents real money
   lost.

Surprise bags solve both. Restaurants recover some revenue from food they would
have thrown away. Consumers get quality food at a fraction of the price.

## How Does It Work on Too Fresh To Waste?

1. **Browse** available surprise bags near you on the app
2. **Purchase** the bag and receive a pickup code
3. **Collect** your bag during the pickup window
4. **Enjoy** — and know you helped prevent food waste

## How Much Can You Save?

On Too Fresh To Waste, surprise bags are priced at **35–90% below the original
value**. A bag containing food worth 20 TND might be available for as little as
5 TND.

## The Environmental Impact

Every surprise bag prevents food from going to a landfill. Each kilogram of food
waste avoided eliminates approximately **2.5 kg of CO₂ equivalent** emissions —
because organic waste in landfills generates methane, a greenhouse gas 25 times
more potent than CO₂.

## Sources

- WWF, _Driven to Waste: The Global Food Loss and Waste Crisis_, 2021
- UNEP, _Food Waste Index Report_, 2021
- FAO, _Global Food Losses and Food Waste_, 2011
```

- [ ] **Step 4: Create seed French article**

Create `content/blog/fr/quest-ce-quun-surprise-bag.mdx`:

```mdx
---
title: "Qu'est-ce qu'un Surprise Bag ? Le Guide Complet"
description:
  'Un surprise bag est un paquet de nourriture en surplus vendu à prix réduit
  par les restaurants et commerces locaux. Découvrez comment ça marche et
  combien vous pouvez économiser.'
author: 'team'
publishedAt: '2026-05-02'
updatedAt: '2026-05-02'
locale: 'fr'
hreflang:
  en: 'what-is-a-surprise-bag'
  ar: 'ما-هي-حقيبة-المفاجأة'
category: 'food-waste'
tags: ['surprise-bag', 'gaspillage-alimentaire', 'économiser', 'tunisie']
pillar: 'surprise-bag-guide'
readTime: 6
ogImage: '/images/blog/what-is-a-surprise-bag.jpg'
featured: true
---

Chaque jour, les restaurants et les commerces préparent plus de nourriture
qu'ils n'en vendent. À la fermeture, les surplus finissent soit à la poubelle —
soit dans un **surprise bag**.

## Qu'est-ce qu'un Surprise Bag ?

Un surprise bag est un paquet de nourriture en surplus ou invendue, vendu par un
restaurant, une boulangerie ou une épicerie locale à la fin de leur service.
Vous payez une fraction du prix original — généralement **35 à 90 % moins cher**
— et vous récupérez votre commande pendant une courte fenêtre de retrait.

## Pourquoi les Restaurants Vendent-ils des Surprise Bags ?

À la fermeture, les restaurateurs font face à deux problèmes :

1. **Le gaspillage alimentaire** : La nourriture non vendue qui ne peut pas être
   conservée doit être jetée.
2. **La perte de revenus** : De la nourriture préparée qui finit à la poubelle
   représente de l'argent perdu.

Les surprise bags résolvent les deux problèmes.

## Comment Ça Marche sur Too Fresh To Waste ?

1. **Parcourez** les surprise bags disponibles près de chez vous
2. **Achetez** votre bag et recevez un code de retrait
3. **Récupérez** votre commande pendant la fenêtre de retrait
4. **Savourez** — tout en contribuant à la lutte contre le gaspillage

## Sources

- WWF, _Driven to Waste: The Global Food Loss and Waste Crisis_, 2021
- PNUE, _Rapport sur l'Indice de Gaspillage Alimentaire_, 2021
```

- [ ] **Step 5: Commit seed content**

```bash
git add content/
git commit -m "feat(blog): add content directory structure, seed author, and first EN+FR articles"
```

---

## Task 4: Blog hub page

**Files:** `apps/web/src/app/[locale]/(marketing)/blog/page.tsx`

- [ ] **Step 1: Create the blog hub page**

Create `apps/web/src/app/[locale]/(marketing)/blog/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getAllArticles } from '@/lib/blog';
import { getCanonicalUrl } from '@/config/seo.config';
import { BreadcrumbSchema } from '@/components/seo/schemas';
import { ArticleCard } from '@/components/blog/article-card';
import type { BlogLocale } from '@/types/blog';

interface BlogHubProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: BlogHubProps): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = getCanonicalUrl('/blog', locale as BlogLocale);
  return {
    title: 'Blog — Food Waste, Sustainability & Impact | Too Fresh To Waste',
    description:
      'Expert articles on food waste reduction, sustainable eating, charity impact, and ESG compliance across Tunisia, Morocco, Algeria, UAE and Saudi Arabia.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl('/blog', 'en'),
        fr: getCanonicalUrl('/blog', 'fr'),
        ar: getCanonicalUrl('/blog', 'ar'),
        'x-default': getCanonicalUrl('/blog', 'en'),
      },
    },
  };
}

export default async function BlogHubPage({ params }: BlogHubProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const articles = getAllArticles(locale as BlogLocale);
  const featured = articles.filter((a) => a.frontmatter.featured);
  const rest = articles.filter((a) => !a.frontmatter.featured);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as BlogLocale) },
          { name: 'Blog', url: getCanonicalUrl('/blog', locale as BlogLocale) },
        ]}
      />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Expert insights on food waste reduction, sustainable eating, and social impact across
            the MENA region.
          </p>
        </header>

        {featured.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-6 text-muted-foreground uppercase tracking-wide text-sm">
              Featured
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {featured.map((article) => (
                <ArticleCard key={article.slug} article={article} locale={locale as BlogLocale} />
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 text-muted-foreground uppercase tracking-wide text-sm">
              All Articles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} locale={locale as BlogLocale} />
              ))}
            </div>
          </section>
        )}

        {articles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <p className="text-4xl">📝</p>
            <h3 className="text-md font-semibold">Articles coming soon</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              We are preparing in-depth content on food waste, sustainability, and impact across the
              MENA region.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create `ArticleCard` component**

Create `apps/web/src/components/blog/article-card.tsx`:

```typescript
import { Link } from '@/i18n/routing';
import type { BlogArticle, BlogLocale } from '@/types/blog';

interface ArticleCardProps {
  article: BlogArticle;
  locale: BlogLocale;
}

export function ArticleCard({ article, locale }: ArticleCardProps) {
  const { frontmatter, slug, readingTime } = article;

  return (
    <article className="group border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all bg-card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full capitalize">
          {frontmatter.category.replace('-', ' ')}
        </span>
        <span className="text-xs text-muted-foreground">{readingTime}</span>
      </div>
      <Link href={`/blog/${slug}`} locale={locale}>
        <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
          {frontmatter.title}
        </h2>
      </Link>
      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{frontmatter.description}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{frontmatter.author}</span>
        <time dateTime={frontmatter.publishedAt}>
          {new Date(frontmatter.publishedAt).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/blog/page.tsx" apps/web/src/components/blog/
git commit -m "feat(blog): add blog hub page and ArticleCard component"
```

---

## Task 5: Individual article page

**Files:** `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`

- [ ] **Step 1: Create the article page**

Create `apps/web/src/app/[locale]/(marketing)/blog/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { setRequestLocale } from 'next-intl/server';
import { getArticle, getAllSlugs, getAuthor } from '@/lib/blog';
import { getCanonicalUrl } from '@/config/seo.config';
import { ArticleSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import type { BlogLocale } from '@/types/blog';

interface ArticlePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const slugs = getAllSlugs(locale as BlogLocale);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticle(locale as BlogLocale, slug);
  if (!article) return {};

  const { frontmatter } = article;
  const canonicalUrl = getCanonicalUrl(`/blog/${slug}`, locale as BlogLocale);

  const hreflangAlternates: Record<string, string> = {
    'x-default': getCanonicalUrl(`/blog/${slug}`, 'en'),
  };
  if (frontmatter.hreflang) {
    for (const [lang, hrefSlug] of Object.entries(frontmatter.hreflang)) {
      hreflangAlternates[lang] = getCanonicalUrl(`/blog/${hrefSlug}`, lang as BlogLocale);
    }
  }

  return {
    title: `${frontmatter.title} | Too Fresh To Waste`,
    description: frontmatter.description,
    authors: [{ name: frontmatter.author }],
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangAlternates,
    },
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      type: 'article',
      publishedTime: frontmatter.publishedAt,
      modifiedTime: frontmatter.updatedAt,
      authors: [frontmatter.author],
      ...(frontmatter.ogImage ? { images: [{ url: frontmatter.ogImage, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = getArticle(locale as BlogLocale, slug);
  if (!article) notFound();

  const { frontmatter, content, readingTime } = article;
  const author = getAuthor(locale as BlogLocale, frontmatter.author);
  const canonicalUrl = getCanonicalUrl(`/blog/${slug}`, locale as BlogLocale);

  return (
    <>
      <ArticleSchema
        title={frontmatter.title}
        description={frontmatter.description}
        publishedAt={frontmatter.publishedAt}
        updatedAt={frontmatter.updatedAt}
        url={canonicalUrl}
        authorName={author?.frontmatter.name ?? frontmatter.author}
        authorUrl={author?.frontmatter.linkedin}
        imageUrl={frontmatter.ogImage}
        locale={locale as BlogLocale}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as BlogLocale) },
          { name: 'Blog', url: getCanonicalUrl('/blog', locale as BlogLocale) },
          { name: frontmatter.title, url: canonicalUrl },
        ]}
      />
      <article
        className="max-w-3xl mx-auto px-4 py-12 sm:px-6"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <span className="text-primary bg-primary/10 px-2 py-1 rounded-full capitalize text-xs font-medium">
              {frontmatter.category.replace('-', ' ')}
            </span>
            <span>·</span>
            <span>{readingTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
            {frontmatter.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-6">{frontmatter.description}</p>
          <div className="flex items-center gap-3 pb-6 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">
                {author?.frontmatter.name ?? frontmatter.author}
              </p>
              {author && (
                <p className="text-xs text-muted-foreground">{author.frontmatter.title}</p>
              )}
            </div>
            <div className="ms-auto text-xs text-muted-foreground">
              <time dateTime={frontmatter.publishedAt}>
                Published{' '}
                {new Date(frontmatter.publishedAt).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              {frontmatter.updatedAt !== frontmatter.publishedAt && (
                <span className="ms-2">
                  · Updated{' '}
                  {new Date(frontmatter.updatedAt).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXRemote source={content} />
        </div>

        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {frontmatter.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </footer>
      </article>
    </>
  );
}
```

- [ ] **Step 2: Install Tailwind Typography plugin for article prose styles**

```bash
pnpm --filter @foodwaste/web add -D @tailwindcss/typography
```

Add to `apps/web/tailwind.config.ts` (or `.js`) in the `plugins` array:

```typescript
// In tailwind.config:
plugins: [
  require('@tailwindcss/typography'),
  // ...existing plugins
],
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/blog/[slug]/" apps/web/package.json pnpm-lock.yaml
git commit -m "feat(blog): add individual article page with MDX rendering, ArticleSchema, E-E-A-T"
```

---

## Task 6: Category archive page (with noindex threshold)

**Files:**
`apps/web/src/app/[locale]/(marketing)/blog/category/[category]/page.tsx`

- [ ] **Step 1: Create category archive page**

Create
`apps/web/src/app/[locale]/(marketing)/blog/category/[category]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getArticlesByCategory, getAllCategories } from '@/lib/blog';
import { getCanonicalUrl } from '@/config/seo.config';
import { ArticleCard } from '@/components/blog/article-card';
import { ARCHIVE_INDEX_THRESHOLDS } from '@/types/blog';
import type { BlogLocale } from '@/types/blog';

interface CategoryPageProps {
  params: Promise<{ locale: string; category: string }>;
}

export async function generateStaticParams({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const categories = getAllCategories(locale as BlogLocale);
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, category } = await params;
  const articles = getArticlesByCategory(locale as BlogLocale, category);
  const shouldIndex = articles.length >= ARCHIVE_INDEX_THRESHOLDS.category;
  const canonicalUrl = getCanonicalUrl(`/blog/category/${category}`, locale as BlogLocale);

  return {
    title: `${category.replace(/-/g, ' ')} Articles | Too Fresh To Waste Blog`,
    description: `All articles about ${category.replace(/-/g, ' ')} on Too Fresh To Waste.`,
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: shouldIndex
      ? {
          canonical: canonicalUrl,
          languages: {
            en: getCanonicalUrl(`/blog/category/${category}`, 'en'),
            fr: getCanonicalUrl(`/blog/category/${category}`, 'fr'),
            ar: getCanonicalUrl(`/blog/category/${category}`, 'ar'),
          },
        }
      : undefined,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, category } = await params;
  setRequestLocale(locale);

  const articles = getArticlesByCategory(locale as BlogLocale, category);
  const label = category.replace(/-/g, ' ');

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Category</p>
        <h1 className="text-3xl font-bold text-foreground capitalize">{label}</h1>
        <p className="text-muted-foreground mt-2">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
      </header>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-4xl">📂</p>
          <h3 className="text-md font-semibold">No articles yet in this category</h3>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} locale={locale as BlogLocale} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/blog/category/"
git commit -m "feat(blog): add category archive page with noindex threshold (< 8 articles)"
```

---

## Task 7: Author page (with noindex threshold)

**Files:** `apps/web/src/app/[locale]/(marketing)/blog/author/[author]/page.tsx`

- [ ] **Step 1: Create author page**

Create `apps/web/src/app/[locale]/(marketing)/blog/author/[author]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getAuthor, getArticlesByAuthor } from '@/lib/blog';
import { getCanonicalUrl } from '@/config/seo.config';
import { ArticleCard } from '@/components/blog/article-card';
import { ARCHIVE_INDEX_THRESHOLDS } from '@/types/blog';
import type { BlogLocale } from '@/types/blog';

interface AuthorPageProps {
  params: Promise<{ locale: string; author: string }>;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { locale, author: authorSlug } = await params;
  const author = getAuthor(locale as BlogLocale, authorSlug);
  if (!author) return { robots: { index: false, follow: false } };

  const hasEnoughArticles = author.articleCount >= ARCHIVE_INDEX_THRESHOLDS.author;
  const hasBio = Boolean(author.frontmatter.bio && author.frontmatter.title);
  const shouldIndex = hasEnoughArticles && hasBio;

  return {
    title: `${author.frontmatter.name} — ${author.frontmatter.title} | Too Fresh To Waste`,
    description: author.frontmatter.bio,
    robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: true },
    alternates: shouldIndex
      ? {
          canonical: getCanonicalUrl(`/blog/author/${authorSlug}`, locale as BlogLocale),
        }
      : undefined,
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { locale, author: authorSlug } = await params;
  setRequestLocale(locale);

  const author = getAuthor(locale as BlogLocale, authorSlug);
  if (!author) notFound();

  const articles = getArticlesByAuthor(locale as BlogLocale, authorSlug);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6">
      <header className="flex items-start gap-6 mb-12 pb-8 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{author.frontmatter.name}</h1>
          <p className="text-primary font-medium mt-1">{author.frontmatter.title}</p>
          <p className="text-muted-foreground mt-3 max-w-xl">{author.frontmatter.bio}</p>
          {author.frontmatter.linkedin && (
            <a
              href={author.frontmatter.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary mt-3 hover:underline"
              aria-label={`${author.frontmatter.name} on LinkedIn`}
            >
              LinkedIn profile
            </a>
          )}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-6">
          {articles.length} Article{articles.length !== 1 ? 's' : ''}
        </h2>
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No published articles yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} locale={locale as BlogLocale} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/blog/author/"
git commit -m "feat(blog): add author page with noindex threshold (< 3 articles or incomplete bio)"
```

---

## Task 8: Tag archive page (always noindex)

**Files:** `apps/web/src/app/[locale]/(marketing)/blog/tag/[tag]/page.tsx`

- [ ] **Step 1: Create tag page**

Create `apps/web/src/app/[locale]/(marketing)/blog/tag/[tag]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getArticlesByTag } from '@/lib/blog';
import { ArticleCard } from '@/components/blog/article-card';
import type { BlogLocale } from '@/types/blog';

interface TagPageProps {
  params: Promise<{ locale: string; tag: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  // Tags are internal navigation only — never indexed
  return {
    robots: { index: false, follow: false },
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { locale, tag } = await params;
  setRequestLocale(locale);

  const articles = getArticlesByTag(locale as BlogLocale, tag);

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Tag</p>
        <h1 className="text-3xl font-bold text-foreground">#{tag}</h1>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} locale={locale as BlogLocale} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/blog/tag/"
git commit -m "feat(blog): add tag archive page — always noindex (internal navigation only)"
```

---

## Task 9: Update sitemap to include blog articles

**Files:** `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Add blog article entries to sitemap**

In `apps/web/src/app/sitemap.ts`, add the following after the existing imports
and before the `export default function sitemap()`:

```typescript
import { getAllSlugs } from '@/lib/blog';
import type { BlogLocale } from '@/types/blog';

const BLOG_LOCALES: BlogLocale[] = ['en', 'fr', 'ar'];
```

Inside the `sitemap()` function, after the Tunisia cities section, add:

```typescript
// Blog articles (auto-discovered from /content/blog/)
BLOG_LOCALES.forEach(locale => {
  const slugs = getAllSlugs(locale);
  slugs.forEach(slug => {
    entries.push(
      buildEntry(`/blog/${slug}`, 'weekly', PRIORITY.blog, locale, now),
    );
  });
});
```

- [ ] **Step 2: Type-check + test**

```bash
pnpm --filter @foodwaste/web type-check
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/sitemap.ts
git commit -m "feat(seo): auto-add blog articles to sitemap from content directory"
```

---

## Verification

After all tasks complete:

1. `pnpm --filter @foodwaste/web build` — 0 build errors
2. `pnpm --filter @foodwaste/web type-check` — 0 type errors
3. `pnpm --filter @foodwaste/web test -- --no-coverage` — all tests pass
4. Start dev server: `pnpm --filter @foodwaste/web dev`
5. Visit `http://localhost:3001/en/blog` — hub shows both seed articles
6. Visit `http://localhost:3001/en/blog/what-is-a-surprise-bag` — article
   renders with correct metadata
7. View page source → confirm `<script type="application/ld+json">` with Article
   schema present
8. Visit `http://localhost:3001/en/blog/author/team` — author page shows
   (noindex since < 3 articles)
9. Visit `http://localhost:3001/en/sitemap.xml` — confirm blog slugs appear
