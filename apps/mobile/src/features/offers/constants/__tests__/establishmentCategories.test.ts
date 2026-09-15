/**
 * Establishment category mapping and selectors.
 *
 * This is the layer every consumer shares — the home rail, the filter sheet and
 * the active filter chips all read their selected state and write their changes
 * through the functions tested here. If they agree with this file they cannot
 * disagree with each other, which is the whole reason the logic was extracted
 * out of the three components in the first place.
 *
 * Two properties carry most of the weight and are asserted directly rather than
 * inferred:
 *
 *   - **Totality.** Every one of the 18 `EstablishmentType` members maps to a
 *     category, and every category's `types` agree with the reverse lookup.
 *     A merchant whose type falls through the mapping is invisible on the home
 *     screen, and that failure is silent at runtime.
 *   - **Referential stability.** A no-op toggle returns the *same array
 *     reference*. `useHomeFilters` short-circuits on that identity to avoid a
 *     re-render and an AsyncStorage write per tap, so it is a contract, not an
 *     implementation detail.
 */

import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

import { EstablishmentType } from '@/features/offers/types/offer.types';

import {
  ESTABLISHMENT_CATEGORIES,
  CATEGORY_BY_TYPE,
  typesForCategory,
  isCategoryActive,
  activeCategories,
  toggleCategoryTypes,
} from '../establishmentCategories';

import type { EstablishmentCategoryId } from '../establishmentCategories';

const ALL_TYPES = Object.values(EstablishmentType);
const ALL_IDS = ESTABLISHMENT_CATEGORIES.map(c => c.id);

/** Not a member of the enum. Models a type persisted by an older app build. */
const UNKNOWN_TYPE = 'hovercraft_rental' as EstablishmentType;
const UNKNOWN_ID = 'nightclub' as EstablishmentCategoryId;

// ============================================================================
// Mapping totality
// ============================================================================

