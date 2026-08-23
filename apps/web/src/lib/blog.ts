import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { locales, defaultLocale } from '@/i18n/config';

import type { Locale } from '@/i18n/config';

// Locale-aware MDX blog.
//
// Posts live in src/content/blog/<locale>/<slug>.mdx. Slugs are deliberately
// per-locale — a French post should sit at /fr/blog/que-faire-invendus-boulangerie,
// not at the English slug, because keywords in the URL are read by both Google
// and the human deciding whether to click a French result.
//
// Translations of the same article are linked by a shared `translationKey` in
// frontmatter rather than by slug. That key is what lets the page emit correct
// hreflang alternates across differing URLs, and it is why the sitemap can
// advertise a locale only when a translation actually exists for it.

const POSTS_ROOT = path.join(process.cwd(), 'src/content/blog');

export interface PostMeta {
  /** URL slug within this locale. */
  slug: string;
  locale: Locale;
  /** Shared across every translation of the same article. */
  translationKey: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  coverImage?: string;
  readTime: number;
}

export interface Post extends PostMeta {
  content: string;
}

function localeDir(locale: Locale): string {
  return path.join(POSTS_ROOT, locale);
}

function readPostFile(locale: Locale, file: string): Post | null {
  const filePath = path.join(localeDir(locale), file);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const slug = file.replace(/\.mdx$/, '');

  // translationKey is required: without it a post cannot be paired with its
  // translations, and emitting hreflang that points at the wrong article is
  // worse than emitting none. Falling back to the slug keeps a post that omits
  // it renderable and simply unpaired, rather than crashing the build.
  const translationKey = typeof data['translationKey'] === 'string' ? data['translationKey'] : slug;

  return {
    ...(data as Omit<PostMeta, 'slug' | 'locale' | 'translationKey'>),
    slug,
    locale,
    translationKey,
    content,
  };
}

function listFiles(locale: Locale): string[] {
  const dir = localeDir(locale);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));
}

/** All posts written in `locale`, newest first. Never falls back to another language. */
export function getAllPosts(locale: Locale = defaultLocale): PostMeta[] {
  return listFiles(locale)
    .map(file => readPostFile(locale, file))
    .filter((p): p is Post => p !== null)
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * A slug arriving from `params` is percent-encoded when it contains anything
 * outside ASCII; the filename on disk is not. Arabic slugs therefore looked up
 * `%D9%85%D8%A7-....mdx`, found nothing, and the article rendered as a 37-byte
 * shell - `generateMetadata` returned `{}`, so the post inherited the root
 * layout's canonical and every Arabic article declared itself to be `/ar`.
 *
 * Nothing failed loudly. The build reported six more prerendered pages and the
 * blog index linked to all of them.
 */
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    // A malformed escape sequence is not a slug we have a file for anyway.
    return slug;
  }
}

export function getPostBySlug(slug: string, locale: Locale = defaultLocale): Post | null {
  return readPostFile(locale, `${decodeSlug(slug)}.mdx`);
}

/** Slugs available in `locale` — drives generateStaticParams. */
export function getAllSlugs(locale: Locale = defaultLocale): string[] {
  return listFiles(locale).map(f => f.replace(/\.mdx$/, ''));
}

/** Every (locale, slug) pair that has a real post, for prerendering. */
export function getAllPostParams(): Array<{ locale: Locale; slug: string }> {
  return locales.flatMap(locale => getAllSlugs(locale).map(slug => ({ locale, slug })));
}

/**
 * Maps locale → slug for every translation of one article.
 *
 * Only locales with a real translation appear. Callers use this for hreflang,
 * so a locale that is merely *planned* must not be listed: claiming a French
 * version that does not exist is exactly the mismatch this refactor removes.
 */
export function getTranslationSlugs(translationKey: string): Partial<Record<Locale, string>> {
  const map: Partial<Record<Locale, string>> = {};

  locales.forEach(locale => {
    const match = listFiles(locale)
      .map(file => readPostFile(locale, file))
      .find(p => p?.translationKey === translationKey);
    if (match) map[locale] = match.slug;
  });

  return map;
}

const DATE_LOCALES: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-TN',
  ar: 'ar-TN',
};

export function formatDate(dateStr: string, locale: Locale = defaultLocale): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;

  return parsed.toLocaleDateString(DATE_LOCALES[locale] ?? DATE_LOCALES.en, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
