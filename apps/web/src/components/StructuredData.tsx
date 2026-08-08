/**
 * Article JSON-LD for blog posts.
 *
 * Organization, WebSite and MobileApplication schemas are NOT here — they live
 * in components/seo/schemas/ and are already rendered by the marketing pages.
 * This file previously carried a second implementation of all three under the
 * same `@id` values (#organization, #website), which would have emitted two
 * conflicting nodes per page had anything mounted them. Nothing did.
 */
import { seoConfig } from '@/config/seo.config';

interface ArticleStructuredDataProps {
  title: string;
  description: string;
  date: string;
  url: string;
  coverImage?: string;
}

export function ArticleStructuredData({
  title,
  description,
  date,
  url,
  coverImage,
}: ArticleStructuredDataProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date,
    dateModified: date,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: {
      '@type': 'Organization',
      name: seoConfig.business.name,
      url: seoConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: seoConfig.business.name,
      logo: {
        '@type': 'ImageObject',
        url: `${seoConfig.url}/images/green-leaf-logo.png`,
      },
    },
    ...(coverImage && {
      image: {
        '@type': 'ImageObject',
        url: coverImage.startsWith('http') ? coverImage : `${seoConfig.url}${coverImage}`,
      },
    }),
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
