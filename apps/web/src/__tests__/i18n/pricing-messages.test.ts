/**
 * The pricing guide's whole reason for changing was that the advice arrived as
 * hardcoded English from the backend, so a French or Arabic merchant read
 * English sentences inside their own dashboard. The fix moves every sentence
 * into `messages/*.json`, keyed by the insight type the API now returns.
 *
 * That fix is only real if all three locales carry all the keys and every ICU
 * message actually formats. A type-check cannot see either: `t('insights.x')`
 * type-checks fine against a missing key and against a message whose ICU
 * syntax throws at render.
 *
 * These tests drive all three locales from one table so they cannot drift.
 */

import { createTranslator } from 'next-intl';

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

const NAMESPACE = 'dashboard.merchantPricing';

/** One representative param set per advice key the backend can emit. */
const INSIGHTS: Array<[string, Record<string, string | number>]> = [
  ['price_above_zone', { yourPrice: 6.5, zonePrice: 4.2, diffPercent: 55 }],
  ['price_below_zone', { yourPrice: 3.1, zonePrice: 4.2, diffPercent: 26 }],
  ['low_fill_rate', { fillRate: 38 }],
  ['low_discount', { discountPercent: 41 }],
  ['best_day', { day: 'Tuesday' }],
  ['best_hour', { hour: 17 }],
];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * next-intl types the translator against the literal message shape, which
 * cannot express "the same namespace across three separate JSON imports".
 * The loose signature keeps the call sites readable; the runtime object is the
 * real translator, so ICU parsing and locale plural rules are genuinely exercised.
 */
type LooseTranslator = (key: string, values?: Record<string, string | number>) => string;

const translatorFor = (locale: string, messages: unknown): LooseTranslator =>
  createTranslator({
    locale,
    messages: messages as NonNullable<Parameters<typeof createTranslator>[0]['messages']>,
    namespace: NAMESPACE,
    // Surface a missing key as a throw instead of the silent fallback string,
    // which would let this suite pass against an untranslated locale.
    onError: error => {
      throw error;
    },
  }) as unknown as LooseTranslator;

/** A message that still contains braces never had its params substituted. */
const assertFullyResolved = (value: string, key: string) => {
  expect(typeof value).toBe('string');
  expect(value.length).toBeGreaterThan(0);
  expect(value).not.toContain('{');
  expect(value).not.toContain('}');
  expect(value).not.toBe(`${NAMESPACE}.${key}`);
};

describe.each(LOCALES)('pricing guide messages — %s', (locale, messages) => {
  const t = translatorFor(locale, messages);

  it.each(INSIGHTS)('renders the %s advice', (key, params) => {
    assertFullyResolved(t(`insights.${key}`, params), `insights.${key}`);
  });

  it.each(DAY_KEYS)('names weekday %s', key => {
    assertFullyResolved(t(`days.${key}`), `days.${key}`);
  });

  it.each([
    ['title', undefined],
    ['subtitle', undefined],
    ['empty.title', undefined],
    ['empty.body', undefined],
    ['tiles.avgPrice', undefined],
    ['tiles.avgPriceHelp', undefined],
    ['tiles.fillRate', undefined],
    ['tiles.fillRateHelp', undefined],
    ['tiles.peers', undefined],
    ['tiles.suggested', undefined],
    ['tiles.suggestedHelpOwn', undefined],
    ['tiles.suggestedHelpZone', undefined],
    ['hint.inRange', undefined],
    ['hint.below', undefined],
    ['hint.above', undefined],
  ] as Array<[string, undefined]>)('renders %s', key => {
    assertFullyResolved(t(key), key);
  });

  // Peer counts and sample sizes are pluralised in en/fr; 1 and 0 are the forms
  // most likely to be missing from a plural block.
  it.each([0, 1, 2, 11])('renders the peer-count help for %i shops', count => {
    for (const key of ['tiles.peersHelp', 'tiles.peersHelpCity']) {
      assertFullyResolved(t(key, { count }), key);
    }
  });

  it.each([0, 1, 5])('renders the sample note for %i listings', offers => {
    assertFullyResolved(t('sampleNote', { offers, days: 60 }), 'sampleNote');
  });

  it.each(['own', 'zone'])('renders the %s range hint', basis => {
    assertFullyResolved(t(`hint.${basis}`, { min: 4.5, max: 6 }), `hint.${basis}`);
  });
});

describe('locale parity', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  const keysFor = (messages: unknown) =>
    flatten(
      (messages as { dashboard: { merchantPricing: unknown } }).dashboard.merchantPricing,
    ).sort();

  it('carries an identical key set in every locale', () => {
    const [enKeys, frKeys, arKeys] = [en, fr, ar].map(keysFor);
    expect(enKeys.length).toBeGreaterThan(0);
    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);
  });
});
