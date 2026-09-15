/**
 * Active Filter Chips
 *
 * Displays currently active filters as removable chips.
 *
 * ── Establishment categories are deliberately NOT chipped here ─────────────
 * They are set from the home category rail, and the selected tile is already
 * their indicator. Rendering a second chip for the same selection gave the
 * user two things to look at and two places to clear one filter from - and
 * the chip sat under the search bar, visually attached to a control that no
 * longer owns establishment type at all.
 *
 * So this row shows only what the filter bottom sheet owns. The rail clears
 * its own selection by tapping the tile again.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import {
  CUISINE_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  OFFER_TYPE_OPTIONS,
} from '../constants/filterOptions';

import type { FilterState } from '../types/filter.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

// ============================================================================
// Props
// ============================================================================

interface ActiveFilterChipsProps {
  filters: FilterState;
  onRemoveOfferType: () => void;
  onRemoveCuisineType: (cuisine: string) => void;
  onRemoveCategory: (category: string) => void;
  onClearAll: () => void;
}

interface ChipData {
  id: string;
  label: string;
  /** Emoji marker, for filter groups that still use one. */
  emoji?: string;
  onRemove: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  filters,
  onRemoveOfferType,
  onRemoveCuisineType,
  onRemoveCategory,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Build chip data from filters
  const chips = useMemo(() => {
    const result: ChipData[] = [];

    // Offer type
    if (filters.offerType !== undefined && filters.offerType !== null) {
      const option = OFFER_TYPE_OPTIONS.find(o => o.value === filters.offerType);
      if (option) {
        result.push({
          id: `offer-${filters.offerType}`,
          label: option.label,
          emoji: option.icon,
          onRemove: onRemoveOfferType,
        });
      }
    }

    // Cuisine types
    filters.cuisineTypes.forEach(cuisine => {
      const option = CUISINE_TYPE_OPTIONS.find(o => o.value === cuisine);
      if (option) {
        result.push({
          id: `cuisine-${cuisine}`,
          label: option.label,
          emoji: option.flag,
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
          ...(option.icon != null && { emoji: option.icon }),
          onRemove: () => onRemoveCategory(category),
        });
      }
    });

    return result;
  }, [filters, onRemoveOfferType, onRemoveCuisineType, onRemoveCategory]);

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
            testID={`active-filter-chip-${chip.id}`}
            style={[
              styles.chip,
              {
                backgroundColor: `${colors.accent}15`,
                borderColor: colors.accent,
              },
            ]}
          >
            {chip.emoji != null && <Text style={styles.chipIcon}>{chip.emoji}</Text>}
            <Text variant='caption' style={[styles.chipLabel, { color: colors.accent }]}>
              {chip.label}
            </Text>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={t('common.a11yRemoveFilter', { label: chip.label })}
              accessibilityHint={t('common.a11yRemoveFilterHint')}
              onPress={chip.onRemove}
              style={styles.removeButton}
              testID={`active-filter-remove-${chip.id}`}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name='close' size={14} color={colors.accent} />
            </Pressable>
          </View>
        ))}

        {/* Clear All Button */}
        <Pressable
          accessibilityRole='button'
          style={[styles.clearAllButton, { borderColor: colors.onSurfaceVariant }]}
          onPress={onClearAll}
          testID='active-filter-clear-all'
        >
          <Text
            variant='caption'
            style={[styles.clearAllLabel, { color: colors.onSurfaceVariant }]}
          >
            {t('search.clearAll')}
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
    paddingVertical: sp[3],
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: sp[3],
    paddingEnd: 8,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  removeButton: {
    marginStart: 6,
    padding: 2,
  },
  chipIcon: {
    fontSize: 14,
    marginEnd: 4,
  },
  chipLabel: {
    fontWeight: '500',
  },
  clearAllButton: {
    paddingHorizontal: sp[3],
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
