/**
 * Category rail → offer queries: tapping a category must filter the offers.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three layers were each tested in isolation and all three passed:
 *
 *   - `establishmentCategories.test.ts` — the toggle maths
 *   - `HomeCategoryRail.test.tsx` — the tap reports the right id
 *   - `useHomeFilters.establishmentCategory.test.ts` — state and `filterParams`
 *
 * None of them proved the tap reaches the **queries**. On a device it looked
 * like it did: tapping Bakery visibly refires all four carousels, because
 * `filterParams` is part of every query key, so the key changes and TanStack
 * refetches. A refetch is not a filter, and that distinction is invisible
 * without an assertion like the ones below.
 *
 * WHAT IT DRIVES
 * --------------
 * The real rail, the real `useHomeFilters`, and the real `useHomeOffers`, wired
 * together exactly as `HomeScreen` wires them. Only the four query hooks are
 * mocked, and only so the arguments they receive can be read — which is the
 * seam where the filter either arrives or is lost.
 *
 * The scenarios cover every category, both toggle directions, multi-select,
 * interaction with the search query and the sheet filters, and the retired
 * Grocery types.
 */

import { fireEvent, render, screen, act } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/design-system/providers';
import { EstablishmentType } from '@/features/offers/types/offer.types';
import {
  ESTABLISHMENT_CATEGORIES,
  typesForCategory,
} from '@/features/offers/constants/establishmentCategories';

import type { EstablishmentCategoryId } from '@/features/offers/constants/establishmentCategories';

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/utils/analytics', () => ({
  analytics: {
    track: jest.fn(),
    trackFiltersApplied: jest.fn(),
    trackFilterRemoved: jest.fn(),
    trackFiltersCleared: jest.fn(),
  },
}));

/**
 * What each carousel's query hook was last called with.
 *
 * `urgent`, `pickupToday` and `pickupTomorrow` take filters as a positional
 * argument; `hottest` (`useOffers`) receives them spread into its params
 * object. Both shapes are normalised to `establishmentTypes` here so the
 * assertions read the same for all four.
 */
interface Seen {
  establishmentTypes?: readonly EstablishmentType[] | undefined;
  search?: string | undefined;
  categories?: readonly string[] | undefined;
}

const mockSeen: Record<string, Seen> = {};

const mockEmptyResult = { data: undefined, isLoading: false, error: null, refetch: jest.fn() };

jest.mock('@/features/offers/hooks/useOffers', () => ({
  // (hours, limit, location, filters, options)
  useUrgentOffers: jest.fn((...a: unknown[]) => {
    mockSeen['urgent'] = (a[3] ?? {}) as Seen;
    return mockEmptyResult;
  }),
  // (params, location, options) — filters are spread into `params`
  useOffers: jest.fn((...a: unknown[]) => {
    mockSeen['hottest'] = (a[0] ?? {}) as Seen;
    return mockEmptyResult;
  }),
  // (limit, location, filters, options)
  usePickupTodayOffers: jest.fn((...a: unknown[]) => {
    mockSeen['pickupToday'] = (a[2] ?? {}) as Seen;
    return mockEmptyResult;
  }),
  usePickupTomorrowOffers: jest.fn((...a: unknown[]) => {
    mockSeen['pickupTomorrow'] = (a[2] ?? {}) as Seen;
    return mockEmptyResult;
  }),
}));

jest.mock('@/hooks/redux', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({
      auth: { isAuthenticated: true, sessionExpiresAt: null, isRecoveringSession: false },
    }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { HomeCategoryRail } from '../components/HomeCategoryRail';
import { useHomeFilters } from '../hooks/useHomeFilters';
import { useHomeOffers } from '../hooks/useHomeOffers';

/** Every section that must honour the filter. */
const SECTIONS = ['urgent', 'hottest', 'pickupToday', 'pickupTomorrow'] as const;

/**
 * The seam under test, wired the way HomeScreen wires it: one `useHomeFilters`
 * feeding both the rail and `useHomeOffers`.
 */
const Harness: React.FC<{ search?: string }> = ({ search }) => {
  const { filters, filterParams, handleToggleEstablishmentCategory, setSearchQuery } =
    useHomeFilters();

  useHomeOffers({ latitude: 36.8, longitude: 10.18 }, filterParams);

  React.useEffect(() => {
    if (search !== undefined) setSearchQuery(search);
  }, [search, setSearchQuery]);

  return (
    <ThemeProvider defaultTheme='light'>
      <HomeCategoryRail
        selectedTypes={filters.establishmentTypes}
        onToggleCategory={handleToggleEstablishmentCategory}
      />
    </ThemeProvider>
  );
};

const renderHarness = (search?: string) => render(<Harness {...(search ? { search } : {})} />);

/** Tap a category tile by its stable testID. */
const tap = (id: EstablishmentCategoryId) => {
  fireEvent.press(screen.getByTestId(`home-category-chip-${id}`));
};

/** Lets the lazy-load timer in `useHomeOffers` arm the secondary sections. */
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });
};

