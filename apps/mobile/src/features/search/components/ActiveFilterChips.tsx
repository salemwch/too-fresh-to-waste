/**
 * Active Filter Chips
 *
 * Displays currently active filters as removable chips
 * Shows at the top of search results
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import {
  ESTABLISHMENT_TYPE_OPTIONS,
  CUISINE_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  OFFER_TYPE_OPTIONS,
} from '../constants/filterOptions';

import type { FilterState } from '../types/filter.types';
import type { EstablishmentType } from '@/features/offers/types/offer.types';

// ============================================================================
// Props
// ============================================================================

interface ActiveFilterChipsProps {
  filters: FilterState;
  onRemoveOfferType: () => void;
  onRemoveEstablishmentType: (type: EstablishmentType) => void;
  onRemoveCuisineType: (cuisine: string) => void;
  onRemoveCategory: (category: string) => void;
  onClearAll: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  filters,
  onRemoveOfferType,
  onRemoveEstablishmentType,
  onRemoveCuisineType,
  onRemoveCategory,
  onClearAll,
}) => {
  const { colors } = useTheme();

  // Build chip data from filters
  const chips = useMemo(() => {
    const result: Array<{ id: string; label: string; icon?: string; onRemove: () => void }> = [];

    // Offer type
    if (filters.offerType !== undefined && filters.offerType !== null) {
      const option = OFFER_TYPE_OPTIONS.find(o => o.value === filters.offerType);
      if (option) {
        result.push({
          id: `offer-${filters.offerType}`,
          label: option.label,
          icon: option.icon,
          onRemove: onRemoveOfferType,
        });
      }
    }

    // Establishment types
    filters.establishmentTypes.forEach(type => {
      const option = ESTABLISHMENT_TYPE_OPTIONS.find(o => o.value === type);
      if (option) {
        result.push({
          id: `establishment-${type}`,
          label: option.label,
          icon: option.icon,
          onRemove: () => onRemoveEstablishmentType(type),
        });
      }
    });

    // Cuisine types
    filters.cuisineTypes.forEach(cuisine => {
      const option = CUISINE_TYPE_OPTIONS.find(o => o.value === cuisine);
      if (option) {
        result.push({
          id: `cuisine-${cuisine}`,
          label: option.label,
          icon: option.flag,
          onRemove: () => onRemoveCuisineType(cuisine),
        });
      }
    });

    // Categories
    filters.categories.forEach(category => {
      const option = CATEGORY_OPTIONS.find(o => o.value === category);
      if (option) {
        result.push({
          id: `category-${category}`,
          label: option.label,
          ...(option.icon != null && { icon: option.icon }),
          onRemove: () => onRemoveCategory(category),
        });
      }
    });

    return result;
  }, [
    filters,
    onRemoveOfferType,
    onRemoveEstablishmentType,
    onRemoveCuisineType,
    onRemoveCategory,
  ]);

  if (chips.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map(chip => (
          <View
            key={chip.id}
            style={[
              styles.chip,
              {
                backgroundColor: `${colors.accent}15`,
                borderColor: colors.accent,
              },
            ]}
          >
            {chip.icon && <Text style={styles.chipIcon}>{chip.icon}</Text>}
            <Text variant='caption' style={[styles.chipLabel, { color: colors.accent }]}>
              {chip.label}
            </Text>
            <Pressable
              onPress={chip.onRemove}
              style={styles.removeButton}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name='close' size={14} color={colors.accent} />
            </Pressable>
          </View>
        ))}

        {/* Clear All Button */}
        <Pressable
          style={[styles.clearAllButton, { borderColor: colors.onSurfaceVariant }]}
          onPress={onClearAll}
        >
          <Text
            variant='caption'
            style={[styles.clearAllLabel, { color: colors.onSurfaceVariant }]}
          >
            Clear All
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  removeButton: {
    marginLeft: 6,
    padding: 2,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontWeight: '500',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllLabel: {
    fontWeight: '500',
  },
});
