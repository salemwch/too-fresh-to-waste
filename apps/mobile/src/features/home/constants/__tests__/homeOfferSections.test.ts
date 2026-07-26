/**
 * HOME_OFFER_SECTIONS.
 *
 * The four home carousels used to be four near-identical JSX blocks. As a table
 * they cannot drift, but a table only helps if every entry is complete — a
 * missing translation key would render the key itself to the user, which is the
 * same defect the order status badges had.
 */

import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import ar from '@/i18n/locales/ar.json';

import { HOME_OFFER_SECTIONS, OFFER_SECTIONS } from '../homeConstants';

/** Resolves a dotted key against a locale bundle. */
const lookup = (bundle: object, key: string): unknown =>
  key.split('.').reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, bundle);

const KEY_FIELDS = ['titleKey', 'emptyKey', 'subtextKey', 'mascotCopyKey'] as const;

describe('HOME_OFFER_SECTIONS', () => {
  it('defines the four carousels', () => {
    expect(HOME_OFFER_SECTIONS.map(s => s.id)).toEqual([
      'urgentOffers',
      'hottestDeals',
      'pickupToday',
      'pickupTomorrow',
    ]);
  });

  it('has no duplicate ids', () => {
    const ids = HOME_OFFER_SECTIONS.map(s => s.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  // Every id is also a FlashList key, so a blank one would collide.
  it('gives every section a non-empty id and testID prefix', () => {
    for (const section of HOME_OFFER_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.section.testIDPrefix).toBeTruthy();
    }
  });

  describe('translations', () => {
    // A missing key renders as the key itself — "home.noUrgentDeals" in the UI.
    it.each(KEY_FIELDS)('resolves %s in English for every section', field => {
      const missing = HOME_OFFER_SECTIONS.filter(s => lookup(en, s[field]) == null).map(s => s.id);

      expect(missing).toEqual([]);
    });

    it.each([
      ['fr', fr],
      ['ar', ar],
    ])('resolves every key in %s', (_locale, bundle) => {
      const missing = HOME_OFFER_SECTIONS.flatMap(section =>
        KEY_FIELDS.filter(field => lookup(bundle, section[field]) == null).map(
          field => `${section.id}.${field}`,
        ),
      );

      expect(missing).toEqual([]);
    });

    // The emoji lives outside the translation so a translator cannot drop it.
    it('keeps decorative emoji out of the translated title', () => {
      for (const section of HOME_OFFER_SECTIONS) {
        expect(lookup(en, section.titleKey)).not.toMatch(/[⚡🔥]/u);
      }
    });
  });

  it('reuses the shared display config rather than redefining variants', () => {
    expect(HOME_OFFER_SECTIONS.map(s => s.section)).toEqual([
      OFFER_SECTIONS.urgent,
      OFFER_SECTIONS.hottest,
      OFFER_SECTIONS.pickupToday,
      OFFER_SECTIONS.pickupTomorrow,
    ]);
  });

  // Only the urgent carousel is visually promoted; the rest are peers.
  it('features only the urgent section', () => {
    const featured = HOME_OFFER_SECTIONS.filter(s => s.section.variant === 'featured');

    expect(featured.map(s => s.id)).toEqual(['urgentOffers']);
  });
});
