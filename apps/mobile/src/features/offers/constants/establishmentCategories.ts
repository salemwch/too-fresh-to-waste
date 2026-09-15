/**
 * Establishment categories — the single source of truth for establishment-type
 * grouping, labelling and iconography across the app.
 *
 * Lives in `features/offers` rather than in `home` or `search` because both of
 * those consume it. A `search -> home` import would invert the dependency
 * direction; establishments are offer-domain data, so the domain owns them.
 *
 * Three things live here, and they must stay together:
 *
 *   1. WHICH categories exist, and in what order (`ESTABLISHMENT_CATEGORIES`)
 *   2. WHICH `EstablishmentType`s each one selects (`types`)
 *   3. HOW a set of selected types maps back to category state
 *      (`isCategoryActive` / `toggleCategoryTypes`)
 *
 * ── Why a mapping at all ────────────────────────────────────────────────────
 * Merchants can register as any of **17** `EstablishmentType` values, but 17
 * chips is not a rail, it is a second filter sheet. So the 17 collapse onto 8
 * categories. The mapping is exhaustive by construction: `CATEGORY_BY_TYPE` is
 * typed as a total `Record<EstablishmentType, EstablishmentCategoryId>`, so
 * adding a member to the enum without mapping it is a **compile error**, not a
 * silent gap where a merchant's offers become unreachable.
 *
 * This also closes a real pre-existing gap. The filter sheet used to list 8
 * single types, so a merchant registered as `pastry_shop`, `buffet_restaurant`,
 * `sushi_restaurant`, `takeaway`, `fruit_vegetables`, `butcher_shop`,
 * `beverage_shop`, `pet_store` or `flower_plant` could not be filtered for at
 * all - 9 of 17 types were unreachable. Grouping makes every type selectable.
 *
 * ── Why "any", not "all", decides the selected state ────────────────────────
 * Two controls write `filters.establishmentTypes`: the home rail and
 * `FilterBottomSheet`. Persisted filter state from an older app version can
 * also contain a single type (`BAKERY`) that a category covers alongside
 * others (`PASTRY_SHOP`). If a category only read as selected when *every* one
 * of its types was present, that state would be undisplayable — the user sees
 * results filtered to bakeries with the Bakery chip unlit, and nothing to tap
 * to clear it.
 *
 * So: a category is active when **any** of its types is selected. Toggling on
 * adds all of them, toggling off removes all of them. Removing a type that was
 * not there is a no-op, which makes the operation idempotent and makes
 * rail -> sheet -> rail round-trips converge instead of drift.
 */

import { establishmentCategoryColors as catColors } from '@/design-system/tokens/colors';
import { EstablishmentType } from '@/features/offers/types/offer.types';

import bakeryArt from '@/assets/images/categories/bakery.webp';
import cafeArt from '@/assets/images/categories/cafe.webp';
import fastFoodArt from '@/assets/images/categories/fast-food.webp';
import hotelArt from '@/assets/images/categories/hotel.webp';
import OtherIcon from '@/assets/images/categories/other.svg';
import restaurantArt from '@/assets/images/categories/restaurant.webp';
import supermarketArt from '@/assets/images/categories/supermarket.webp';
import WholesalerIcon from '@/assets/images/categories/wholesaler.svg';

import type React from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { SvgProps } from 'react-native-svg';

// ============================================================================
// Types
// ============================================================================

/** Stable identifiers for the eight establishment categories. */
export type EstablishmentCategoryId =
  | 'bakery'
  | 'restaurant'
  | 'cafe'
  | 'fastFood'
  | 'supermarket'
  | 'wholesaler'
  | 'hotel'
  | 'other';

/**
 * Category artwork, vector or raster.
 *
 * Raster is shipped as WebP at @1x/@1.5x/@2x/@3x/@4x - React Native resolves
 * the density variant automatically from the base import, so only the base
 * path is named here.
 */
export type CategoryArtwork =
  | { readonly kind: 'vector'; readonly Icon: React.FC<SvgProps> }
  | { readonly kind: 'raster'; readonly source: ImageSourcePropType };

