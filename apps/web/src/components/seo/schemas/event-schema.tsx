interface EventSchemaProps {
  name: string;
  description: string;
  startDate: string;
  url: string;
  location?: string;
}

export function EventSchema({ name, description, startDate, url, location }: EventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    startDate,
    url,
    ...(location
      ? { location: { '@type': 'Place', name: location } }
      : {
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: { '@type': 'VirtualLocation', url },
        }),
  };

  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
