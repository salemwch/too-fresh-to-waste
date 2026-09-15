/**
 * HomeCategoryRail — the row of establishment shortcuts under the search bar.
 *
 * WHAT THIS PROTECTS
 * ------------------
 * Three things that are invisible to the type-checker and to a screenshot:
 *
 *   1. **Order is never reversed for Arabic.** `I18nManager.forceRTL` flips row
 *      layout natively, so reversing the array in JS as well flips it twice and
 *      lands back in left-to-right order. That bug renders perfectly — it just
 *      renders backwards — and nothing but an explicit assertion catches it.
 *
 *   2. **A partially-selected category still lights up.** The filter sheet and
 *      persisted state from an older build can hold one of a category's types.
 *      If the chip only lit when all of them were present, the user would see
 *      filtered results with no lit chip and no way to clear the filter.
 *
 *   3. **The accessibility label says which way the tap goes.** A screen-reader
 *      user gets "Show only Bakery offers" or "Stop filtering by Bakery"; a
 *      static label would leave them unable to tell selected from unselected,
 *      since `accessibilityState` alone is not announced on every reader.
 *
 * The SVG icons resolve through `jest.svgStub.js` (see jest.config.js), which
 * renders a host view carrying the `color` prop — so the selected-state tint is
 * assertable without reaching into react-native-svg internals.
 */

import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { I18nManager } from 'react-native';

import { ThemeProvider } from '@/design-system/providers';
import { EstablishmentType } from '@/features/offers/types/offer.types';
import { ESTABLISHMENT_CATEGORIES } from '@/features/offers/constants/establishmentCategories';

import { HomeCategoryRail } from '../HomeCategoryRail';

import type { EstablishmentCategoryId } from '@/features/offers/constants/establishmentCategories';

const CANONICAL_IDS = ESTABLISHMENT_CATEGORIES.map(c => c.id);

const renderRail = (
  selectedTypes: readonly EstablishmentType[] = [],
  onToggleCategory: (id: EstablishmentCategoryId) => void = jest.fn(),
) =>
  render(
    <ThemeProvider defaultTheme='light'>
      <HomeCategoryRail selectedTypes={selectedTypes} onToggleCategory={onToggleCategory} />
    </ThemeProvider>,
  );

