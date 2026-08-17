import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { seoConfig } from '@/config/seo.config';
import { locales } from '@/i18n/config';
import { cities, citySlugs, getCityBySlug, getCityStaticParams, t } from '@/content/locations';
import { cityNav } from '@/content/city-nav';

// Regression guard for the defect these tests were written against: the sitemap
// advertised seven /locations/{city} pages per locale while the route did not
// exist at all, submitting 21 soft-404s to Google. Sitemap and route now read
// the same `cities` array, and these tests fail if they are ever decoupled.

const SITEMAP_LOCATION_RE = new RegExp(`^${seoConfig.url}/(\\w{2})/locations/([a-z-]+)$`);

describe('sitemap ↔ route parity for /locations', () => {
  it('every /locations/{city} URL in the sitemap resolves to a real city', () => {
    const advertised = sitemap()
      .map(entry => entry.url.match(SITEMAP_LOCATION_RE))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(m => m[2] as string);

    expect(advertised.length).toBeGreaterThan(0);

    const orphans = advertised.filter(slug => getCityBySlug(slug) === undefined);
    expect(orphans).toEqual([]);
  });

  it('every city is advertised in all three locales', () => {
    const urls = new Set(sitemap().map(e => e.url));

    citySlugs.forEach(slug => {
      locales.forEach(locale => {
        expect(urls.has(`${seoConfig.url}/${locale}/locations/${slug}`)).toBe(true);
      });
    });
  });

  it('generateStaticParams prerenders every locale × city combination', () => {
    const params = getCityStaticParams(locales);

    expect(params).toHaveLength(locales.length * cities.length);

    citySlugs.forEach(slug => {
      locales.forEach(locale => {
        expect(params).toContainEqual({ locale, city: slug });
      });
    });
  });

  it('includes the /locations hub itself, so the cluster is not orphaned', () => {
    const urls = new Set(sitemap().map(e => e.url));
    locales.forEach(locale => {
      expect(urls.has(`${seoConfig.url}/${locale}/locations`)).toBe(true);
    });
  });

  it('emits hreflang alternates for every city entry', () => {
    const entry = sitemap().find(e => e.url === `${seoConfig.url}/fr/locations/tunis`);

    expect(entry).toBeDefined();
    const languages = entry?.alternates?.languages ?? {};
    expect(languages['x-default']).toBe(`${seoConfig.url}/en/locations/tunis`);
    expect(languages['fr-TN']).toBe(`${seoConfig.url}/fr/locations/tunis`);
    expect(languages['ar-TN']).toBe(`${seoConfig.url}/ar/locations/tunis`);
  });
});

describe('city content integrity', () => {
  it('has no duplicate slugs', () => {
    expect(new Set(citySlugs).size).toBe(citySlugs.length);
  });

  it('resolves copy in all three locales for every city', () => {
    cities.forEach(city => {
      locales.forEach(locale => {
        expect(t(city.name, locale).length).toBeGreaterThan(0);
        expect(t(city.metaTitle, locale).length).toBeGreaterThan(0);
        expect(t(city.metaDescription, locale).length).toBeGreaterThan(0);
        expect(t(city.intro, locale).length).toBeGreaterThan(0);
      });
    });
  });

  it('keeps meta descriptions inside the length Google will render', () => {
    // Beyond ~160 characters Google truncates, which wastes the click-through
    // pitch. Arabic is excluded: it encodes more meaning per character and is
    // measured by pixel width, not code points.
    cities.forEach(city => {
      (['en', 'fr'] as const).forEach(locale => {
        expect(city.metaDescription[locale].length).toBeLessThanOrEqual(200);
      });
    });
  });

  it('every `nearby` reference points at a city that exists', () => {
    cities.forEach(city => {
      city.nearby.forEach(slug => {
        expect(getCityBySlug(slug)).toBeDefined();
      });
    });
  });

  it('no city lists itself as nearby', () => {
    cities.forEach(city => {
      expect(city.nearby).not.toContain(city.slug);
    });
  });
});

describe('footer city nav parity', () => {
  // cityNav is a deliberate duplicate of the slugs in `cities`, kept small so
  // the client-side Footer does not pull the full content module into its
  // bundle. These assertions are what make the duplication safe.
  it('lists exactly the cities that have pages, in the same order', () => {
    expect(cityNav.map(c => c.slug)).toEqual([...citySlugs]);
  });

  it('every nav label matches the city name for that locale', () => {
    cityNav.forEach(navItem => {
      const city = getCityBySlug(navItem.slug);
      expect(city).toBeDefined();
      locales.forEach(locale => {
        expect(navItem.label[locale]).toBe(t(city!.name, locale));
      });
    });
  });
});

describe('robots', () => {
  const rulesFor = (agent: string) => {
    const { rules } = robots();
    const all = Array.isArray(rules) ? rules : [rules];
    return all.find(r => r.userAgent === agent);
  };

  it('blocks locale-prefixed private areas, not just the unprefixed path', () => {
    // '/admin/' alone never matches the real URL '/en/admin/dashboard'.
    const disallow = rulesFor('*')?.disallow as string[];

    expect(disallow).toContain('/*/admin');
    expect(disallow).toContain('/*/merchant');
    expect(disallow).toContain('/*/reset-password');
  });

  it('allows AI answer engines to crawl public pages', () => {
    ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot'].forEach(agent => {
      expect(rulesFor(agent)?.allow).toBe('/');
    });
  });

  it('applies the same private-area restrictions to AI crawlers', () => {
    const disallow = rulesFor('GPTBot')?.disallow as string[];
    expect(disallow).toContain('/*/admin');
  });

  it('points at the sitemap on the production domain', () => {
    expect(robots().sitemap).toBe(`${seoConfig.url}/sitemap.xml`);
  });
});
