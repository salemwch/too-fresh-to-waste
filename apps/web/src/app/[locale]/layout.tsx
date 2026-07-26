import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Noto_Sans_Arabic, Playfair_Display } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { locales, type Locale, getLocaleConfig } from '@/i18n/config';
import { seoConfig, getLocaleSeoMetadata, getCanonicalUrl } from '@/config/seo.config';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { AppProviders } from '@/components/providers/app-providers';
import { ChunkErrorBoundary } from '@/components/providers/chunk-error-boundary';
import { CookieConsentWrapper } from '@/components/CookieConsentWrapper';
import '../globals.css';

// Latin font (Inter) for French and English
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: true,
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'sans-serif',
  ],
});

// Arabic font (Noto Sans Arabic) for Arabic locale
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-noto-arabic',
  adjustFontFallback: true,
  // preload: false — Arabic is only needed on the ar locale; preloading it on
  // every page (en/fr) causes "preloaded resource not used" console warnings.
  preload: false,
  weight: ['400', '500', '600', '700'],
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

// Display serif for the food-waste-facts editorial page
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  weight: ['300', '400', '500', '700', '900'],
  preload: false,
  adjustFontFallback: false,
});

// Serif font for merchant-signup / auth screens (self-hosted via next/font/google
// to avoid the external fonts.googleapis.com @import in merchant-signup.css)
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
  preload: false,
});

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

// Viewport configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#1E4448',
  interactiveWidget: 'resizes-content',
};

// Generate metadata based on locale
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const localeMetadata = getLocaleSeoMetadata(locale as Locale);

  // Generate alternate language URLs
  const alternateLanguages: Record<string, string> = {};
  locales.forEach(loc => {
    const hreflang = getLocaleConfig(loc).hreflang;
    alternateLanguages[hreflang] = getCanonicalUrl('/', loc);
  });
  alternateLanguages['x-default'] = getCanonicalUrl('/', 'en');

  return {
    metadataBase: new URL(seoConfig.url),

    // Basic metadata
    title: {
      default: localeMetadata.title,
      template: localeMetadata.titleTemplate,
    },
    description: localeMetadata.description,
    keywords: localeMetadata.keywords,
    authors: [{ name: seoConfig.siteName, url: seoConfig.url }],
    creator: seoConfig.siteName,
    publisher: seoConfig.siteName,

    // Alternate languages for SEO (hreflang)
    alternates: {
      canonical: getCanonicalUrl('/', locale as Locale),
      languages: alternateLanguages,
    },

    // Open Graph (Facebook, LinkedIn, Messenger, WhatsApp)
    openGraph: {
      type: 'website',
      locale: localeMetadata.ogLocale,
      alternateLocale: locales
        .filter(l => l !== locale)
        .map(l => getLocaleSeoMetadata(l as Locale).ogLocale),
      url: getCanonicalUrl('/', locale as Locale),
      siteName: seoConfig.siteName,
      title: localeMetadata.title,
      description: localeMetadata.description,
      images: [
        {
          url: seoConfig.ogImage,
          width: 1200,
          height: 630,
          alt: seoConfig.ogImageAlt[locale as Locale] ?? seoConfig.ogImageAlt.en,
        },
      ],
    },

    // Twitter / X
    twitter: {
      card: seoConfig.twitterCard,
      title: localeMetadata.title,
      description: localeMetadata.description,
      creator: seoConfig.twitterHandle,
      site: seoConfig.twitterHandle,
      images: [seoConfig.ogImage],
    },

    // Robots
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // Icons
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      other: [{ rel: 'manifest', url: '/site.webmanifest' }],
    },

    // Manifest
    manifest: '/site.webmanifest',

    // Verification (add codes when available)
    verification: {
      google: seoConfig.verification.google,
      other: {
        'msvalidate.01': seoConfig.verification.bing ?? '',
      },
    },

    // Category
    category: 'Food & Beverage',
  };
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Each route-group layout provides its own filtered NextIntlClientProvider.
  // The root provider intentionally carries no messages — it only supplies
  // locale / timezone / formats to AppProviders (none of which use translations).
  // This eliminates the 38 KB JSON payload that was previously embedded in
  // every page's HTML regardless of which namespaces that page actually needed.

  // Get locale configuration for RTL support
  const currentLocaleConfig = getLocaleConfig(locale as Locale);
  const isRTL = currentLocaleConfig.direction === 'rtl';

  // Select font based on locale
  // Arabic font is only needed on ar locale; include it via isRTL conditional
  const fontClass = isRTL
    ? `${notoSansArabic.variable} ${inter.variable} ${playfairDisplay.variable} ${fraunces.variable}`
    : `${inter.variable} ${playfairDisplay.variable} ${fraunces.variable}`;

  return (
    <html
      lang={locale}
      dir={currentLocaleConfig.direction}
      className={fontClass}
      suppressHydrationWarning
      data-scroll-behavior='smooth'
    >
      <head>
        {/* next/font/google self-hosts all fonts at build time — no runtime
            fetch to fonts.googleapis.com or fonts.gstatic.com is needed.
            Preconnect hints to those origins were removed to avoid opening
            unnecessary TCP connections. */}
        {/* DNS prefetch for analytics (non-critical, deferred) */}
        <link rel='dns-prefetch' href='https://www.google-analytics.com' />
        <link rel='dns-prefetch' href='https://www.googletagmanager.com' />
      </head>
      <body
        className={`font-sans antialiased ${isRTL ? 'text-right' : 'text-left'}`}
        style={{
          fontFamily: isRTL
            ? 'var(--font-noto-arabic), var(--font-inter), sans-serif'
            : 'var(--font-inter), var(--font-noto-arabic), sans-serif',
        }}
      >
        {/* Google Analytics 4 */}
        {process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] && (
          <GoogleAnalytics
            measurementId={process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID']}
            enabled={process.env['NEXT_PUBLIC_ENABLE_ANALYTICS'] === 'true'}
          />
        )}

        <NextIntlClientProvider messages={{}}>
          <ChunkErrorBoundary>
            <AppProviders>{children}</AppProviders>
          </ChunkErrorBoundary>
        </NextIntlClientProvider>
        <CookieConsentWrapper />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