describe('HomeCategoryRail', () => {
  afterEach(() => {
    // `isRTL` is a module-level flag; leaking it would silently change the
    // layout assumptions of every suite that runs after this file.
    Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true });
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe('rendering', () => {
    it('renders one chip per category', () => {
      const { getByTestId } = renderRail();
      for (const id of CANONICAL_IDS) {
        expect(getByTestId(`home-category-chip-${id}`)).toBeTruthy();
      }
    });

    it('renders all eight and no more', () => {
      const { getAllByRole } = renderRail();
      expect(getAllByRole('button')).toHaveLength(8);
    });

    it('shows the translated label on each chip', () => {
      const { getByTestId } = renderRail();
      // i18n is initialised to `en` in the test environment.
      expect(within(getByTestId('home-category-chip-bakery')).getByText('Bakery')).toBeTruthy();
      expect(
        within(getByTestId('home-category-chip-fastFood')).getByText('Fast food'),
      ).toBeTruthy();
    });

    it('labels the rail itself for screen readers', () => {
      const { getByTestId } = renderRail();
      expect(getByTestId('home-category-rail-scroll').props['accessibilityLabel']).toBe(
        'Browse by category',
      );
    });
  });

  // ==========================================================================
  // Order / RTL
  // ==========================================================================

  describe('ordering', () => {
    const renderedOrder = (queryAll: (id: RegExp) => { props: Record<string, unknown> }[]) =>
      queryAll(/^home-category-chip-/).map(node =>
        String(node.props['testID'] ?? '').replace('home-category-chip-', ''),
      );

    it('renders in canonical order in LTR', () => {
      const { getAllByTestId } = renderRail();
      expect(renderedOrder(getAllByTestId as never)).toEqual(CANONICAL_IDS);
    });

    it('renders in the SAME canonical order under RTL', () => {
      // The critical assertion. RN flips the row itself, so the JS order must
      // stay canonical. If someone "fixes" RTL by reversing the array here,
      // the two flips cancel and Arabic users get a left-to-right rail.
      Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });

      const { getAllByTestId } = renderRail();
      expect(renderedOrder(getAllByTestId as never)).toEqual(CANONICAL_IDS);
      expect(renderedOrder(getAllByTestId as never)).not.toEqual([...CANONICAL_IDS].reverse());
    });

    it('uses symmetric horizontal padding so RTL cannot mirror it', () => {
      const { getByTestId } = renderRail();
      const style = flattenStyle(
        getByTestId('home-category-rail-scroll').props['contentContainerStyle'],
      );
      expect(style['paddingHorizontal']).toBe(16);
      expect(style['paddingStart']).toBeUndefined();
      expect(style['paddingEnd']).toBeUndefined();
    });
  });

  // ==========================================================================
  // Selected state
  // ==========================================================================

  describe('selected state', () => {
    it('marks nothing selected when the filter is empty', () => {
      const { getByTestId } = renderRail([]);
      for (const id of CANONICAL_IDS) {
        expect(getByTestId(`home-category-chip-${id}`).props['accessibilityState'].selected).toBe(
          false,
        );
      }
    });

    it('marks a category selected when all its types are present', () => {
      const { getByTestId } = renderRail([EstablishmentType.BAKERY, EstablishmentType.PASTRY_SHOP]);
      expect(getByTestId('home-category-chip-bakery').props['accessibilityState'].selected).toBe(
        true,
      );
    });

    it('marks a category selected when only ONE of its types is present', () => {
      const { getByTestId } = renderRail([EstablishmentType.PASTRY_SHOP]);
      expect(getByTestId('home-category-chip-bakery').props['accessibilityState'].selected).toBe(
        true,
      );
    });

    it('leaves other categories unselected', () => {
      const { getByTestId } = renderRail([EstablishmentType.BAKERY]);
      expect(getByTestId('home-category-chip-cafe').props['accessibilityState'].selected).toBe(
        false,
      );
      expect(getByTestId('home-category-chip-hotel').props['accessibilityState'].selected).toBe(
        false,
      );
    });

    it('can select several categories at once', () => {
      const { getByTestId } = renderRail([EstablishmentType.BAKERY, EstablishmentType.HOTEL]);
      expect(getByTestId('home-category-chip-bakery').props['accessibilityState'].selected).toBe(
        true,
      );
      expect(getByTestId('home-category-chip-hotel').props['accessibilityState'].selected).toBe(
        true,
      );
      expect(getByTestId('home-category-chip-cafe').props['accessibilityState'].selected).toBe(
        false,
      );
    });

    it('ignores a type that is not in the enum', () => {
      const { getByTestId } = renderRail(['hovercraft_rental' as EstablishmentType]);
      for (const id of CANONICAL_IDS) {
        expect(getByTestId(`home-category-chip-${id}`).props['accessibilityState'].selected).toBe(
          false,
        );
      }
    });

    it('never recolours the artwork — any category, either state', () => {
      /*
       * The artwork is full-colour and must keep its own palette. For a vector
       * that means no `color` prop (it would resolve `currentColor` and flatten
       * the icon to one hue); for a raster it means no `tintColor`, which would
       * replace every pixel with a single colour. Both are checked for every
       * category and in both states, because the set is mid-migration between
       * the two kinds and a regression could land on either branch.
       */
      for (const selected of [[], [EstablishmentType.BAKERY]] as EstablishmentType[][]) {
        const r = renderRail(selected);
        for (const id of CANONICAL_IDS) {
          // The raster branch is deliberately hidden from the a11y tree (the
          // label carries the meaning), and RNTL excludes hidden elements by
          // default — so opt in rather than making the component less
          // accessible to suit the query.
          const art = within(r.getByTestId(`home-category-chip-${id}`)).getByTestId(
            'category-artwork',
            { includeHiddenElements: true },
          );
          expect(art.props['color']).toBeUndefined();
          expect(art.props['tintColor']).toBeUndefined();
          expect(flattenStyle(art.props['style'])['tintColor']).toBeUndefined();
        }
      }
    });

    it('carries the selection on the blob outline, not the artwork', () => {
      /*
       * The blob is white and fills nothing category-specific, so the stroke on
       * its path is the only carrier of selection left — it is load-bearing, not
       * decoration. An outline also follows the organic shape, which a `View`
       * border never could.
       */
      /*
       * `react-native-svg` normalises colours into its own `{payload, type}`
       * shape, so these assert presence and difference rather than a literal
       * hex — pinning the encoding would break on any library upgrade without
       * anything being actually wrong.
       */
      const blob = (r: ReturnType<typeof renderRail>) =>
        r.getByTestId('home-category-blob-bakery', { includeHiddenElements: true }).props;

      const idle = blob(renderRail([]));
      const active = blob(renderRail([EstablishmentType.BAKERY]));

      expect(idle['stroke']).toBeUndefined();
      expect(idle['strokeWidth']).toBeUndefined();
      expect(active['stroke']).toBeDefined();
      expect(active['strokeWidth']).toBeGreaterThan(0);
      // The outline is the accent, so it cannot be the same colour as the fill.
      expect(active['stroke']).not.toEqual(active['fill']);
    });

    it('keeps the blob fill unchanged when selected', () => {
      // A selected tile must not fill with the accent: the artwork sits on top
      // of it, and a coloured ground would fight every icon's own palette.
      const fill = (selected: EstablishmentType[]) =>
        renderRail(selected).getByTestId('home-category-blob-bakery', {
          includeHiddenElements: true,
        }).props['fill'];

      expect(fill([EstablishmentType.BAKERY])).toEqual(fill([]));
    });

    it('keeps the blob the same size in both states', () => {
      /*
       * The stroke is drawn inside an SVG viewBox, not as a layout border, so
       * selecting must not resize the container — otherwise the whole row
       * twitches on every tap.
       */
      const size = (r: ReturnType<typeof renderRail>): unknown =>
        flattenStyle(r.getByTestId('home-category-tile-bakery').props['style'])['width'];

      expect(size(renderRail([EstablishmentType.BAKERY]))).toBe(size(renderRail([])));
    });
  });

  // ==========================================================================
  // Interaction
  // ==========================================================================

  describe('interaction', () => {
    it('reports the category id that was tapped', () => {
      const onToggle = jest.fn();
      const { getByTestId } = renderRail([], onToggle);

      fireEvent.press(getByTestId('home-category-chip-cafe'));

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith('cafe');
    });

    it.each(CANONICAL_IDS)('reports %s when that chip is tapped', id => {
      const onToggle = jest.fn();
      const { getByTestId } = renderRail([], onToggle);

      fireEvent.press(getByTestId(`home-category-chip-${id}`));

      expect(onToggle).toHaveBeenCalledWith(id);
    });

    it('reports the same id when tapping an already-selected chip', () => {
      // Deselection is the caller's job — the rail must not swallow the second
      // tap, or a selected category could never be cleared from the rail.
      const onToggle = jest.fn();
      const { getByTestId } = renderRail([EstablishmentType.BAKERY], onToggle);

      fireEvent.press(getByTestId('home-category-chip-bakery'));

      expect(onToggle).toHaveBeenCalledWith('bakery');
    });

    it('does not fire for chips that were not tapped', () => {
      const onToggle = jest.fn();
      const { getByTestId } = renderRail([], onToggle);

      fireEvent.press(getByTestId('home-category-chip-hotel'));

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalledWith('bakery');
    });
  });

  // ==========================================================================
  // Accessibility
  // ==========================================================================

  describe('accessibility', () => {
    it('announces the action, not just the name, when unselected', () => {
      const { getByTestId } = renderRail([]);
      expect(getByTestId('home-category-chip-bakery').props['accessibilityLabel']).toBe(
        'Show only Bakery offers',
      );
    });

    it('announces the opposite action when selected', () => {
      const { getByTestId } = renderRail([EstablishmentType.BAKERY]);
      expect(getByTestId('home-category-chip-bakery').props['accessibilityLabel']).toBe(
        'Stop filtering by Bakery',
      );
    });

    it('explains that the filter applies without navigating', () => {
      const { getByTestId } = renderRail();
      expect(getByTestId('home-category-chip-cafe').props['accessibilityHint']).toBe(
        'Filters the offers below without leaving this screen',
      );
    });

    it('exposes every chip as a button', () => {
      const { getByTestId } = renderRail();
      for (const id of CANONICAL_IDS) {
        expect(getByTestId(`home-category-chip-${id}`).props['accessibilityRole']).toBe('button');
      }
    });
  });
});

/** Minimal flatten — the style prop may be an array or a single object. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}
