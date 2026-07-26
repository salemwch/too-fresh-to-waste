import { getCanonicalUrl, getSchemaOrgUrl, seoConfig } from '@/config/seo.config';
import { render } from '@testing-library/react';
import { OrganizationSchema } from '@/components/seo/schemas/organization-schema';
import { WebSiteSchema } from '@/components/seo/schemas/website-schema';
import { ArticleSchema } from '@/components/seo/schemas/article-schema';
import { FAQSchema } from '@/components/seo/schemas/faq-schema';
import { BreadcrumbSchema } from '@/components/seo/schemas/breadcrumb-schema';
import { SoftwareAppSchema } from '@/components/seo/schemas/software-app-schema';
import { WebPageSchema } from '@/components/seo/schemas/webpage-schema';
import { EventSchema } from '@/components/seo/schemas/event-schema';
import { DonateActionSchema } from '@/components/seo/schemas/donate-action-schema';
import sitemap from '@/app/sitemap';

describe('getCanonicalUrl', () => {
  it('includes locale prefix for default locale (en)', () => {
    expect(getCanonicalUrl('/', 'en')).toBe(`${seoConfig.url}/en`);
  });

  it('includes locale prefix for fr', () => {
    expect(getCanonicalUrl('/blog', 'fr')).toBe(`${seoConfig.url}/fr/blog`);
  });

  it('includes locale prefix for ar', () => {
    expect(getCanonicalUrl('/contact', 'ar')).toBe(`${seoConfig.url}/ar/contact`);
  });

  it('handles root path without trailing slash', () => {
    expect(getCanonicalUrl('/', 'fr')).toBe(`${seoConfig.url}/fr`);
  });
});

describe('getSchemaOrgUrl', () => {
  it('always uses en locale for schema.org @id fields', () => {
    expect(getSchemaOrgUrl('/about')).toBe(`${seoConfig.url}/en/about`);
  });

  it('handles root path', () => {
    expect(getSchemaOrgUrl('/')).toBe(`${seoConfig.url}/en`);
  });
});

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
    expect(data.url).toContain(seoConfig.url);
  });
});

describe('WebSiteSchema', () => {
  it('renders WebSite with name and url', () => {
    const { container } = render(<WebSiteSchema />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('WebSite');
    expect(data.name).toBe('Too Fresh To Waste');
    expect(data.url).toContain(seoConfig.url);
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
        url={`${seoConfig.url}/en/blog/test`}
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
      { name: 'Home', url: `${seoConfig.url}/en` },
      { name: 'Blog', url: `${seoConfig.url}/en/blog` },
    ];
    const { container } = render(<BreadcrumbSchema items={items} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
  });
});

describe('SoftwareAppSchema', () => {
  it('renders SoftwareApplication with offers', () => {
    const { container } = render(
      <SoftwareAppSchema name='Too Fresh To Waste' description='Save food.' locale='en' />,
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.offers?.['@type']).toBe('Offer');
  });
});

describe('WebPageSchema', () => {
  it('renders WebPage with default type', () => {
    const { container } = render(
      <WebPageSchema
        name='Contact'
        description='Get in touch.'
        url={`${seoConfig.url}/en/contact`}
      />,
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('WebPage');
    expect(data.url).toContain('contact');
  });

  it('renders ContactPage type when specified', () => {
    const { container } = render(
      <WebPageSchema
        type='ContactPage'
        name='Contact'
        description='Get in touch.'
        url={`${seoConfig.url}/en/contact`}
      />,
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('ContactPage');
  });
});

describe('EventSchema', () => {
  it('renders Event with physical location', () => {
    const { container } = render(
      <EventSchema
        name='Food Waste Hackathon'
        description='Join us to fight food waste.'
        startDate='2026-06-01'
        url={`${seoConfig.url}/en/events/hackathon`}
        location='Tunis, Tunisia'
      />,
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Event');
    expect(data.location?.['@type']).toBe('Place');
  });

  it('renders Event with virtual location when no location provided', () => {
    const { container } = render(
      <EventSchema
        name='Virtual Workshop'
        description='Online event.'
        startDate='2026-06-15'
        url={`${seoConfig.url}/en/events/workshop`}
      />,
    );
    const data = getJsonLd(container);
    expect(data.location?.['@type']).toBe('VirtualLocation');
    expect(data.eventAttendanceMode).toContain('OnlineEventAttendanceMode');
  });
});

describe('DonateActionSchema', () => {
  it('renders DonateAction with default description', () => {
    const { container } = render(<DonateActionSchema />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('DonateAction');
    expect(data.description).toContain('5%');
  });

  it('renders DonateAction with custom description', () => {
    const { container } = render(<DonateActionSchema description='Custom donation message.' />);
    const data = getJsonLd(container);
    expect(data.description).toBe('Custom donation message.');
  });
});

describe('FAQSchema empty guard', () => {
  it('returns null for empty items', () => {
    const { container } = render(<FAQSchema items={[]} />);
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('BreadcrumbSchema empty guard', () => {
  it('returns null for empty items', () => {
    const { container } = render(<BreadcrumbSchema items={[]} />);
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('sitemap', () => {
  it('includes locale prefix for default locale (en)', () => {
    const entries = sitemap();
    const homepageEn = entries.find(e => e.url === `${seoConfig.url}/en`);
    expect(homepageEn).toBeTruthy();
  });

  it('includes all three locales for each page', () => {
    const entries = sitemap();
    const homepages = entries.filter(
      e =>
        e.url === `${seoConfig.url}/en` ||
        e.url === `${seoConfig.url}/fr` ||
        e.url === `${seoConfig.url}/ar`,
    );
    expect(homepages.length).toBe(3);
  });
});