const ALL_IDS = ESTABLISHMENT_CATEGORIES.map(c => c.id);

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockSeen)) delete mockSeen[k];
  // The hook restores persisted filters on mount; without this every test
  // inherits the previous one's selection.
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// The core contract
// ============================================================================

describe('tapping a category filters every home carousel', () => {
  it('sends no establishment filter before anything is tapped', async () => {
    renderHarness();
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toBeUndefined();
    }
  });

  it.each(ALL_IDS)('%s reaches all four carousels with its own types', async id => {
    renderHarness();
    await settle();

    await act(async () => {
      tap(id);
    });
    await settle();

    const expected = [...typesForCategory(id)];
    expect(expected.length).toBeGreaterThan(0);

    for (const s of SECTIONS) {
      // Every section must receive the SAME filter. A section that silently
      // drops it renders an unfiltered carousel under a lit category tile.
      expect({ section: s, types: mockSeen[s]?.establishmentTypes }).toEqual({
        section: s,
        types: expected,
      });
    }
  });

  it('clears the filter from every carousel on a second tap', async () => {
    renderHarness();
    await settle();

    await act(async () => {
      tap('bakery');
    });
    await settle();
    expect(mockSeen['urgent']?.establishmentTypes).toBeDefined();

    await act(async () => {
      tap('bakery');
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toBeUndefined();
    }
  });

  it('sends the union when two categories are selected', async () => {
    renderHarness();
    await settle();

    await act(async () => {
      tap('cafe');
    });
    await act(async () => {
      tap('hotel');
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toEqual([
        EstablishmentType.CAFE,
        EstablishmentType.HOTEL,
      ]);
    }
  });

  it('leaves only the remaining category when one of two is cleared', async () => {
    renderHarness();
    await settle();

    await act(async () => {
      tap('cafe');
    });
    await act(async () => {
      tap('bakery');
    });
    await act(async () => {
      tap('bakery');
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toEqual([EstablishmentType.CAFE]);
    }
  });

  it('expands a multi-type category into every one of its types', async () => {
    // Bakery is two types. Sending only `bakery` would hide every pastry shop
    // while the Bakery tile is lit — the exact failure the grouping prevents.
    renderHarness();
    await settle();

    await act(async () => {
      tap('bakery');
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toEqual([
        EstablishmentType.BAKERY,
        EstablishmentType.PASTRY_SHOP,
      ]);
    }
  });

  it('keeps the retired Grocery types reachable through Other', async () => {
    renderHarness();
    await settle();

    await act(async () => {
      tap('other');
    });
    await settle();

    // Grocery left the rail; its types must still be requestable, or those
    // merchants' offers become unfilterable from the home screen.
    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toContain(EstablishmentType.GROCERY_STORE);
      expect(mockSeen[s]?.establishmentTypes).toContain(EstablishmentType.BUTCHER_SHOP);
    }
  });

  it('sends the new Wholesaler type', async () => {
    renderHarness();
    await settle();

    await act(async () => {
      tap('wholesaler');
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toEqual([EstablishmentType.WHOLESALER]);
    }
  });
});

// ============================================================================
// Interaction with the other filter inputs
// ============================================================================

describe('the category filter composes with the other inputs', () => {
  it('carries a search query alongside the category', async () => {
    renderHarness('croissant');
    await settle();

    await act(async () => {
      tap('bakery');
    });
    // The search box is debounced, so let that window elapse too.
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toEqual([
        EstablishmentType.BAKERY,
        EstablishmentType.PASTRY_SHOP,
      ]);
      expect(mockSeen[s]?.search).toBe('croissant');
    }
  });

  it('does not disturb the search query when the category is cleared', async () => {
    renderHarness('croissant');
    await settle();

    await act(async () => {
      tap('bakery');
    });
    await act(async () => {
      tap('bakery');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await settle();

    for (const s of SECTIONS) {
      expect(mockSeen[s]?.establishmentTypes).toBeUndefined();
      expect(mockSeen[s]?.search).toBe('croissant');
    }
  });

  it('keeps every category independent — selecting one never implies another', async () => {
    renderHarness();
    await settle();

    for (const id of ALL_IDS) {
      await act(async () => {
        tap(id);
      });
      await settle();

      const sent = [...(mockSeen['urgent']?.establishmentTypes ?? [])];
      expect(sent.sort()).toEqual([...typesForCategory(id)].sort());

      // Toggle back off so the next iteration starts clean.
      await act(async () => {
        tap(id);
      });
      await settle();
    }
  });
});