export interface EstablishmentCategory {
  /** Stable id — used as the list key and in analytics. Never translated. */
  readonly id: EstablishmentCategoryId;
  /** i18n key under the `establishmentCategories` namespace. */
  readonly labelKey: string;
  /**
   * The icon artwork.
   *
   * Vector and raster are both supported and the union is explicit, because
   * the set is mid-migration: hand-authored SVGs are being replaced one at a
   * time with rendered artwork. A single optional field would let a category
   * ship with neither and fail at render; this fails at compile time instead.
   *
   * Either way the artwork owns its palette and is never recoloured - see the
   * note on `tint` below and DESIGN.md §19-E34.
   */
  readonly artwork: CategoryArtwork;
  /**
   * Squircle tile background at rest. A soft wash of the icon's dominant hue,
   * so the tile reads as belonging to the icon rather than as a grey box.
   */
  readonly tint: string;
  /**
   * The category's identifying colour. Used for the selected tile's border and
   * label. Picked from the icon artwork, not from the theme, so the two cannot
   * drift apart.
   */
  readonly accent: string;
  /** Every `EstablishmentType` this category selects. Non-empty. */
  readonly types: readonly EstablishmentType[];
}

// ============================================================================
// Category definitions
// ============================================================================

/**
 * Order is deliberate and **fixed** — roughly the order these business types
 * appear in the Tunisian market, most common first.
 *
 * Do not make this order dynamic. A rail that re-sorts itself by live offer
 * count destroys muscle memory: a user reaching for the fourth chip finds
 * something else, which is worse than a chip sitting in a suboptimal slot.
 */
export const ESTABLISHMENT_CATEGORIES: readonly EstablishmentCategory[] = Object.freeze([
  {
    id: 'bakery',
    labelKey: 'establishmentCategories.bakery',
    tint: catColors.bakery.tint,
    accent: catColors.bakery.accent,
    artwork: { kind: 'raster', source: bakeryArt },
    types: Object.freeze([EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP]),
  },
  {
    id: 'restaurant',
    labelKey: 'establishmentCategories.restaurant',
    tint: catColors.restaurant.tint,
    accent: catColors.restaurant.accent,
    artwork: { kind: 'raster', source: restaurantArt },
    types: Object.freeze([
      EstablishmentType.RESTAURANT,
      EstablishmentType.BUFFET_RESTAURANT,
      EstablishmentType.SUSHI_RESTAURANT,
    ]),
  },
  {
    id: 'cafe',
    labelKey: 'establishmentCategories.cafe',
    tint: catColors.cafe.tint,
    accent: catColors.cafe.accent,
    artwork: { kind: 'raster', source: cafeArt },
    types: Object.freeze([EstablishmentType.CAFE]),
  },
  {
    id: 'fastFood',
    labelKey: 'establishmentCategories.fastFood',
    tint: catColors.fastFood.tint,
    accent: catColors.fastFood.accent,
    artwork: { kind: 'raster', source: fastFoodArt },
    types: Object.freeze([EstablishmentType.FAST_FOOD, EstablishmentType.TAKEAWAY]),
  },
  {
    id: 'supermarket',
    labelKey: 'establishmentCategories.supermarket',
    tint: catColors.supermarket.tint,
    accent: catColors.supermarket.accent,
    artwork: { kind: 'raster', source: supermarketArt },
    types: Object.freeze([EstablishmentType.SUPERMARKET]),
  },
  {
    id: 'wholesaler',
    labelKey: 'establishmentCategories.wholesaler',
    tint: catColors.wholesaler.tint,
    accent: catColors.wholesaler.accent,
    artwork: { kind: 'vector', Icon: WholesalerIcon },
    types: Object.freeze([EstablishmentType.WHOLESALER]),
  },
  {
    id: 'hotel',
    labelKey: 'establishmentCategories.hotel',
    tint: catColors.hotel.tint,
    accent: catColors.hotel.accent,
    artwork: { kind: 'raster', source: hotelArt },
    types: Object.freeze([EstablishmentType.HOTEL]),
  },
  {
    id: 'other',
    labelKey: 'establishmentCategories.other',
    tint: catColors.other.tint,
    accent: catColors.other.accent,
    artwork: { kind: 'vector', Icon: OtherIcon },
    types: Object.freeze([
      EstablishmentType.PET_STORE,
      EstablishmentType.FLOWER_PLANT,
      // Re-homed when the Grocery category was retired — see CATEGORY_BY_TYPE.
      EstablishmentType.GROCERY_STORE,
      EstablishmentType.FRUIT_VEGETABLES,
      EstablishmentType.BUTCHER_SHOP,
      EstablishmentType.BEVERAGE_SHOP,
      EstablishmentType.OTHER,
    ]),
  },
] as const satisfies readonly EstablishmentCategory[]);

// ============================================================================
// Reverse lookup — total over the enum
// ============================================================================

/**
 * Every `EstablishmentType` to the category that owns it.
 *
 * Declared as a total `Record`, so a new enum member fails `check:ts` here
 * rather than silently falling through to `other` — or worse, to nothing.
 */
