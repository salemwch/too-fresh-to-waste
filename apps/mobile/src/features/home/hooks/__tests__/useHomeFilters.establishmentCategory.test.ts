/**
 * useHomeFilters — establishment category toggling.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three controls write `filters.establishmentTypes`: the home category rail,
 * the filter bottom sheet, and the active filter chips. Before this change they
 * each had their own add/remove logic, and the rail did not exist yet — adding
 * it with a fourth copy is how a chip ends up lit while the results are
 * unfiltered, or a filter sticks with nothing on screen able to clear it.
 *
 * They now all route through `toggleCategoryTypes`. What that leaves to test
 * here is the part the pure function cannot own:
 *
 *   - the **state write** is correct and reaches `filterParams`, which is what
 *     the offer queries actually consume;
 *   - a **no-op tap does not write** — `toggleCategoryTypes` returns the same
 *     array reference and the hook short-circuits on it, which keeps both a
 *     re-render and an AsyncStorage write from happening per tap;
 *   - **interop with the sheet**: a single type written by the sheet is
 *     readable and fully clearable from the rail.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { EstablishmentType } from '@/features/offers/types/offer.types';
import { countSheetFilters, hasSheetFilters } from '@/features/search/types/filter.types';
import { analytics } from '@/utils/analytics';

import { useHomeFilters } from '../useHomeFilters';

import type { FilterState } from '@/features/search/types/filter.types';

jest.mock('@/utils/analytics', () => ({
  analytics: {
    track: jest.fn(),
    trackFiltersApplied: jest.fn(),
    trackFilterRemoved: jest.fn(),
    trackFiltersCleared: jest.fn(),
  },
}));

const mockedAnalytics = analytics as jest.Mocked<typeof analytics>;

/** Mounts the hook and waits past the async AsyncStorage restore on mount. */
const mountHook = async () => {
  const rendered = renderHook(() => useHomeFilters());
  await waitFor(() => {
    expect(rendered.result.current.filters).toBeDefined();
  });
  return rendered;
};

const selected = (filters: FilterState): EstablishmentType[] => [...filters.establishmentTypes];

beforeEach(async () => {
  jest.clearAllMocks();
  /*
   * The hook persists filters to AsyncStorage and restores them on mount, so
   * without this every test inherits the previous test's selection — which is
   * the hook working correctly and the fixture leaking. Found by a `cafe` case
   * failing with `supermarket` still applied.
   */
  await AsyncStorage.clear();
});

describe('handleToggleEstablishmentCategory', () => {
  it('adds every type the category owns', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(selected(result.current.filters)).toEqual([
      EstablishmentType.BAKERY,
      EstablishmentType.PASTRY_SHOP,
    ]);
  });

  it('removes every type the category owns on the second tap', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(selected(result.current.filters)).toEqual([]);
  });

  it('keeps other categories when adding one', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('cafe');
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(selected(result.current.filters)).toContain(EstablishmentType.CAFE);
    expect(selected(result.current.filters)).toContain(EstablishmentType.BAKERY);
  });

  it('keeps other categories when removing one', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('cafe');
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(selected(result.current.filters)).toEqual([EstablishmentType.CAFE]);
  });

  it('feeds the selected types through to filterParams', async () => {
    // filterParams is what the offer queries consume. A write that lands in
    // state but not here would light the chip and change nothing on screen.
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('supermarket');
    });

    await waitFor(() => {
      expect(result.current.filterParams.establishmentTypes).toEqual([
        EstablishmentType.SUPERMARKET,
      ]);
    });
  });

  it('drops establishmentTypes from filterParams once cleared', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('supermarket');
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('supermarket');
    });

    await waitFor(() => {
      expect(result.current.filterParams.establishmentTypes).toBeUndefined();
    });
  });

  it('counts as exactly one active filter however many types it wrote', async () => {
    const { result } = await mountHook();

    act(() => {
      // `other` owns seven types; the badge must read 1, not 7.
      result.current.handleToggleEstablishmentCategory('other');
    });

    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('does not change state identity for an unknown category', async () => {
    const { result } = await mountHook();
    const before = result.current.filters;

    act(() => {
      result.current.handleToggleEstablishmentCategory(
        'nightclub' as Parameters<typeof result.current.handleToggleEstablishmentCategory>[0],
      );
    });

    // Same object, not merely equal — a new object would re-render the rail and
    // fire the AsyncStorage persistence effect for a tap that changed nothing.
    expect(result.current.filters).toBe(before);
  });

  it('tracks the direction of the toggle, not just that it happened', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('hotel');
    });
    expect(mockedAnalytics.track).toHaveBeenCalledWith(
      'home_category_pressed',
      expect.objectContaining({ category: 'hotel', selected: true }),
    );

    act(() => {
      result.current.handleToggleEstablishmentCategory('hotel');
    });
    expect(mockedAnalytics.track).toHaveBeenLastCalledWith(
      'home_category_pressed',
      expect.objectContaining({ category: 'hotel', selected: false }),
    );
  });

  it('does not track anything for a no-op tap', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory(
        'nightclub' as Parameters<typeof result.current.handleToggleEstablishmentCategory>[0],
      );
    });

    expect(mockedAnalytics.track).not.toHaveBeenCalledWith(
      'home_category_pressed',
      expect.anything(),
    );
  });

  it('keeps a stable handler identity across renders', async () => {
    // The rail passes this straight into memoised chips. A new identity per
    // render would repaint all eight chips on every parent render.
    const { result, rerender } = await mountHook();
    const first = result.current.handleToggleEstablishmentCategory;

    rerender(undefined);

    expect(result.current.handleToggleEstablishmentCategory).toBe(first);
  });
});

