/**
 * The home screen's section list, as a pure function.
 *
 * WHY THIS IS NOT INLINE IN HomeScreen
 * ------------------------------------
 * The order of these sections is a product decision — the category rail sits
 * directly under the search bar so the two read as one control group, and above
 * the impact banner so it stays over the fold. Getting that wrong renders
 * perfectly and is wrong anyway.
 *
 * Inline in a `useMemo`, the only way to verify it is to mount the whole
 * screen, which needs navigation, Redux, TanStack Query, location and six
 * modals stubbed. That test would be slow, brittle, and would fail for reasons
 * unrelated to section order — so in practice it would not be written, and the
 * ordering would ship unverified.
 *
 * Extracted, it is a pure function over two booleans with four possible inputs,
 * all of which are enumerated in the tests. Same pattern as
 * `navigation/utils/canRenderNavigator`.
 */

/** Every section the home screen can render, in no particular order. */
export type HomeSectionType =
  | 'locationPrompt'
  | 'searchBar'
  | 'categoryRail'
  | 'impactBanner'
  | 'monthlyBagGoal'
  | 'urgentOffers'
  | 'hottestDeals'
  | 'pickupToday'
  | 'pickupTomorrow';

export interface HomeSection {
  id: HomeSectionType;
  type: HomeSectionType;
}

interface BuildHomeSectionsInput {
  /** The location permission banner wants to show. */
  shouldShowPrompt: boolean;
  /** The first-run location modal is already on screen. */
  isLocationModalVisible: boolean;
}

/**
 * Sections present on every render, in display order.
 *
 * Frozen at module scope: `buildHomeSections` returns a copy, so a caller
 * cannot mutate the canonical order for everyone else.
 */
const ALWAYS_PRESENT: readonly HomeSectionType[] = Object.freeze([
  'searchBar',
  // Directly under the search bar on purpose. The rail and the search field are
  // two ways to narrow the same list, so they belong in one visual group; and
  // at ~56px it keeps the first offer carousel above the fold on a 6.1" screen.
  'categoryRail',
  'impactBanner',
  'monthlyBagGoal',
  'urgentOffers',
  'hottestDeals',
  'pickupToday',
  'pickupTomorrow',
]);

/**
 * Build the FlashList section descriptors.
 *
 * The location prompt is the only conditional section. It appears when the
 * banner wants to show **and** the first-run modal is not already asking:
 * both were computed independently once, so a new user got two prompts for the
 * same permission — the modal in front and the banner behind it. Two entry
 * points to one runtime permission is also how the duplicate `request()` race
 * became reachable. The modal owns first run; the banner is the persistent
 * affordance afterwards.
 */
export const buildHomeSections = ({
  shouldShowPrompt,
  isLocationModalVisible,
}: BuildHomeSectionsInput): HomeSection[] => {
  const types: HomeSectionType[] =
    shouldShowPrompt && !isLocationModalVisible
      ? ['locationPrompt', ...ALWAYS_PRESENT]
      : [...ALWAYS_PRESENT];

  return types.map(type => ({ id: type, type }));
};
