/**
 * Home screen section order.
 *
 * WHY THIS EXISTS
 * ---------------
 * The category rail was added by inserting a descriptor into this list and a
 * case into the render switch. Both are easy to get subtly wrong in ways that
 * nothing else catches:
 *
 *   - a descriptor with no matching `case` renders `null` — a silent blank gap
 *     where the rail should be, with no error anywhere;
 *   - a `case` with no descriptor never runs at all, so the feature is simply
 *     absent while every unit test for the component itself still passes;
 *   - the wrong index puts the rail below the impact banner or the bag goal,
 *     which renders perfectly and is still wrong.
 *
 * Mounting the real HomeScreen to check this would mean stubbing navigation,
 * Redux, TanStack Query, location and six modals — a test that fails for
 * reasons unrelated to what it claims to cover. So the decision is a pure
 * function over two booleans, and all four inputs are enumerated here.
 */

import { buildHomeSections } from '../homeSections';

import type { HomeSectionType } from '../homeSections';

const ids = (input: { shouldShowPrompt: boolean; isLocationModalVisible: boolean }) =>
  buildHomeSections(input).map(s => s.id);

const WITHOUT_PROMPT: HomeSectionType[] = [
  'searchBar',
  'categoryRail',
  'heroCarousel',
  'urgentOffers',
  'hottestDeals',
  'pickupToday',
  'pickupTomorrow',
];

describe('buildHomeSections', () => {
  // ==========================================================================
  // The four possible inputs, enumerated
  // ==========================================================================

  it.each([
    [false, false, WITHOUT_PROMPT],
    [false, true, WITHOUT_PROMPT],
    [true, true, WITHOUT_PROMPT],
    [true, false, ['locationPrompt', ...WITHOUT_PROMPT]],
  ])(
    'shouldShowPrompt=%s modalVisible=%s produces the expected sections',
    (shouldShowPrompt, isLocationModalVisible, expected) => {
      expect(ids({ shouldShowPrompt, isLocationModalVisible })).toEqual(expected);
    },
  );

  it('never shows the banner while the first-run modal is asking', () => {
    // Two entry points to one runtime permission is how a new user got prompted
    // twice, and how the duplicate `request()` race became reachable.
    expect(ids({ shouldShowPrompt: true, isLocationModalVisible: true })).not.toContain(
      'locationPrompt',
    );
  });

  // ==========================================================================
  // The rail's position — the thing this change actually added
  // ==========================================================================

  describe('category rail placement', () => {
    it('is present on every render', () => {
      for (const shouldShowPrompt of [true, false]) {
        for (const isLocationModalVisible of [true, false]) {
          expect(ids({ shouldShowPrompt, isLocationModalVisible })).toContain('categoryRail');
        }
      }
    });

    it('sits immediately after the search bar', () => {
      const list = ids({ shouldShowPrompt: false, isLocationModalVisible: false });
      expect(list.indexOf('categoryRail')).toBe(list.indexOf('searchBar') + 1);
    });

    it('still sits immediately after the search bar when the prompt is showing', () => {
      // The conditional section shifts every index by one; a hardcoded position
      // would pass the case above and fail here.
      const list = ids({ shouldShowPrompt: true, isLocationModalVisible: false });
      expect(list.indexOf('categoryRail')).toBe(list.indexOf('searchBar') + 1);
    });

    it('sits above the impact banner and the bag goal', () => {
      const list = ids({ shouldShowPrompt: false, isLocationModalVisible: false });
      expect(list.indexOf('categoryRail')).toBeLessThan(list.indexOf('heroCarousel'));
    });

    it('sits above every offer carousel, so it is reachable without scrolling', () => {
      const list = ids({ shouldShowPrompt: false, isLocationModalVisible: false });
      const carousels: HomeSectionType[] = [
        'urgentOffers',
        'hottestDeals',
        'pickupToday',
        'pickupTomorrow',
      ];
      for (const carousel of carousels) {
        expect(list.indexOf('categoryRail')).toBeLessThan(list.indexOf(carousel));
      }
    });
  });

  // ==========================================================================
  // FlashList contract
  // ==========================================================================

  describe('FlashList contract', () => {
    it('gives every section a unique id, since id is the keyExtractor', () => {
      const list = ids({ shouldShowPrompt: true, isLocationModalVisible: false });
      expect(new Set(list).size).toBe(list.length);
    });

    it('keeps id and type in step', () => {
      // `renderSection` switches on `type` while FlashList keys on `id`. If they
      // diverge, a cell renders another section's content under its own key.
      for (const section of buildHomeSections({
        shouldShowPrompt: true,
        isLocationModalVisible: false,
      })) {
        expect(section.id).toBe(section.type);
      }
    });

    it('returns a fresh array so a caller cannot mutate the canonical order', () => {
      const first = buildHomeSections({ shouldShowPrompt: false, isLocationModalVisible: false });
      first.length = 0;

      const second = buildHomeSections({ shouldShowPrompt: false, isLocationModalVisible: false });
      expect(second).toHaveLength(WITHOUT_PROMPT.length);
    });
  });
});