describe('the filter button badge is scoped to the sheet', () => {
  it('does not count a rail selection', async () => {
    // Establishment type is no longer a bottom-sheet filter. Counting it would
    // badge a sheet with no control for it: the user opens it to clear the "1"
    // and finds nothing to clear.
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(countSheetFilters(result.current.filters)).toBe(0);
    expect(hasSheetFilters(result.current.filters)).toBe(false);
  });

  it('still counts it in the overall total, which analytics uses', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(result.current.activeFilterCount).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('counts a genuine sheet filter', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleApplyFilters({
        ...result.current.filters,
        categories: ['pizza'],
      });
    });

    expect(countSheetFilters(result.current.filters)).toBe(1);
    expect(hasSheetFilters(result.current.filters)).toBe(true);
  });

  it('counts the two independently', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('cafe');
    });
    act(() => {
      result.current.handleApplyFilters({
        ...result.current.filters,
        categories: ['pizza'],
        minDiscount: 50,
      });
    });

    expect(countSheetFilters(result.current.filters)).toBe(2);
    expect(result.current.activeFilterCount).toBe(3);
  });
});

describe('interop with the filter bottom sheet', () => {
  it('reads a single type written by the sheet as an active category', async () => {
    const { result } = await mountHook();

    act(() => {
      // What the sheet does on Apply: replaces the whole filter object.
      result.current.handleApplyFilters({
        ...result.current.filters,
        establishmentTypes: [EstablishmentType.PASTRY_SHOP],
      });
    });

    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('clears BOTH types when the rail turns off a sheet-set single type', async () => {
    // The half-applied case. If the rail only removed the type it recognises,
    // the chip would go dark while PASTRY_SHOP kept filtering the results.
    const { result } = await mountHook();

    act(() => {
      result.current.handleApplyFilters({
        ...result.current.filters,
        establishmentTypes: [EstablishmentType.BAKERY],
      });
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    expect(selected(result.current.filters)).toEqual([]);
  });

  it('survives a persisted type that is no longer in the enum', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleApplyFilters({
        ...result.current.filters,
        establishmentTypes: ['hovercraft_rental' as EstablishmentType],
      });
    });
    act(() => {
      result.current.handleToggleEstablishmentCategory('cafe');
    });

    // The unknown value is preserved rather than silently dropped, and the
    // known category is added alongside it.
    expect(selected(result.current.filters)).toContain('hovercraft_rental');
    expect(selected(result.current.filters)).toContain(EstablishmentType.CAFE);
  });

  it('survives an Apply from the sheet, which no longer shows establishment types', async () => {
    /*
     * The sheet's Apply replaces the entire FilterState with its local copy.
     * That copy is seeded from the current filters and the sheet now has no
     * establishment control, so the field must ride through untouched.
     *
     * If it ever stops doing so, opening the sheet, changing nothing relevant
     * and pressing Apply would silently clear the user's category — the tile
     * would go dark and the carousels would refill, with no way to attribute
     * it to the button they pressed.
     */
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });

    const railSelection = selected(result.current.filters);
    expect(railSelection).toHaveLength(2);

    act(() => {
      // Exactly what FilterBottomSheet does on Apply: spread the current state,
      // change only what the sheet owns.
      result.current.handleApplyFilters({
        ...result.current.filters,
        categories: ['pizza'],
      });
    });

    expect(selected(result.current.filters)).toEqual(railSelection);
  });

  it('is still cleared by the sheet Clear button', async () => {
    // The mirror of the case above. Clear must mean *all* filters, including
    // the one this sheet cannot display, or the rail stays lit after Clear.
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });
    act(() => {
      result.current.handleApplyFilters({
        offerType: null,
        establishmentTypes: [],
        cuisineTypes: [],
        categories: [],
        priceRange: { min: null, max: null },
        minDiscount: null,
      });
    });

    expect(selected(result.current.filters)).toEqual([]);
  });

  it('is cleared by clear-all along with everything else', async () => {
    const { result } = await mountHook();

    act(() => {
      result.current.handleToggleEstablishmentCategory('bakery');
    });
    act(() => {
      result.current.handleClearAllFilters();
    });

    expect(selected(result.current.filters)).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });
});
