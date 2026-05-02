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

import { render } from '@testing-library/react';
import { OrganizationSchema } from '@/components/seo/schemas/organization-schema';
import { WebSiteSchema } from '@/components/seo/schemas/website-schema';
import { ArticleSchema } from '@/components/seo/schemas/article-schema';
import { FAQSchema } from '@/components/seo/schemas/faq-schema';
import { BreadcrumbSchema } from '@/components/seo/schemas/breadcrumb-schema';

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).toBeTruthy();
  return JSON.parse(script!.textContent!);
}

describe('OrganizationSchema', () => {
  it('renders Organization type with required fields', () => {
    const { container } = render(<OrganizationSchema locale='en' />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Organization');
    expect(data.name).toBe('Too Fresh To Waste Tunisia');
    expect(data.url).toContain('toofreshwaste.tn');
  });
});

describe('WebSiteSchema', () => {
  it('renders WebSite with SearchAction', () => {
    const { container } = render(<WebSiteSchema />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('WebSite');
    expect(data.potentialAction?.['@type']).toBe('SearchAction');
  });
});

describe('ArticleSchema', () => {
  it('renders Article with author', () => {
    const { container } = render(
      <ArticleSchema
        title='Test Article'
        description='A test description'
        publishedAt='2026-05-01'
        updatedAt='2026-05-01'
        url='https://toofreshwaste.tn/en/blog/test'
        authorName='John Doe'
        locale='en'
      />,
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Article');
    expect(data.author?.name).toBe('John Doe');
  });
});

describe('FAQSchema', () => {
  it('renders FAQPage with questions', () => {
    const faqs = [{ question: 'What is a surprise bag?', answer: 'A bag of surplus food.' }];
    const { container } = render(<FAQSchema items={faqs} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(1);
    expect(data.mainEntity[0]['@type']).toBe('Question');
  });
});

describe('BreadcrumbSchema', () => {
  it('renders BreadcrumbList', () => {
    const items = [
      { name: 'Home', url: 'https://toofreshwaste.tn/en' },
      { name: 'Blog', url: 'https://toofreshwaste.tn/en/blog' },
    ];
    const { container } = render(<BreadcrumbSchema items={items} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
  });
});
