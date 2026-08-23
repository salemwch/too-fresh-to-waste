import sitemap from '@/app/sitemap';
import { seoConfig } from '@/config/seo.config';
import { locales } from '@/i18n/config';
import { citySlugs } from '@/content/locations';
import {
  getAllPosts,
  getAllSlugs,
  getPostBySlug,
  getAllPostParams,
  getTranslationSlugs,
} from '@/lib/blog';

import type { Locale } from '@/i18n/config';

// Regression guard for the defect these were written against: the blog had no
// locale support at all, so /fr/blog/<slug> served English text while the page
// and sitemap both claimed hreflang="fr-TN". Every page also emitted the same
// locale-less canonical, collapsing three languages into one indexable URL.

describe('posts are isolated per locale', () => {
  it('never returns a post from another locale', () => {
    locales.forEach(locale => {
      getAllPosts(locale).forEach(post => {
        expect(post.locale).toBe(locale);
      });
    });
  });

  it('has English posts', () => {
    expect(getAllPosts('en').length).toBeGreaterThan(0);
  });

  it('has French posts — the whole point of the refactor', () => {
    expect(getAllPosts('fr').length).toBeGreaterThan(0);
  });

  it('does not serve an English post under a French slug', () => {
    getAllSlugs('en').forEach(slug => {
      const asFrench = getPostBySlug(slug, 'fr');
      // Either no French post at that slug, or a genuinely French one — never
      // the English file resolved through a fallback.
      if (asFrench) expect(asFrench.locale).toBe('fr');
    });
  });

  it('returns null for a slug that does not exist in the requested locale', () => {
    expect(getPostBySlug('definitely-not-a-real-post', 'fr')).toBeNull();
  });

  it('every post declares a translationKey', () => {
    locales.forEach(locale => {
      getAllPosts(locale).forEach(post => {
        expect(typeof post.translationKey).toBe('string');
        expect(post.translationKey.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('translation pairing drives hreflang', () => {
  it('pairs a translated post across locales', () => {
    // 'real-cost-tunisia' exists in both en and fr with different slugs.
    const map = getTranslationSlugs('real-cost-tunisia');
    expect(map.en).toBe('real-cost-food-waste-tunisia');
    expect(map.fr).toBe('cout-reel-gaspillage-alimentaire-tunisie');
  });

  it('uses locale-specific slugs, not the English one', () => {
    const map = getTranslationSlugs('real-cost-tunisia');
    expect(map.fr).not.toBe(map.en);
  });

  it('omits locales that have no translation', () => {
    // A French-only post must not claim an English or Arabic version.
    const map = getTranslationSlugs('bakery-surplus-options');
    expect(map.fr).toBe('que-faire-invendus-boulangerie');
    expect(map.en).toBeUndefined();
    expect(map.ar).toBeUndefined();
  });

  it('returns an empty map for an unknown key rather than throwing', () => {
    expect(getTranslationSlugs('no-such-article')).toEqual({});
  });

  it('every translationKey resolves back to the post that declared it', () => {
    locales.forEach(locale => {
      getAllPosts(locale).forEach(post => {
        expect(getTranslationSlugs(post.translationKey)[locale]).toBe(post.slug);
      });
    });
  });
});

describe('prerendering', () => {
  it('generates params only for locale/slug pairs that have a file', () => {
    const params = getAllPostParams();
    const expected = locales.reduce((n, l) => n + getAllSlugs(l).length, 0);
    expect(params).toHaveLength(expected);

    params.forEach(({ locale, slug }) => {
      expect(getPostBySlug(slug, locale)).not.toBeNull();
    });
  });

  it('does not generate a French param for an untranslated English post', () => {
    const params = getAllPostParams();
    const untranslated = getAllSlugs('en').filter(s => !getAllSlugs('fr').includes(s));
    untranslated.forEach(slug => {
      expect(params).not.toContainEqual({ locale: 'fr', slug });
    });
  });
});

describe('translation coverage', () => {
  it('every English post has a French translation', () => {
    // French is the primary commercial language for Tunisian search volume, so
    // an English-only article is a gap, not a choice. This fails when a new
    // English post lands without its French counterpart.
    const missing = getAllPosts('en')
      .filter(post => getTranslationSlugs(post.translationKey).fr === undefined)
      .map(post => post.slug);

    expect(missing).toEqual([]);
  });

  it('French slugs are distinct from their English counterparts', () => {
    // A French post sitting at the English slug wastes the keyword in the URL.
    getAllPosts('fr').forEach(post => {
      const map = getTranslationSlugs(post.translationKey);
      if (map.en) expect(map.fr).not.toBe(map.en);
    });
  });
});

describe('internal links inside posts resolve', () => {
  // The lookbehind sits before the opening bracket, because in an image embed
  // `![alt](/images/x.webp)` the `!` precedes `[`, not `]`. Images are asset
  // paths, not routes, and asserting them against the router would fail for the
  // wrong reason.
  const INTERNAL_LINK = /(?<!!)\[[^\]]*\]\((\/[^)\s]*)\)/g;

  const linksIn = (locale: Locale) =>
    getAllSlugs(locale).flatMap(slug => {
      const post = getPostBySlug(slug, locale);
      const content = post?.content ?? '';
      return [...content.matchAll(INTERNAL_LINK)].map(m => ({
        from: slug,
        href: m[1] as string,
      }));
    });

  it('every /blog/ link points at a post that exists in the same locale', () => {
    locales.forEach(locale => {
      linksIn(locale)
        .filter(l => l.href.startsWith('/blog/'))
        .forEach(({ from, href }) => {
          const target = href.replace('/blog/', '');
          expect({ from, href, exists: getPostBySlug(target, locale) !== null }).toEqual({
            from,
            href,
            exists: true,
          });
        });
    });
  });

  it('every /locations/ link points at a real city', () => {
    locales.forEach(locale => {
      linksIn(locale)
        .filter(l => l.href.startsWith('/locations/'))
        .forEach(({ from, href }) => {
          const slug = href.replace('/locations/', '');
          expect({ from, href, exists: citySlugs.includes(slug) }).toEqual({
            from,
            href,
            exists: true,
          });
        });
    });
  });

  it('other internal links point at routes that exist', () => {
    const KNOWN_ROUTES = ['/merchant-signup', '/partners', '/blog', '/contact', '/companies'];
    locales.forEach(locale => {
      linksIn(locale)
        .filter(l => !l.href.startsWith('/blog/') && !l.href.startsWith('/locations/'))
        .forEach(({ from, href }) => {
          expect({ from, href, known: KNOWN_ROUTES.includes(href) }).toEqual({
            from,
            href,
            known: true,
          });
        });
    });
  });
});

describe('sitemap blog entries', () => {
  const blogEntries = () => sitemap().filter(e => /\/(en|fr|ar)\/blog\/[^/]+$/.test(e.url));

  it('advertises a blog URL only where the post actually exists', () => {
    blogEntries().forEach(entry => {
      const m = entry.url.match(/\/(en|fr|ar)\/blog\/([^/]+)$/);
      expect(m).not.toBeNull();
      const [, locale, slug] = m as RegExpMatchArray;
      expect(getPostBySlug(slug as string, locale as Locale)).not.toBeNull();
    });
  });

  it('emits one entry per real (locale, post) pair — no phantom translations', () => {
    const expected = locales.reduce((n, l) => n + getAllPosts(l).length, 0);
    expect(blogEntries()).toHaveLength(expected);
  });

  it('hreflang alternates point at each locale’s own slug', () => {
    const fr = blogEntries().find(e =>
      e.url.endsWith('/fr/blog/cout-reel-gaspillage-alimentaire-tunisie'),
    );
    expect(fr).toBeDefined();

    const languages = fr?.alternates?.languages ?? {};
    expect(languages['fr-TN']).toBe(
      `${seoConfig.url}/fr/blog/cout-reel-gaspillage-alimentaire-tunisie`,
    );
    expect(languages['en']).toBe(`${seoConfig.url}/en/blog/real-cost-food-waste-tunisia`);
    expect(languages['x-default']).toBe(`${seoConfig.url}/en/blog/real-cost-food-waste-tunisia`);
  });

  it('a French-only post claims no English alternate', () => {
    const entry = blogEntries().find(e =>
      e.url.endsWith('/fr/blog/que-faire-invendus-boulangerie'),
    );
    expect(entry).toBeDefined();

    const languages = entry?.alternates?.languages ?? {};
    expect(languages['fr-TN']).toBe(`${seoConfig.url}/fr/blog/que-faire-invendus-boulangerie`);
    expect(languages['en']).toBeUndefined();
    expect(languages['x-default']).toBeUndefined();
  });

  it('every blog URL in the sitemap is locale-prefixed', () => {
    sitemap()
      .filter(e => e.url.includes('/blog'))
      .forEach(e => {
        expect(e.url).toMatch(new RegExp(`^${seoConfig.url}/(en|fr|ar)/blog`));
      });
  });
});
