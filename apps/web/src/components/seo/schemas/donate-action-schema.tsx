import { seoConfig } from '@/config/seo.config';

interface DonateActionSchemaProps {
  description?: string;
}

export function DonateActionSchema({
  description = '5% of every order value is automatically donated to active community charity goals.',
}: DonateActionSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DonateAction',
    agent: { '@type': 'Organization', '@id': `${seoConfig.url}/#organization` },
    description,
    recipient: { '@type': 'Organization', name: 'Too Fresh To Waste Community Fund' },
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
