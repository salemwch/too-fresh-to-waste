import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface ArticleSchemaProps {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
  authorName: string;
  authorUrl?: string;
  imageUrl?: string;
  locale: Locale;
}

export function ArticleSchema({
  title,
  description,
  publishedAt,
  updatedAt,
  url,
  authorName,
  authorUrl,
  imageUrl,
  locale,
}: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: publishedAt,
    dateModified: updatedAt,
    url,
    inLanguage: locale,
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorUrl ? { url: authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${seoConfig.url}/#organization`,
      name: seoConfig.business.name,
      logo: {
        '@type': 'ImageObject',
        url: `${seoConfig.url}/images/logo.png`,
        width: 512,
        height: 512,
      },
    },
    ...(imageUrl
      ? { image: { '@type': 'ImageObject', url: imageUrl, width: 1200, height: 630 } }
      : {}),
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
