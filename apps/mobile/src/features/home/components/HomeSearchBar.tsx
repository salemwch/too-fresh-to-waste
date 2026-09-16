/**
 * HomeSearchBar Component - Modern Integrated Design
 * Search input + integrated filter button + active filter chips for HomeScreen
 *
 * 🎨 PREMIUM UI/UX DESIGN:
 * - Filter button integrated INSIDE search field
 * - Modern, clean single-field design
 * - Consistent width with ImpactBanner
 * - Professional spacing and shadows
 *
 * Responsibilities:
 * - Search input with real-time updates
 * - Integrated filter button with badge count
 * - Display active search chip
 * - Display active filter chips
 * - Handle chip removal
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { ActiveFilterChips } from '@/features/search/components';
import { hasSheetFilters, countSheetFilters } from '@/features/search/types/filter.types';

import type { FilterState } from '@/features/search/types/filter.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

// ============================================================================
// Types
// ============================================================================

interface HomeSearchBarProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Current filter state */
  filters: FilterState;
  /** Callback when filter button is pressed */
  onFilterPress: () => void;
  /** Callback when offer type filter is removed */
  onRemoveOfferType: () => void;
  /** Callback when cuisine type filter is removed */
  onRemoveCuisineType: (cuisine: string) => void;
  /** Callback when category filter is removed */
  onRemoveCategory: (category: string) => void;
  /** Callback when all filters are cleared */
  onClearAllFilters: () => void;
}

const COLORS = {
  brand: colorTokens.base.primary[500],
  /** Pure white, not `surface` (#FAFAFA): the field sits on the cream ground
   *  and reads cleaner at full white, matching the tab bar silhouette. */
  field: colorTokens.base.neutral[0],
  onBrand: colorTokens.base.neutral[0],
  danger: colorTokens.base.error[500],
  surfaceAccent: '#D1FAE5',
  textPrimary: colorTokens.base.neutral[900],
  textInverse: '#FFFFFF',
  textPlaceholder: colorTokens.light.onSurfaceVariant,
  shadow: '#000',
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * HomeSearchBar Component - Modern Integrated Design
 *
 * Features:
 * - Integrated search + filter in single field
 * - Modern UI with filter button inside search bar
 * - Filter count badge
 * - Active search chip (removable)
 * - Active filter chips (removable)
 * - Responsive layout
 * - Matches ImpactBanner width
 *
 * Performance:
 * - Memoized with React.memo
 * - Only re-renders when props change
 */
const HomeSearchBarComponent = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterPress,
  onRemoveOfferType,
  onRemoveCuisineType,
  onRemoveCategory,
  onClearAllFilters,
}: HomeSearchBarProps) => {
  const { t } = useTranslation();
  // Calculate filter status
  /*
   * Sheet-scoped, not total. Establishment type is set from the category rail
   * and shown by the selected tile, so counting it here would badge a sheet
   * that has no control for it - the user opens the sheet to clear the "1" and
   * finds nothing to clear.
   */
  const hasFilters = hasSheetFilters(filters);
  const filterCount = countSheetFilters(filters);
  const hasSearchOrFilters = searchQuery.trim().length > 0 || hasFilters;

  return (
    <>
      {/* Integrated Search Bar with Filter Button */}
      <View style={styles.container}>
        <View style={styles.searchBar}>
          {/* Search Icon */}
          <Icon
            name='search'
            family='Ionicons'
            size={20}
            color={COLORS.textPlaceholder}
            style={styles.searchIcon}
          />

          {/* Search Input */}
          <TextInput
            placeholder={t('home.searchForFood')}
            placeholderTextColor={COLORS.textPlaceholder}
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType='search'
            autoCapitalize='none'
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel={t('home.a11ySearchOffers')}
            accessibilityHint={t('home.a11ySearchOffersHint')}
            testID='home-search-input'
          />

          {/* Integrated Filter Button */}
          <Pressable
            style={styles.filterButton}
            onPress={onFilterPress}
            accessibilityLabel={`Filters ${hasFilters ? `(${filterCount} active)` : ''}`}
            accessibilityHint={t('home.a11yOpenFilters')}
            accessibilityRole='button'
            testID='home-filter-button'
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name='options-outline' family='Ionicons' size={18} color={COLORS.onBrand} />
            {hasFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Active Search & Filter Chips */}
      {hasSearchOrFilters && (
        <View style={styles.activeFiltersContainer}>
          {/* Search Chip */}
          {searchQuery.trim().length > 0 && (
            <View style={styles.searchChipContainer}>
              <View style={styles.searchChip}>
                <Icon name='search' family='Ionicons' size={14} color={COLORS.brand} />
                <Text style={styles.searchChipText} numberOfLines={1}>
                  {searchQuery}
                </Text>
                <Pressable
                  onPress={() => onSearchChange('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('home.a11yClearSearch')}
                  accessibilityHint={t('home.a11yClearSearchHint')}
                  accessibilityRole='button'
                >
                  <Icon name='close' family='Ionicons' size={16} color={COLORS.brand} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Filter Chips */}
          {hasFilters && (
            <ActiveFilterChips
              filters={filters}
              onRemoveOfferType={onRemoveOfferType}
              onRemoveCuisineType={onRemoveCuisineType}
              onRemoveCategory={onRemoveCategory}
              onClearAll={onClearAllFilters}
            />
          )}
        </View>
      )}
    </>
  );
};

HomeSearchBarComponent.displayName = 'HomeSearchBar';

export const HomeSearchBar = memo(HomeSearchBarComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Container with consistent padding (matches ImpactBanner)
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Pill field, no border - the shadow carries the edge against the cream
  // ground, the same way the tab bar silhouette does.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
    /*
     * Fully rounded. `minHeight` below can grow the field at large font
     * scales, and a fixed radius would stop matching the ends once it does;
     * a radius at least half the tallest realistic height stays a pill.
     */
    borderRadius: 999,
    paddingStart: 16,
    paddingEnd: 8,
    paddingVertical: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    /*
     * No `elevation`. Rule 11 in `.claude/rules/mobile.md`: elevation on a
     * rounded view renders a rectangular shadow outline, which at radius 999
     * would be a square shadow behind a pill.
     */
    /*
     * `minHeight`, not `height`. The input inside is 15px and scales with the
     * OS font setting; at 2.0x that is 30px of glyph in a fixed 48px box with
     * padding, and the placeholder was clipped top and bottom.
     * Device-verified on 2026-08-30.
     *
     * Unchanged below 2.0x, where the content never exceeds 48.
     */
    minHeight: 48,
  },

  // Search icon on the left
  searchIcon: {
    marginEnd: sp[3],
  },

  // Search input takes remaining space
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
  },

  // Filter button: a filled brand circle on the trailing edge. Replaces the
  // bare icon + hairline divider, which read as two controls rather than one.
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Filter count badge
  filterBadge: {
    position: 'absolute',
    top: -3,
    insetInlineEnd: -3,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: COLORS.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },

  // Active filters section
  activeFiltersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Search chip
  searchChipContainer: {
    marginBottom: 8,
  },
  searchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceAccent,
    paddingHorizontal: sp[3],
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    maxWidth: '80%',
  },
  searchChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.brand,
    flex: 1,
  },
});
