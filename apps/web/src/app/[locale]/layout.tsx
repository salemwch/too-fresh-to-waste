import type { Metadata, Viewport } from 'next';
import { Comfortaa, Noto_Sans_Arabic, Quicksand } from 'next/font/google';
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

/*
 * Two faces for the whole product, both rounded geometric sans: Comfortaa for
 * headings, Quicksand for everything else. They replace Inter, Playfair and
 * Fraunces, which between them made the site read as three different products.
 *
 * Neither carries Arabic glyphs, so Noto Sans Arabic stays in both Tailwind
 * stacks. The browser falls through per character, which is why no locale
 * conditional is needed anywhere in the components.
 */

// Body text.
const quicksand = Quicksand({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-quicksand',
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

// Headings.
const comfortaa = Comfortaa({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-comfortaa',
  adjustFontFallback: true,
  preload: true,
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});

// Arabic font (Noto Sans Arabic) for Arabic locale
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-noto-arabic',
  adjustFontFallback: true,
  // preload: false - Arabic is only needed on the ar locale; preloading it on
  // every page (en/fr) causes "preloaded resource not used" console warnings.
  preload: false,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
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

  /*
   * Every locale gets every font variable, Arabic included.
   *
   * Both Tailwind stacks name var(--font-noto-arabic), and a var() pointing at
   * an undefined custom property makes the whole font-family declaration
   * invalid at computed-value time - the browser then falls back to its own
   * default, which is Times New Roman. Defining it only on the ar locale meant
   * English and French rendered every heading and every paragraph in a serif
   * nobody chose.
   *
   * Declaring the variable costs nothing: a custom property does not fetch a
   * font. Noto is only downloaded when a glyph actually needs it, which on
   * en/fr never happens.
   */
  const fontClass = `${quicksand.variable} ${comfortaa.variable} ${notoSansArabic.variable}`;

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
      {/*
        `font-sans` is the single source of truth for the base face. An inline
        style used to repeat the same stack here and silently win over the
        class, so the file gave two answers to one question. The Arabic-first
        ordering for RTL now lives in globals.css.
      */}
      <body className={`font-sans antialiased ${isRTL ? 'text-right' : 'text-left'}`}>
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
