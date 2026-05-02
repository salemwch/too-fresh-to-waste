import { getCanonicalUrl, getSchemaOrgUrl } from '@/config/seo.config';

describe('getCanonicalUrl', () => {
  it('includes locale prefix for default locale (en)', () => {
    expect(getCanonicalUrl('/', 'en')).toBe('https://toofreshwaste.tn/en');
  });

  it('includes locale prefix for fr', () => {
    expect(getCanonicalUrl('/blog', 'fr')).toBe('https://toofreshwaste.tn/fr/blog');
  });

  it('includes locale prefix for ar', () => {
    expect(getCanonicalUrl('/contact', 'ar')).toBe('https://toofreshwaste.tn/ar/contact');
  });

  it('handles root path without trailing slash', () => {
    expect(getCanonicalUrl('/', 'fr')).toBe('https://toofreshwaste.tn/fr');
  });
});

describe('getSchemaOrgUrl', () => {
  it('always uses en locale for schema.org @id fields', () => {
    expect(getSchemaOrgUrl('/about')).toBe('https://toofreshwaste.tn/en/about');
  });

  it('handles root path', () => {
    expect(getSchemaOrgUrl('/')).toBe('https://toofreshwaste.tn/en');
  });
});
