import { ImageResponse } from 'next/og';

/*
 * No `runtime = 'edge'` here any more.
 *
 * Next 16 disables static generation for any page on the edge runtime, so
 * keeping it turned this route from a build-time artifact into an on-demand
 * one - the single page behind the 275 -> 274 drop in generated pages. Next 16
 * also deprecates the edge runtime generally.
 *
 * `ImageResponse` from next/og runs on the Node runtime, so dropping the export
 * restores the Next 15 behaviour rather than changing it. The middleware is a
 * separate case and deliberately stays on edge: it verifies JWTs with `jose`.
 */
export const alt = 'Too Fresh To Waste';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OGImage({ params }: Props) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  const titles: Record<string, string> = {
    en: 'Reduce Food Waste. Save Money.',
    fr: 'Réduisez le gaspillage. Économisez.',
    ar: 'قلّل هدر الطعام. وفّر المال.',
  };

  const subtitles: Record<string, string> = {
    en: 'Save up to 90% on surplus food from local restaurants',
    fr: "Économisez jusqu'à 90% sur la nourriture en surplus",
    ar: 'وفّر حتى 90% على الطعام الفائض من المطاعم المحلية',
  };

  const title = titles[locale] ?? titles['en'];
  const subtitle = subtitles[locale] ?? subtitles['en'];

  // Load Arabic font only when needed — satori has no Arabic font by default
  // NonNullable: Next 15.5 made ImageResponse's options parameter optional, so
  // the tuple element is `Options | undefined` and cannot be indexed directly.
  const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'] = [];
  if (isRtl) {
    const fontData = await fetch(new URL('./noto-sans-arabic-700.ttf', import.meta.url)).then(r =>
      r.arrayBuffer(),
    );
    fonts.push({ name: 'NotoSansArabic', data: fontData, style: 'normal', weight: 700 });
  }

  const fontFamily = isRtl ? 'NotoSansArabic' : 'sans-serif';
  const direction = isRtl ? 'rtl' : 'ltr';
  const alignItems = isRtl ? 'flex-end' : 'flex-start';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems,
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E4448 0%, #2d6a70 100%)',
        padding: '60px 80px',
        direction,
        fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 32,
          flexDirection: isRtl ? 'row-reverse' : 'row',
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
            ...(isRtl ? { marginLeft: 16 } : { marginRight: 16 }),
          }}
        />
        <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, fontFamily }}>
          Too Fresh To Waste
        </span>
      </div>
      <div
        style={{
          color: '#ffffff',
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 20,
          maxWidth: 800,
          fontFamily,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 26,
          maxWidth: 700,
          fontFamily,
          textAlign: isRtl ? 'right' : 'left',
        }}
      >
        {subtitle}
      </div>
    </div>,
    { ...size, fonts },
  );
}
