import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the locale from the request
  let locale = await requestLocale;

  // Validate and fallback to default locale
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Time zone for Tunisia
    timeZone: 'Africa/Tunis',
    // Date/time formatting
    now: new Date(),
    // Number formatting for TND currency
    formats: {
      number: {
        currency: {
          style: 'currency',
          currency: 'TND',
          currencyDisplay: 'symbol',
        },
        percent: {
          style: 'percent',
          minimumFractionDigits: 0,
        },
      },
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          weekday: 'long',
        },
      },
    },
  };
});