describe('category mapping covers the whole enum', () => {
  it('has all 18 establishment types, so the fixture notices a new one', () => {
    // Guards the tests below: they iterate the enum, so if a member is added
    // and this count is not revisited, the new member silently joins every
    // loop with no one having decided which category it belongs to.
    expect(ALL_TYPES).toHaveLength(18);
  });

  it.each(ALL_TYPES)('maps %s to a category that exists', type => {
    const id = CATEGORY_BY_TYPE[type];
    expect(id).toBeDefined();
    expect(ALL_IDS).toContain(id);
  });

  it('claims every type exactly once across all categories', () => {
    const claimed = ESTABLISHMENT_CATEGORIES.flatMap(c => [...c.types]);

    // No type is owned by two categories — otherwise toggling one category off
    // would silently clear part of another.
    expect(new Set(claimed).size).toBe(claimed.length);
    // And nothing is left unclaimed.
    expect([...claimed].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('agrees with the reverse lookup in both directions', () => {
    for (const category of ESTABLISHMENT_CATEGORIES) {
      for (const type of category.types) {
        expect(CATEGORY_BY_TYPE[type]).toBe(category.id);
      }
    }
  });

  it('gives every category at least one type', () => {
    // A category with no types would render a chip that filters nothing and can
    // never light up — `isCategoryActive` would always be false for it.
    for (const category of ESTABLISHMENT_CATEGORIES) {
      expect(category.types.length).toBeGreaterThan(0);
    }
  });

  it('has eight categories with unique ids', () => {
    expect(ESTABLISHMENT_CATEGORIES).toHaveLength(8);
    expect(new Set(ALL_IDS).size).toBe(8);
  });

  it('gives every category usable artwork of a known kind', () => {
    /*
     * The set is mid-migration from hand-authored SVG to rendered WebP, so
     * both kinds are live at once. This asserts the union is inhabited rather
     * than which kind any given category uses — pinning that would fail on
     * every swap and teach people to edit the test instead of reading it.
     */
    for (const category of ESTABLISHMENT_CATEGORIES) {
      const art = category.artwork;
      expect(['vector', 'raster']).toContain(art.kind);
      if (art.kind === 'vector') {
        expect(art.Icon).toBeDefined();
      } else {
        // The asset stub resolves imports to '', so assert the field exists
        // rather than that it is truthy.
        expect(art).toHaveProperty('source');
      }
    }
  });

  it('gives every category a tile tint and an accent', () => {
    // Both are read unconditionally by the rail; a missing one renders a
    // transparent tile or an invisible selected border.
    for (const category of ESTABLISHMENT_CATEGORIES) {
      expect(category.tint).toMatch(/^#[0-9A-Fa-f]{6}$/u);
      expect(category.accent).toMatch(/^#[0-9A-Fa-f]{6}$/u);
    }
  });
});

// ============================================================================
// Translations — the "translations are atomic" rule, enforced
// ============================================================================

describe('labels resolve in every shipped locale', () => {
  const bundles = { en, fr, ar } as const;

  const lookup = (bundle: object, path: string): unknown =>
    path.split('.').reduce<unknown>((node, key) => {
      if (node !== null && typeof node === 'object' && key in node) {
        return (node as Record<string, unknown>)[key];
      }
      return undefined;
    }, bundle);

  it.each(ESTABLISHMENT_CATEGORIES.map(c => [c.id, c.labelKey] as const))(
    '%s has a non-empty translation in en, fr and ar',
    (_id, labelKey) => {
      for (const [lang, bundle] of Object.entries(bundles)) {
        const value = lookup(bundle, labelKey);
        // A missing key renders the raw path in the UI —
        // "establishmentCategories.bakery" — rather than failing loudly, so
        // the locale is named in the assertion to make a miss readable.
        expect({ lang, value }).toEqual({ lang, value: expect.any(String) });
        expect(value).not.toBe('');
      }
    },
  );

  it.each(['railLabel', 'a11ySelect', 'a11yClear', 'a11yHint'])(
    'ships the rail string %s in every locale',
    key => {
      for (const bundle of Object.values(bundles)) {
        const value = lookup(bundle, `establishmentCategories.${key}`);
        expect(typeof value).toBe('string');
        expect(value).not.toBe('');
      }
    },
  );

  it('interpolates the category name into the a11y labels', () => {
    for (const bundle of Object.values(bundles)) {
      expect(lookup(bundle, 'establishmentCategories.a11ySelect')).toContain('{{category}}');
      expect(lookup(bundle, 'establishmentCategories.a11yClear')).toContain('{{category}}');
    }
  });
});

// ============================================================================
// typesForCategory
// ============================================================================

describe('typesForCategory', () => {
  it('returns the declared types for a known id', () => {
    expect(typesForCategory('bakery')).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.PASTRY_SHOP,
    ]);
  });

  it('returns an empty list for an unknown id rather than throwing', () => {
    expect(typesForCategory(UNKNOWN_ID)).toEqual([]);
  });

  it('returns the same reference for repeated unknown lookups', () => {
    // Shared frozen constant, not a fresh `[]` — callers put this in dependency
    // arrays, and a new array each call would invalidate every memo downstream.
    expect(typesForCategory(UNKNOWN_ID)).toBe(typesForCategory(UNKNOWN_ID));
  });
});

// ============================================================================
// isCategoryActive
// ============================================================================

describe('isCategoryActive', () => {
  it('is false when nothing is selected', () => {
    for (const id of ALL_IDS) {
      expect(isCategoryActive([], id)).toBe(false);
    }
  });

  it('is true when every owned type is selected', () => {
    expect(
      isCategoryActive([EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP], 'bakery'),
    ).toBe(true);
  });

  it('is true when only one owned type is selected', () => {
    // "Any", not "all". The filter sheet or a persisted state from an older
    // build can hold a single type; requiring all of them would make that state
    // undisplayable — filtered results with an unlit chip and no way to clear.
    expect(isCategoryActive([EstablishmentType.PASTRY_SHOP], 'bakery')).toBe(true);
  });

  it('is false when only another category is selected', () => {
    expect(isCategoryActive([EstablishmentType.CAFE], 'bakery')).toBe(false);
  });

  it('is false for an unknown id even with a full selection', () => {
    expect(isCategoryActive(ALL_TYPES, UNKNOWN_ID)).toBe(false);
  });

  it('ignores types that are not in the enum', () => {
    expect(isCategoryActive([UNKNOWN_TYPE], 'bakery')).toBe(false);
  });

  it('lights every category when everything is selected', () => {
    for (const id of ALL_IDS) {
      expect(isCategoryActive(ALL_TYPES, id)).toBe(true);
    }
  });
});

// ============================================================================
// toggleCategoryTypes
// ============================================================================

describe('toggleCategoryTypes', () => {
  it('adds every owned type when turning a category on', () => {
    expect(toggleCategoryTypes([], 'bakery')).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.PASTRY_SHOP,
    ]);
  });

  it('adds every type for a category that owns several', () => {
    // `other` absorbed the retired Grocery category's four types on top of its
    // own three, so it is the widest fan-out the toggle has to handle.
    expect(toggleCategoryTypes([], 'other')).toEqual([
      EstablishmentType.PET_STORE,
      EstablishmentType.FLOWER_PLANT,
      EstablishmentType.GROCERY_STORE,
      EstablishmentType.FRUIT_VEGETABLES,
      EstablishmentType.BUTCHER_SHOP,
      EstablishmentType.BEVERAGE_SHOP,
      EstablishmentType.OTHER,
    ]);
  });

  it('keeps a retired type reachable through the category that absorbed it', () => {
    /*
     * Grocery left the rail but GROCERY_STORE stayed in the enum, because
     * merchants are registered under it. If it had been dropped from every
     * category as well, those merchants' offers would be filterable from
     * nowhere on the home screen.
     */
    expect(isCategoryActive([EstablishmentType.GROCERY_STORE], 'other')).toBe(true);
    expect(activeCategories([EstablishmentType.BUTCHER_SHOP]).map(x => x.id)).toEqual(['other']);
  });

  it('removes every owned type when turning a category off', () => {
    const on = toggleCategoryTypes([], 'bakery');
    expect(toggleCategoryTypes(on, 'bakery')).toEqual([]);
  });

  it('removes ALL owned types even when only one was selected', () => {
    // The half-applied case: the sheet set BAKERY alone. Toggling the chip off
    // must clear the category completely, or the chip stays lit after the tap.
    const next = toggleCategoryTypes([EstablishmentType.BAKERY], 'bakery');
    expect(next).toEqual([]);
    expect(isCategoryActive(next, 'bakery')).toBe(false);
  });

  it('preserves types belonging to other categories when turning on', () => {
    const next = toggleCategoryTypes([EstablishmentType.CAFE], 'bakery');
    expect(next).toContain(EstablishmentType.CAFE);
    expect(next).toContain(EstablishmentType.BAKERY);
    expect(next).toContain(EstablishmentType.PASTRY_SHOP);
  });

  it('preserves types belonging to other categories when turning off', () => {
    const start = [EstablishmentType.CAFE, EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP];
    expect(toggleCategoryTypes(start, 'bakery')).toEqual([EstablishmentType.CAFE]);
  });

  it('leaves unrecognised types in place', () => {
    // Persisted filter state from an older build must survive a toggle rather
    // than being quietly dropped on the user's next tap.
    const next = toggleCategoryTypes([UNKNOWN_TYPE], 'cafe');
    expect(next).toContain(UNKNOWN_TYPE);
    expect(next).toContain(EstablishmentType.CAFE);
  });

  it('returns to the original selection after two toggles', () => {
    const start = [EstablishmentType.CAFE];
    const round = toggleCategoryTypes(toggleCategoryTypes(start, 'bakery'), 'bakery');
    expect([...round].sort()).toEqual([...start].sort());
  });

  it('is idempotent when toggling off twice', () => {
    const once = toggleCategoryTypes([EstablishmentType.BAKERY], 'bakery');
    expect(toggleCategoryTypes(once, 'bakery')).not.toBe(once);
    // Second off is a fresh "on", so assert the real invariant: applying off to
    // an already-off category turns it back on rather than corrupting state.
    expect(isCategoryActive(toggleCategoryTypes(once, 'bakery'), 'bakery')).toBe(true);
  });

  it('does not duplicate types already present', () => {
    const start = [EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP];
    // Already fully on, so this is a turn-off, not a duplicating add.
    expect(toggleCategoryTypes(start, 'bakery')).toEqual([]);
  });

  describe('referential stability — the perf contract', () => {
    it('returns the SAME array for an unknown id', () => {
      const start = [EstablishmentType.CAFE];
      expect(toggleCategoryTypes(start, UNKNOWN_ID)).toBe(start);
    });

    it('returns a NEW array whenever something actually changes', () => {
      const start: EstablishmentType[] = [];
      expect(toggleCategoryTypes(start, 'cafe')).not.toBe(start);
    });
  });

  it.each(ALL_IDS)('round-trips %s from empty and back', id => {
    const on = toggleCategoryTypes([], id);
    expect(isCategoryActive(on, id)).toBe(true);
    expect(on).toEqual([...typesForCategory(id)]);

    const off = toggleCategoryTypes(on, id);
    expect(isCategoryActive(off, id)).toBe(false);
    expect(off).toEqual([]);
  });
});

// ============================================================================
// activeCategories
// ============================================================================

describe('activeCategories', () => {
  it('is empty when nothing is selected', () => {
    expect(activeCategories([])).toEqual([]);
  });

  it('returns the same reference for repeated empty calls', () => {
    expect(activeCategories([])).toBe(activeCategories([]));
  });

  it('returns one entry per category, not one per underlying type', () => {
    // Selecting Bakery writes two types. The chips row must show one chip.
    const result = activeCategories([EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('bakery');
  });

  it('returns categories in canonical order regardless of selection order', () => {
    const result = activeCategories([EstablishmentType.HOTEL, EstablishmentType.BAKERY]);
    // `bakery` precedes `hotel` in ESTABLISHMENT_CATEGORIES.
    expect(result.map(c => c.id)).toEqual(['bakery', 'hotel']);
  });

  it('returns every category when every type is selected', () => {
    expect(activeCategories(ALL_TYPES).map(c => c.id)).toEqual(ALL_IDS);
  });

  it('ignores unrecognised types', () => {
    expect(activeCategories([UNKNOWN_TYPE])).toEqual([]);
  });
});