export const CATEGORY_BY_TYPE: Readonly<Record<EstablishmentType, EstablishmentCategoryId>> =
  Object.freeze({
    [EstablishmentType.BAKERY]: 'bakery',
    [EstablishmentType.PASTRY_SHOP]: 'bakery',
    [EstablishmentType.RESTAURANT]: 'restaurant',
    [EstablishmentType.BUFFET_RESTAURANT]: 'restaurant',
    [EstablishmentType.SUSHI_RESTAURANT]: 'restaurant',
    [EstablishmentType.CAFE]: 'cafe',
    [EstablishmentType.FAST_FOOD]: 'fastFood',
    [EstablishmentType.TAKEAWAY]: 'fastFood',
    /*
     * The Grocery category was retired from the rail on 2026-09-14. Its four
     * types are NOT removed from the enum - merchants are already registered
     * under them - they are re-homed on `other` so their offers stay reachable
     * from the home screen instead of falling out of every category.
     */
    [EstablishmentType.GROCERY_STORE]: 'other',
    [EstablishmentType.FRUIT_VEGETABLES]: 'other',
    [EstablishmentType.BUTCHER_SHOP]: 'other',
    [EstablishmentType.BEVERAGE_SHOP]: 'other',
    [EstablishmentType.SUPERMARKET]: 'supermarket',
    [EstablishmentType.HOTEL]: 'hotel',
    [EstablishmentType.WHOLESALER]: 'wholesaler',
    [EstablishmentType.PET_STORE]: 'other',
    [EstablishmentType.FLOWER_PLANT]: 'other',
    [EstablishmentType.OTHER]: 'other',
  });

// ============================================================================
// Selectors — pure, shared by the rail, the sheet and the active chips
// ============================================================================

/** Frozen empty array — never allocate a new `[]` for the miss case. */
const NO_TYPES: readonly EstablishmentType[] = Object.freeze([]);

/** Frozen empty array for the "nothing selected" category result. */
const NO_CATEGORIES: readonly EstablishmentCategory[] = Object.freeze([]);

/**
 * The `EstablishmentType`s a category selects. Returns a shared frozen empty
 * array for an unknown id rather than allocating, so callers can safely use the
 * result in a dependency array.
 */
export const typesForCategory = (id: EstablishmentCategoryId): readonly EstablishmentType[] =>
  ESTABLISHMENT_CATEGORIES.find(category => category.id === id)?.types ?? NO_TYPES;

/**
 * Whether a category should render as selected, given the current filter state.
 *
 * "Any", not "all" — see the file header for why. `selected` is the raw
 * `filters.establishmentTypes` array, which may contain types written by an
 * older app version or by a control that sets a single type.
 */
export const isCategoryActive = (
  selected: readonly EstablishmentType[],
  id: EstablishmentCategoryId,
): boolean => {
  if (selected.length === 0) return false;
  const owned = typesForCategory(id);
  return owned.some(type => selected.includes(type));
};

/**
 * The categories currently active, in `ESTABLISHMENT_CATEGORIES` order.
 *
 * Used by `ActiveFilterChips` so that selecting Bakery renders **one** removable
 * chip rather than one per underlying type. Returns a shared frozen array when
 * nothing is selected, so an empty filter state does not allocate per render.
 */
export const activeCategories = (
  selected: readonly EstablishmentType[],
): readonly EstablishmentCategory[] => {
  if (selected.length === 0) return NO_CATEGORIES;
  return ESTABLISHMENT_CATEGORIES.filter(category => isCategoryActive(selected, category.id));
};

/**
 * Apply a category toggle to a list of selected establishment types.
 *
 * Pure, and the single place the toggle rule is written — the rail, the filter
 * sheet, the active chips and every test drive this same function, so they
 * cannot drift apart on what a tap means.
 *
 * - **Off → on**: append every type the category owns that is not already
 *   present. Types belonging to other categories are preserved.
 * - **On → off**: remove every type the category owns. Types belonging to other
 *   categories are preserved.
 *
 * Returns the input array unchanged (**same reference**) when the operation is
 * a no-op, so React bails out of the re-render instead of repainting the rail.
 */
export const toggleCategoryTypes = (
  selected: readonly EstablishmentType[],
  id: EstablishmentCategoryId,
): readonly EstablishmentType[] => {
  const owned = typesForCategory(id);
  if (owned.length === 0) return selected;

  if (isCategoryActive(selected, id)) {
    const next = selected.filter(type => !owned.includes(type));
    return next.length === selected.length ? selected : next;
  }

  const missing = owned.filter(type => !selected.includes(type));
  return missing.length === 0 ? selected : [...selected, ...missing];
};
