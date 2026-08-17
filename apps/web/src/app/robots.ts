import { MetadataRoute } from 'next';
import { seoConfig } from '@/config/seo.config';

// Every application route is locale-prefixed (`localePrefix: 'always'`), so the
// live URLs are /en/admin/..., /fr/merchant/..., /ar/login and so on.
// A bare '/admin/' rule therefore matches nothing — it only covers a
// non-existent unprefixed path. The '/*/' wildcard covers all three locales
// without needing to enumerate them, and the unprefixed form is kept so the
// rules still hold if a route is ever served without a locale.
const PRIVATE_PATHS = [
  'admin',
  'merchant',
  'merchant-signup',
  'login',
  'reset-password',
  'forgot-password',
  'verify-email',
  'email-verified',
  'accept-invitation',
  'account-deletion',
] as const;

const privateRules = PRIVATE_PATHS.flatMap(p => [`/${p}`, `/${p}/`, `/*/${p}`, `/*/${p}/`]);

const infraRules = [
  '/api/',
  '/_next/',
  '/monitoring',
  '/*.json$',
  // Referral deep-links are per-user and carry no unique indexable content.
  '/r/',
  '/*/r/',
];

// AI answer engines are a genuine referral channel now: being the cited source
// for "food waste app Tunisia" inside ChatGPT, Perplexity or Claude sends
// qualified traffic that never appears in classic rankings. These crawlers are
// allowed deliberately, with the same private-area restrictions as Googlebot.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = seoConfig.url;
  const disallow = [...infraRules, ...privateRules];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: 'Googlebot', allow: '/', disallow },
      { userAgent: 'Googlebot-Image', allow: '/', disallow },
      { userAgent: 'Bingbot', allow: '/', disallow },
      ...AI_CRAWLERS.map(userAgent => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
