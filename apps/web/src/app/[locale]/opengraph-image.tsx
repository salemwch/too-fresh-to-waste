import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Too Fresh To Waste';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OGImage({ params }: Props) {
  const { locale } = await params;

  // satori (ImageResponse renderer) has no Arabic font bundled — fall back to
  // English text for the ar locale to avoid an empty/broken image response.
  // Arabic page metadata (title, description) remains in Arabic in <head>.
  const displayLocale = locale === 'ar' ? 'en' : locale;

  const titles: Record<string, string> = {
    en: 'Reduce Food Waste. Save Money.',
    fr: 'Réduisez le gaspillage. Économisez.',
  };

  const subtitles: Record<string, string> = {
    en: 'Save up to 90% on surplus food from local restaurants',
    fr: "Économisez jusqu'à 90% sur la nourriture en surplus",
  };

  const title = titles[displayLocale] ?? titles['en'];
  const subtitle = subtitles[displayLocale] ?? subtitles['en'];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E4448 0%, #2d6a70 100%)',
        padding: '60px 80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#F55449',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
          }}
        />
        <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 600 }}>Too Fresh To Waste</span>
      </div>
      <div
        style={{
          color: '#ffffff',
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 20,
          maxWidth: 800,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 26,
          maxWidth: 700,
        }}
      >
        {subtitle}
      </div>
    </div>,
    { ...size },
  );
}
