/**
 * The create-offer panel was written entirely in hardcoded English — every
 * label, every validation error, and the customer-facing description it
 * pre-fills into the offer. A French or Arabic merchant filled in an English
 * form and published an English description to Tunisian customers.
 *
 * Same reasoning as `pricing-messages.test.ts`: a type-check cannot see a
 * missing key or an ICU message that throws when formatted, so every key the
 * panel asks for is exercised here against all three locales.
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

const NAMESPACE = 'dashboard.surpriseBag';

type LooseTranslator = (key: string, values?: Record<string, string | number>) => string;

const translatorFor = (locale: string, messages: unknown): LooseTranslator =>
  createTranslator({
    locale,
    messages: messages as NonNullable<Parameters<typeof createTranslator>[0]['messages']>,
    namespace: NAMESPACE,
    onError: error => {
      throw error;
    },
  }) as unknown as LooseTranslator;

const assertFullyResolved = (value: string, key: string) => {
  expect(typeof value).toBe('string');
  expect(value.length).toBeGreaterThan(0);
  expect(value).not.toContain('{');
  expect(value).not.toContain('}');
  expect(value).not.toBe(`${NAMESPACE}.${key}`);
};

/** Every key the panel reads with no interpolation. */
const PLAIN_KEYS = [
  'title',
  'subtitle',
  'close',
  'itemName',
  'itemNamePlaceholder',
  'defaultTitle',
  'description',
  'resetSuggestion',
  'quantity',
  'decreaseQuantity',
  'increaseQuantity',
  'offerType',
  'types.surprise_bag',
  'types.specific_items',
  'types.meal_deal',
  'pricing',
  'originalValue',
  'customerPays',
  'pickupWindow',
  'today',
  'tomorrow',
  'presets.lunch',
  'presets.dinner',
  'presets.allDay',
  'customRange',
  'from',
  'until',
  'fromLabel',
  'untilLabel',
  'rightNow',
  'midnight',
  'startPassedWarning',
  'offerImage',
  'imageFormats',
  'uploadCta',
  'imagePreviewAlt',
  'removeImage',
  'loadingEstablishment',
  'noEstablishment',
  'publish',
  'publishing',
  'errors.establishmentMissing',
  'errors.pickupWindowMissing',
  'errors.priceInvalid',
  'errors.endBeforeStart',
  'errors.startPassed',
  'errors.publishFailed',
];

/** Keys the panel reads with interpolation, and the params it actually passes. */
const PARAMETERISED: Array<[string, Record<string, string | number>]> = [
  ['descriptionHelp', { count: 143 }],
  ['quantityMax', { value: 100 }],
  ['priceMax', { value: 100 }],
  ['discount', { min: 40 }],
  ['customerSaves', { amount: '5.000', percent: 50 }],
  ['summary', { day: 'Today', from: '12:00', until: '14:00' }],
  ['errors.discountTooLow', { min: 40 }],
  ['errors.titleTooShort', { min: 5 }],
  ['errors.descriptionTooShort', { min: 20 }],
];

const BAG_TYPES = ['surprise_bag', 'specific_items', 'meal_deal'];

describe.each(LOCALES)('create-offer panel messages — %s', (locale, messages) => {
  const t = translatorFor(locale, messages);

  it.each(PLAIN_KEYS)('renders %s', key => {
    assertFullyResolved(t(key), key);
  });

  it.each(PARAMETERISED)('renders %s with its params', (key, params) => {
    assertFullyResolved(t(key, params), key);
  });

  // The description is published to customers, so it has to read correctly at
  // 1 as well as at many — the boundary a naive "bags" suffix gets wrong.
  it.each(BAG_TYPES)('renders the auto description for %s', type => {
    for (const qty of [1, 2, 11]) {
      assertFullyResolved(
        t(`autoDescription.${type}`, { title: 'Panier surprise', qty }),
        `autoDescription.${type}`,
      );
    }
  });

  it.each([1, 2, 12])('renders the publish confirmation for %i bags', count => {
    assertFullyResolved(t('publishSuccess', { count }), 'publishSuccess');
  });

  // The backend rejects descriptions under 20 characters, so a pre-filled one
  // that is shorter would block publishing with a validation error the merchant
  // did not cause.
  it.each(BAG_TYPES)('pre-fills %s past the backend 20-character minimum', type => {
    expect(t(`autoDescription.${type}`, { title: 'Bag', qty: 1 }).trim().length).toBeGreaterThan(
      20,
    );
  });
});

describe('locale parity', () => {
  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
      : [prefix];

  const keysFor = (messages: unknown) =>
    flatten((messages as { dashboard: { surpriseBag: unknown } }).dashboard.surpriseBag).sort();

  it('carries an identical key set in every locale', () => {
    const [enKeys, frKeys, arKeys] = [en, fr, ar].map(keysFor);
    expect(enKeys.length).toBeGreaterThan(0);
    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);
  });
});
