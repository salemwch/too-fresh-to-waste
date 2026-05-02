interface WebPageSchemaProps {
  type?: 'WebPage' | 'AboutPage' | 'ContactPage';
  name: string;
  description: string;
  url: string;
}

export function WebPageSchema({ type = 'WebPage', name, description, url }: WebPageSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
