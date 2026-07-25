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
import { hasActiveFilters, countActiveFilters } from '@/features/search/types/filter.types';

import type { EstablishmentType } from '@/features/offers/types/offer.types';
import type { FilterState } from '@/features/search/types/filter.types';

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
  /** Callback when establishment type filter is removed */
  onRemoveEstablishmentType: (type: EstablishmentType) => void;
  /** Callback when cuisine type filter is removed */
  onRemoveCuisineType: (cuisine: string) => void;
  /** Callback when category filter is removed */
  onRemoveCategory: (category: string) => void;
  /** Callback when all filters are cleared */
  onClearAllFilters: () => void;
}

const COLORS = {
  brand: colorTokens.base.primary[500],
  danger: '#EF4444',
  surface: '#F8FAFC',
  surfaceAccent: '#D1FAE5',
  border: '#E2E8F0',
  textPrimary: '#1F2937',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
  textPlaceholder: '#94A3B8',
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
  onRemoveEstablishmentType,
  onRemoveCuisineType,
  onRemoveCategory,
  onClearAllFilters,
}: HomeSearchBarProps) => {
  const { t } = useTranslation();
  // Calculate filter status
  const hasFilters = hasActiveFilters(filters);
  const filterCount = countActiveFilters(filters);
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

          {/* Vertical Divider */}
          <View style={styles.verticalDivider} />

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
            <Icon
              name='options-outline'
              family='Ionicons'
              size={22}
              color={hasFilters ? COLORS.brand : COLORS.textSecondary}
            />
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
              onRemoveEstablishmentType={onRemoveEstablishmentType}
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

  // Modern integrated search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    height: 48,
  },

  // Search icon on the left
  searchIcon: {
    marginRight: 12,
  },

  // Search input takes remaining space
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
    margin: 0,
  },

  // Vertical divider before filter button
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },

  // Filter button integrated on the right
  filterButton: {
    padding: 8,
    position: 'relative',
  },

  // Filter count badge
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
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
    paddingHorizontal: 12,
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
